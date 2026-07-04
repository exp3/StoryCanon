import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export interface StorageStackProps extends cdk.StackProps {
  prefix: string;
  isProd: boolean;
}

export class StorageStack extends cdk.Stack {
  readonly exportBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: StorageStackProps) {
    super(scope, id, props);

    this.exportBucket = new s3.Bucket(this, "ExportBucket", {
      bucketName: `${props.prefix}-exports-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: props.isProd,
      removalPolicy: props.isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: !props.isProd,
    });

    new cdk.CfnOutput(this, "ExportBucketName", { value: this.exportBucket.bucketName });
  }
}
