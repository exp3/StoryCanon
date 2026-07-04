import * as cdk from "aws-cdk-lib";
import * as apprunner from "aws-cdk-lib/aws-apprunner";
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

    new apprunner.CfnCustomDomainAssociation(this, "AppDomain", {
      domainName: props.appDomainName,
      serviceArn: props.serviceArn,
      enableWwwSubdomain: false,
    });
  }
}
