import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { DatabaseStack } from "./database-stack";
import { StorageStack } from "./storage-stack";
import { SecretsStack } from "./secrets-stack";

export interface ComputeStackProps extends cdk.StackProps {
  prefix: string;
  vpc: ec2.Vpc;
  appSecurityGroup: ec2.SecurityGroup;
  database: DatabaseStack;
  storage: StorageStack;
  secrets: SecretsStack;
  /** x86_64 instance type. Defaults to t3.small. */
  instanceType?: string;
}

/**
 * Hybrid runtime: a single EC2 instance inside the VPC that runs the web
 * container and a Cloudflare Tunnel (cloudflared) via docker compose.
 *
 * - It is placed in a public subnet (the VPC has natGateways: 0) so it can
 *   reach the internet for ECR pulls, Cloudflare, Stripe and Google OAuth.
 * - Ingress is closed: the security group is the shared app SG (no inbound
 *   rules). Public traffic arrives through the outbound-only Cloudflare Tunnel.
 * - Because it carries the app SG, it can reach the private RDS instance over
 *   VPC-local routing, so RDS keeps its managed automated backups.
 * - The instance role allows SSM (agentless deploys), ECR pull, reading the
 *   app secrets and read/write on the export bucket. The runtime .env is
 *   assembled on the instance from Secrets Manager, never from the CFN template.
 */
export class ComputeStack extends cdk.Stack {
  readonly instanceId: string;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    // ECR repository lifecycle is owned by the deploy script (created via CLI
    // if missing), matching the existing scripts. Reference it by name so the
    // instance role can be granted pull permissions.
    const repository = ecr.Repository.fromRepositoryName(this, "WebRepository", `${props.prefix}-web`);

    const role = new iam.Role(this, "InstanceRole", {
      roleName: `${props.prefix}-ec2-role`,
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore")],
    });
    repository.grantPull(role);
    props.storage.exportBucket.grantReadWrite(role);
    for (const secret of Object.values(props.secrets.appSecrets)) {
      secret.grantRead(role);
    }

    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      "set -euo pipefail",
      "dnf update -y",
      "dnf install -y docker",
      "systemctl enable --now docker",
      "mkdir -p /usr/local/lib/docker/cli-plugins",
      "ARCH=$(uname -m)",
      'curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-${ARCH}" -o /usr/local/lib/docker/cli-plugins/docker-compose',
      "chmod +x /usr/local/lib/docker/cli-plugins/docker-compose",
      "mkdir -p /opt/storycanon",
      "touch /opt/storycanon/.bootstrapped",
    );

    const instance = new ec2.Instance(this, "AppInstance", {
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: new ec2.InstanceType(props.instanceType ?? "t3.small"),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup: props.appSecurityGroup,
      role,
      userData,
      instanceName: `${props.prefix}-app`,
      requireImdsv2: true,
      blockDevices: [
        {
          deviceName: "/dev/xvda",
          volume: ec2.BlockDeviceVolume.ebs(20, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            encrypted: true,
          }),
        },
      ],
    });

    this.instanceId = instance.instanceId;

    new cdk.CfnOutput(this, "InstanceId", { value: instance.instanceId });
    new cdk.CfnOutput(this, "InstancePublicIp", { value: instance.instancePublicIp });
  }
}
