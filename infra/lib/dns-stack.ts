import * as cdk from "aws-cdk-lib";
import * as route53 from "aws-cdk-lib/aws-route53";
import { Construct } from "constructs";

export interface DnsStackProps extends cdk.StackProps {
  prefix: string;
  hostedZoneName: string;
  appDomainName: string;
  serviceArn: string;
}

export class DnsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: DnsStackProps) {
    super(scope, id, props);

    route53.HostedZone.fromLookup(this, "HostedZone", { domainName: props.hostedZoneName });

    new cdk.CfnOutput(this, "AppRunnerCustomDomainCommand", {
      value: [
        "aws apprunner associate-custom-domain",
        `--service-arn ${props.serviceArn}`,
        `--domain-name ${props.appDomainName}`,
        "--no-enable-www-subdomain",
      ].join(" "),
    });
  }
}
