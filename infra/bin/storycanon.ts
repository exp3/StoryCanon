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
const compute = new ComputeStack(app, `${prefix}-app`, {
  env,
  prefix,
  vpc: network.vpc,
  database,
  storage,
  secrets,
  useExistingEcrRepository,
});

const hostedZoneName = app.node.tryGetContext("hostedZoneName") ?? process.env.HOSTED_ZONE_NAME;
const appDomainName = app.node.tryGetContext("appDomainName") ?? process.env.APP_DOMAIN_NAME;
if (hostedZoneName && appDomainName) {
  new DnsStack(app, `${prefix}-dns`, {
    env,
    prefix,
    hostedZoneName,
    appDomainName,
    loadBalancer: compute.loadBalancer,
  });
}
