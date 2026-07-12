import * as cdk from "aws-cdk-lib";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as targets from "aws-cdk-lib/aws-route53-targets";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Construct } from "constructs";

export interface DnsStackProps extends cdk.StackProps {
  prefix: string;
  hostedZoneName: string;
  appDomainName: string;
  loadBalancer: elbv2.IApplicationLoadBalancer;
}

export class DnsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: DnsStackProps) {
    super(scope, id, props);

    const hostedZone = route53.HostedZone.fromLookup(this, "HostedZone", {
      domainName: props.hostedZoneName,
    });

    new route53.ARecord(this, "AppAlias", {
      zone: hostedZone,
      recordName: props.appDomainName,
      target: route53.RecordTarget.fromAlias(new targets.LoadBalancerTarget(props.loadBalancer)),
    });

    new cdk.CfnOutput(this, "AppUrl", { value: `https://${props.appDomainName}` });
  }
}
