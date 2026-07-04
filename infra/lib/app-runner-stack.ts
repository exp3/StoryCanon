import * as cdk from "aws-cdk-lib";
import * as apprunner from "aws-cdk-lib/aws-apprunner";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { DatabaseStack } from "./database-stack";
import { StorageStack } from "./storage-stack";
import { SecretsStack } from "./secrets-stack";

export interface AppRunnerStackProps extends cdk.StackProps {
  prefix: string;
  vpc: ec2.Vpc;
  appSecurityGroup: ec2.SecurityGroup;
  database: DatabaseStack;
  storage: StorageStack;
  secrets: SecretsStack;
  useExistingEcrRepository?: boolean;
}

export class AppRunnerStack extends cdk.Stack {
  readonly repository: ecr.IRepository;
  readonly serviceArn: string;

  constructor(scope: Construct, id: string, props: AppRunnerStackProps) {
    super(scope, id, props);

    this.repository = props.useExistingEcrRepository
      ? ecr.Repository.fromRepositoryName(this, "WebRepository", `${props.prefix}-web`)
      : new ecr.Repository(this, "WebRepository", {
          repositoryName: `${props.prefix}-web`,
          imageScanOnPush: true,
          removalPolicy: cdk.RemovalPolicy.RETAIN,
        });

    const accessRole = new iam.Role(this, "AppRunnerAccessRole", {
      assumedBy: new iam.ServicePrincipal("build.apprunner.amazonaws.com"),
    });
    this.repository.grantPull(accessRole);

    const instanceRole = new iam.Role(this, "AppRunnerInstanceRole", {
      assumedBy: new iam.ServicePrincipal("tasks.apprunner.amazonaws.com"),
    });
    props.storage.exportBucket.grantReadWrite(instanceRole);
    for (const secret of Object.values(props.secrets.appSecrets)) {
      secret.grantRead(instanceRole);
    }

    const connector = new apprunner.CfnVpcConnector(this, "VpcConnector", {
      vpcConnectorName: `${props.prefix}-vpc-connector`,
      subnets: props.vpc.privateSubnets.map((subnet) => subnet.subnetId),
      securityGroups: [props.appSecurityGroup.securityGroupId],
    });

    const service = new apprunner.CfnService(this, "Service", {
      serviceName: `${props.prefix}-app`,
      sourceConfiguration: {
        autoDeploymentsEnabled: false,
        authenticationConfiguration: { accessRoleArn: accessRole.roleArn },
        imageRepository: {
          imageIdentifier: `${this.repository.repositoryUri}:latest`,
          imageRepositoryType: "ECR",
          imageConfiguration: {
            port: "3000",
            runtimeEnvironmentVariables: [
              { name: "NODE_ENV", value: "production" },
              { name: "APP_ENV", value: props.prefix },
              { name: "PAYMENT_MODE", value: "mock" },
              { name: "DATABASE_HOST", value: props.database.endpointAddress },
              { name: "DATABASE_PORT", value: props.database.endpointPort },
              { name: "EXPORT_BUCKET_NAME", value: props.storage.exportBucket.bucketName },
            ],
            runtimeEnvironmentSecrets: [
              { name: "DATABASE_URL", value: props.secrets.appSecrets.DATABASE_URL.secretArn },
              { name: "NEXTAUTH_URL", value: props.secrets.appSecrets.NEXTAUTH_URL.secretArn },
              { name: "NEXTAUTH_SECRET", value: props.secrets.appSecrets.NEXTAUTH_SECRET.secretArn },
              { name: "GOOGLE_CLIENT_ID", value: props.secrets.appSecrets.GOOGLE_CLIENT_ID.secretArn },
              { name: "GOOGLE_CLIENT_SECRET", value: props.secrets.appSecrets.GOOGLE_CLIENT_SECRET.secretArn },
              { name: "STRIPE_SECRET_KEY", value: props.secrets.appSecrets.STRIPE_SECRET_KEY.secretArn },
              { name: "STRIPE_WEBHOOK_SECRET", value: props.secrets.appSecrets.STRIPE_WEBHOOK_SECRET.secretArn },
              { name: "APP_API_TOKEN_PEPPER", value: props.secrets.appSecrets.APP_API_TOKEN_PEPPER.secretArn },
            ],
          },
        },
      },
      instanceConfiguration: {
        cpu: "0.25 vCPU",
        memory: "0.5 GB",
        instanceRoleArn: instanceRole.roleArn,
      },
      networkConfiguration: {
        egressConfiguration: {
          egressType: "VPC",
          vpcConnectorArn: connector.attrVpcConnectorArn,
        },
      },
    });
    service.addDependency(connector);
    this.serviceArn = service.attrServiceArn;

    new cdk.CfnOutput(this, "RepositoryUri", { value: this.repository.repositoryUri });
    new cdk.CfnOutput(this, "AppRunnerServiceArn", { value: this.serviceArn });
  }
}
