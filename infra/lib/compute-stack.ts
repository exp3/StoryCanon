import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as codedeploy from "aws-cdk-lib/aws-codedeploy";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as route53 from "aws-cdk-lib/aws-route53";
import { Construct } from "constructs";
import { DatabaseStack } from "./database-stack";
import { StorageStack } from "./storage-stack";
import { SecretsStack } from "./secrets-stack";

export interface ComputeStackProps extends cdk.StackProps {
  prefix: string;
  vpc: ec2.Vpc;
  database: DatabaseStack;
  storage: StorageStack;
  secrets: SecretsStack;
  useExistingEcrRepository?: boolean;
  /** Minutes CodeDeploy keeps the old (blue) task set alive after cutover, so a rollback is instant. Defaults to 5. */
  bakeTimeMinutes?: number;
  /** Container PAYMENT_MODE. Defaults to "mock" so live billing is never enabled by accident. */
  paymentMode?: string;
  stripePricePlus?: string;
  stripePricePro?: string;
  /**
   * When both are set, the ALB serves production over HTTPS with an ACM cert
   * (DNS-validated in the zone) and redirects :80 -> :443. Without them the
   * production listener stays on plain :80.
   */
  hostedZoneName?: string;
  appDomainName?: string;
}

/**
 * ECS Fargate service behind a self-managed Application Load Balancer, wired for
 * CodeDeploy blue/green deployments.
 *
 * Why this shape:
 * - The VPC has natGateways: 0, so tasks run in PUBLIC subnets with a public IP
 *   to reach ECR, Stripe and Google. They carry the shared app SG, which the
 *   database SG already trusts on 5432, so RDS stays private.
 * - Two target groups (blue/green) plus a production listener (:80) and a test
 *   listener (:8080) give CodeDeploy the control points it needs to shift
 *   traffic and bake before terminating the old task set.
 * - min desiredCount stays at 1; a second task set only exists transiently
 *   during a deployment, so steady-state cost matches a single-task service.
 *
 * Blue/green here is CodeDeploy-driven because the pinned aws-cdk-lib (2.174)
 * predates native ECS blue/green (deploymentConfiguration.strategy=BLUE_GREEN,
 * mid-2025). Revisit once CDK is upgraded.
 */
export class ComputeStack extends cdk.Stack {
  readonly repository: ecr.IRepository;
  readonly loadBalancer: elbv2.ApplicationLoadBalancer;
  readonly service: ecs.FargateService;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    this.repository = props.useExistingEcrRepository
      ? ecr.Repository.fromRepositoryName(this, "WebRepository", `${props.prefix}-web`)
      : new ecr.Repository(this, "WebRepository", {
          repositoryName: `${props.prefix}-web`,
          imageScanOnPush: true,
          removalPolicy: cdk.RemovalPolicy.RETAIN,
        });

    const cluster = new ecs.Cluster(this, "Cluster", {
      clusterName: `${props.prefix}-cluster`,
      vpc: props.vpc,
      containerInsights: false,
    });

