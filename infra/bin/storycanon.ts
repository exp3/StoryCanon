#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { NetworkStack } from "../lib/network-stack";
import { DatabaseStack } from "../lib/database-stack";
import { StorageStack } from "../lib/storage-stack";
import { SecretsStack } from "../lib/secrets-stack";
import { ComputeStack } from "../lib/compute-stack";
import { DnsStack } from "../lib/dns-stack";

const app = new cdk.App();
const stage = app.node.tryGetContext("stage") ?? process.env.STAGE ?? "dev";
const region = app.node.tryGetContext("region") ?? process.env.AWS_REGION ?? "ap-northeast-1";
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region };
const prefix = `storycanon-${stage}`;
const isProd = stage === "prod";
const useExistingEcrRepository = app.node.tryGetContext("useExistingEcrRepository") === "true";

const network = new NetworkStack(app, `${prefix}-network`, { env, prefix });
const storage = new StorageStack(app, `${prefix}-storage`, { env, prefix, isProd });
const secrets = new SecretsStack(app, `${prefix}-secrets`, { env, prefix });
const database = new DatabaseStack(app, `${prefix}-database`, {
  env,
  prefix,
  isProd,
  vpc: network.vpc,
  appSecurityGroup: network.appSecurityGroup,
});
const paymentMode = app.node.tryGetContext("paymentMode") ?? process.env.PAYMENT_MODE ?? "mock";
const stripePricePlusMonthly =
  app.node.tryGetContext("stripePricePlusMonthly") ?? process.env.STRIPE_PRICE_PLUS_MONTHLY ?? "";
const stripePricePlusYearly =
  app.node.tryGetContext("stripePricePlusYearly") ?? process.env.STRIPE_PRICE_PLUS_YEARLY ?? "";
const stripePriceProMonthly =
  app.node.tryGetContext("stripePriceProMonthly") ?? process.env.STRIPE_PRICE_PRO_MONTHLY ?? "";
const stripePriceProYearly =
  app.node.tryGetContext("stripePriceProYearly") ?? process.env.STRIPE_PRICE_PRO_YEARLY ?? "";
const adminEmails = app.node.tryGetContext("adminEmails") ?? process.env.ADMIN_EMAILS ?? "n.kimura@softglow.jp";
const gaMeasurementId = app.node.tryGetContext("gaMeasurementId") ?? process.env.NEXT_PUBLIC_GA_ID ?? "";
const hostedZoneName = app.node.tryGetContext("hostedZoneName") ?? process.env.HOSTED_ZONE_NAME;
const appDomainName = app.node.tryGetContext("appDomainName") ?? process.env.APP_DOMAIN_NAME;

const compute = new ComputeStack(app, `${prefix}-app`, {
  env,
  prefix,
  vpc: network.vpc,
  database,
  storage,
  secrets,
  useExistingEcrRepository,
  paymentMode,
  stripePricePlusMonthly,
  stripePricePlusYearly,
  stripePriceProMonthly,
  stripePriceProYearly,
  adminEmails,
  gaMeasurementId,
  hostedZoneName,
  appDomainName,
});

if (hostedZoneName && appDomainName) {
  new DnsStack(app, `${prefix}-dns`, {
    env,
    prefix,
    hostedZoneName,
    appDomainName,
    loadBalancer: compute.loadBalancer,
  });
}
