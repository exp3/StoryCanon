import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

export interface NetworkStackProps extends cdk.StackProps {
  prefix: string;
}

export class NetworkStack extends cdk.Stack {
  readonly vpc: ec2.Vpc;
  readonly appSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);

    this.vpc = new ec2.Vpc(this, "Vpc", {
      vpcName: `${props.prefix}-vpc`,
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        { name: "public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: "private", subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
    });

    this.appSecurityGroup = new ec2.SecurityGroup(this, "AppRunnerSecurityGroup", {
      vpc: this.vpc,
      securityGroupName: `${props.prefix}-app-sg`,
      allowAllOutbound: true,
    });

    new cdk.CfnOutput(this, "VpcId", { value: this.vpc.vpcId });
    new cdk.CfnOutput(this, "AppSecurityGroupId", { value: this.appSecurityGroup.securityGroupId });
    new cdk.CfnOutput(this, "PrivateSubnetIds", {
      value: this.vpc.privateSubnets.map((subnet) => subnet.subnetId).join(","),
    });
    new cdk.CfnOutput(this, "PublicSubnetIds", {
      value: this.vpc.publicSubnets.map((subnet) => subnet.subnetId).join(","),
    });
  }
}