    const executionRole = new iam.Role(this, "TaskExecutionRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonECSTaskExecutionRolePolicy"),
      ],
    });
    for (const secret of Object.values(props.secrets.appSecrets)) {
      secret.grantRead(executionRole);
    }

    const taskRole = new iam.Role(this, "TaskRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
    });
    props.storage.exportBucket.grantReadWrite(taskRole);

    const logGroup = new logs.LogGroup(this, "LogGroup", {
      logGroupName: `/ecs/${props.prefix}`,
      retention: logs.RetentionDays.TWO_WEEKS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const taskDefinition = new ecs.FargateTaskDefinition(this, "TaskDef", {
      cpu: 256,
      memoryLimitMiB: 512,
      executionRole,
      taskRole,
      family: `${props.prefix}-web`,
    });

    taskDefinition.addContainer("web", {
      containerName: "web",
      image: ecs.ContainerImage.fromEcrRepository(this.repository, "latest"),
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: "web", logGroup }),
      portMappings: [{ containerPort: 3000 }],
      environment: {
        NODE_ENV: "production",
        APP_ENV: props.prefix,
        PAYMENT_MODE: props.paymentMode ?? "mock",
        DATABASE_HOST: props.database.endpointAddress,
        DATABASE_PORT: props.database.endpointPort,
        EXPORT_BUCKET_NAME: props.storage.exportBucket.bucketName,
        STRIPE_PRICE_PLUS: props.stripePricePlus ?? "",
        STRIPE_PRICE_PRO: props.stripePricePro ?? "",
      },
      secrets: Object.fromEntries(
        Object.entries(props.secrets.appSecrets).map(([name, secret]) => [
          name,
          ecs.Secret.fromSecretsManager(secret),
        ]),
      ),
    });

    // ALB is internet-facing in the public subnets; the app SG trusts it on 3000.
    const albSecurityGroup = new ec2.SecurityGroup(this, "AlbSecurityGroup", {
      vpc: props.vpc,
      securityGroupName: `${props.prefix}-alb-sg`,
      allowAllOutbound: true,
    });
    albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "Public HTTP");
    albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), "Public HTTPS");

    // The Fargate service gets its OWN security group in this stack rather than
    // reusing the network stack's shared app SG. Attaching a service to an ALB
    // makes CDK auto-add an ALB->task ingress rule to the service's SG; if that
    // SG lived in the network stack it would reference this stack's ALB SG and
    // create a network<->app dependency cycle. The ALB->task rule on 3000 is
    // wired automatically when the service attaches to the blue target group.
    const serviceSecurityGroup = new ec2.SecurityGroup(this, "ServiceSecurityGroup", {
      vpc: props.vpc,
      securityGroupName: `${props.prefix}-service-sg`,
      allowAllOutbound: true,
    });

    // Let the tasks reach the private database. Declared here (compute -> database)
    // so the database stack never needs to reference this stack.
    new ec2.CfnSecurityGroupIngress(this, "ServiceToDatabaseIngress", {
      groupId: props.database.securityGroup.securityGroupId,
      ipProtocol: "tcp",
      fromPort: 5432,
      toPort: 5432,
      sourceSecurityGroupId: serviceSecurityGroup.securityGroupId,
      description: "Web service to PostgreSQL",
    });

    this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, "Alb", {
      loadBalancerName: `${props.prefix}-alb`,
      vpc: props.vpc,
      internetFacing: true,
      securityGroup: albSecurityGroup,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });

    const healthCheck: elbv2.HealthCheck = {
      path: "/api/health",
      healthyHttpCodes: "200",
      interval: cdk.Duration.seconds(30),
      timeout: cdk.Duration.seconds(5),
    };

    const blueTargetGroup = new elbv2.ApplicationTargetGroup(this, "BlueTargetGroup", {
      targetGroupName: `${props.prefix}-blue`,
      vpc: props.vpc,
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      deregistrationDelay: cdk.Duration.seconds(30),
      healthCheck,
    });

    const greenTargetGroup = new elbv2.ApplicationTargetGroup(this, "GreenTargetGroup", {
      targetGroupName: `${props.prefix}-green`,
      vpc: props.vpc,
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      deregistrationDelay: cdk.Duration.seconds(30),
      healthCheck,
    });

    // Production traffic starts on blue; test traffic on :8080 (green) so a new
    // version can be validated before the production cutover. With a domain we
    // serve production over HTTPS (ACM cert, DNS-validated) and redirect :80 ->
    // :443; without one the production listener stays on plain :80 (e.g. dev).
    let productionListener: elbv2.ApplicationListener;
    if (props.hostedZoneName && props.appDomainName) {
      const hostedZone = route53.HostedZone.fromLookup(this, "HostedZone", {
        domainName: props.hostedZoneName,
      });
      const certificate = new acm.Certificate(this, "Certificate", {
        domainName: props.appDomainName,
        validation: acm.CertificateValidation.fromDns(hostedZone),
      });
      productionListener = this.loadBalancer.addListener("ProductionListener", {
        port: 443,
        protocol: elbv2.ApplicationProtocol.HTTPS,
        certificates: [certificate],
        defaultTargetGroups: [blueTargetGroup],
      });
      this.loadBalancer.addListener("HttpRedirectListener", {
        port: 80,
        protocol: elbv2.ApplicationProtocol.HTTP,
        defaultAction: elbv2.ListenerAction.redirect({
          protocol: "HTTPS",
          port: "443",
          permanent: true,
        }),
      });
    } else {
      productionListener = this.loadBalancer.addListener("ProductionListener", {
        port: 80,
        protocol: elbv2.ApplicationProtocol.HTTP,
        defaultTargetGroups: [blueTargetGroup],
      });
    }

    const testListener = this.loadBalancer.addListener("TestListener", {
      port: 8080,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultTargetGroups: [greenTargetGroup],
    });

    this.service = new ecs.FargateService(this, "Service", {
      serviceName: `${props.prefix}-app`,
      cluster,
      taskDefinition,
      desiredCount: 1,
      assignPublicIp: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroups: [serviceSecurityGroup],
      deploymentController: { type: ecs.DeploymentControllerType.CODE_DEPLOY },
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      healthCheckGracePeriod: cdk.Duration.seconds(60),
    });
    this.service.attachToApplicationTargetGroup(blueTargetGroup);

    const deploymentGroup = new codedeploy.EcsDeploymentGroup(this, "BlueGreenDeploymentGroup", {
      deploymentGroupName: `${props.prefix}-bluegreen`,
      service: this.service,
      blueGreenDeploymentConfig: {
        blueTargetGroup,
        greenTargetGroup,
        listener: productionListener,
        testListener,
        terminationWaitTime: cdk.Duration.minutes(props.bakeTimeMinutes ?? 5),
      },
      deploymentConfig: codedeploy.EcsDeploymentConfig.ALL_AT_ONCE,
      autoRollback: {
        failedDeployment: true,
        stoppedDeployment: true,
      },
    });

    new cdk.CfnOutput(this, "RepositoryUri", { value: this.repository.repositoryUri });
    new cdk.CfnOutput(this, "AlbDnsName", { value: this.loadBalancer.loadBalancerDnsName });
    new cdk.CfnOutput(this, "ClusterName", { value: cluster.clusterName });
    new cdk.CfnOutput(this, "ServiceName", { value: this.service.serviceName });
    new cdk.CfnOutput(this, "TaskDefinitionArn", { value: taskDefinition.taskDefinitionArn });
    new cdk.CfnOutput(this, "CodeDeployApplicationName", {
      value: deploymentGroup.application.applicationName,
    });
    new cdk.CfnOutput(this, "CodeDeployDeploymentGroupName", {
      value: deploymentGroup.deploymentGroupName,
    });
  }
}
