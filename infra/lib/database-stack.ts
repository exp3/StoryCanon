import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import { Construct } from "constructs";

export interface DatabaseStackProps extends cdk.StackProps {
  prefix: string;
  isProd: boolean;
  vpc: ec2.Vpc;
  appSecurityGroup: ec2.SecurityGroup;
}

export class DatabaseStack extends cdk.Stack {
  readonly instance: rds.DatabaseInstance;
  readonly secretArn: string;
  readonly endpointAddress: string;
  readonly endpointPort: string;

  constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    const dbSecurityGroup = new ec2.SecurityGroup(this, "RDSSecurityGroup", {
      vpc: props.vpc,
      securityGroupName: `${props.prefix}-db-sg`,
      allowAllOutbound: false,
    });
    dbSecurityGroup.addIngressRule(props.appSecurityGroup, ec2.Port.tcp(5432), "Application runtime to PostgreSQL");

    this.instance = new rds.DatabaseInstance(this, "Postgres", {
      instanceIdentifier: `${props.prefix}-db`,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [dbSecurityGroup],
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_16 }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      allocatedStorage: 20,
      storageType: rds.StorageType.GP3,
      databaseName: "storycanon",
      credentials: rds.Credentials.fromGeneratedSecret("storycanon"),
      multiAz: false,
      publiclyAccessible: false,
      backupRetention: cdk.Duration.days(props.isProd ? 7 : 1),
      deletionProtection: props.isProd,
      storageEncrypted: true,
      removalPolicy: props.isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    this.secretArn = this.instance.secret!.secretArn;
    this.endpointAddress = this.instance.instanceEndpoint.hostname;
    this.endpointPort = this.instance.instanceEndpoint.port.toString();

    new cdk.CfnOutput(this, "DatabaseSecretArn", { value: this.secretArn });
    new cdk.CfnOutput(this, "DatabaseEndpoint", { value: this.endpointAddress });
  }
}
