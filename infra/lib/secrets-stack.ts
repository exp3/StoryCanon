import * as cdk from "aws-cdk-lib";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

export interface SecretsStackProps extends cdk.StackProps {
  prefix: string;
}

export class SecretsStack extends cdk.Stack {
  readonly appSecrets: Record<string, secretsmanager.Secret>;

  constructor(scope: Construct, id: string, props: SecretsStackProps) {
    super(scope, id, props);

    const names = [
      "DATABASE_URL",
      "NEXTAUTH_SECRET",
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "APP_API_TOKEN_PEPPER",
    ];

    this.appSecrets = Object.fromEntries(
      names.map((name) => [
        name,
        new secretsmanager.Secret(this, name, {
          secretName: `${props.prefix}/${name}`,
          generateSecretString: name.endsWith("_SECRET") || name.endsWith("_PEPPER")
            ? { passwordLength: 48, excludePunctuation: true }
            : undefined,
        }),
      ]),
    );
  }
}
