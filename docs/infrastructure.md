# StoryCanon AWS infrastructure

StoryCanon is prepared for AWS deployment with CDK v2 TypeScript.

## Stacks

- `NetworkStack`: VPC, public subnets for ECS Express ingress, isolated private subnets for RDS, application security group.
- `DatabaseStack`: single-AZ encrypted RDS PostgreSQL in isolated private subnets.
- `StorageStack`: private S3 bucket for Markdown/JSON export artifacts.
- `SecretsStack`: application secrets used by the container runtime.
- `AppRunnerStack`: legacy App Runner service definition. Do not use for new verification environments unless the AWS account can still create App Runner services.
- `DnsStack`: legacy App Runner custom domain association.

## Runtime target

AWS App Runner is no longer available to new customers after 2026-04-30. Existing customers can continue using it, but AWS recommends Amazon ECS Express Mode for containerized applications.

StoryCanon verification environments should therefore use ECS Express Mode. The legacy App Runner script is guarded and requires `-AllowLegacyAppRunner`.

## Synthesis

```powershell
npm install
npm run build -w infra
cd infra
npx cdk synth -c stage=dev
```

## Deployment outline

Do not run these until you are ready to create AWS resources.

For a disposable verification environment, use the ECS Express Mode creation script:

```powershell
$env:GOOGLE_CLIENT_ID = "<google-oauth-client-id>"
$env:GOOGLE_CLIENT_SECRET = "<google-oauth-client-secret>"

.\scripts\create-aws-dev-ecs-express.ps1 `
  -Stage dev `
  -Region ap-northeast-1 `
  -AwsAccountId "199041707218" `
  -Profile "<aws-profile>" `
  -ConfirmCreate "create-storycanon-dev"
```

If CDK has not been bootstrapped in the target account/region, add `-Bootstrap`.

If you use a custom domain, pass both values:

```powershell
.\scripts\create-aws-dev-ecs-express.ps1 `
  -Stage dev `
  -Region ap-northeast-1 `
  -AwsAccountId "199041707218" `
  -Profile "<aws-profile>" `
  -AppDomainName "storycanon-dev.example.com" `
  -ConfirmCreate "create-storycanon-dev"
```

If you change immutable ECS Express settings such as subnet type, recreate the service in place:

```powershell
.\scripts\create-aws-dev-ecs-express.ps1 `
  -Stage dev `
  -Region ap-northeast-1 `
  -AwsAccountId "199041707218" `
  -Profile "<aws-profile>" `
  -ConfirmCreate "create-storycanon-dev" `
  -SkipImageBuild `
  -RecreateService
```

Required inputs:

- AWS account ID and authenticated AWS profile.
- Google OAuth client ID and client secret.
- Optional custom domain input: app domain name. Route53/ALB custom domain wiring for ECS Express Mode may still require manual console work or a follow-up script.
- Google OAuth redirect URI for the final URL: `https://<app-url>/api/auth/callback/google`.

The creation script deploys network, storage, secrets, database, ECR image, IAM roles, and ECS Express Mode. It also sets `PAYMENT_MODE=mock` and writes application secrets.

Prisma migrations are applied automatically on container startup by running `prisma migrate deploy` before `node apps/web/server.js`. Because ECS Express Mode tasks are connected to the VPC, they can reach the private RDS endpoint.

RDS PostgreSQL uses major version `16` instead of a fixed minor version. This avoids deployment failures when a specific minor version is unavailable in the target region.

ECS Express Mode health checks use `/api/health`, which returns a lightweight JSON response and does not touch the database.

The ECS Express service is placed in the VPC public subnets so the generated `.on.aws` endpoint resolves publicly. The application can still reach the private RDS endpoint through VPC local routing and the database security group rule.

For dev verification environments, the VPC intentionally uses `natGateways: 0`. The application runtime sits in public subnets, while RDS sits in isolated private subnets. This removes recurring NAT Gateway charges and makes teardown simpler.

Manual CDK deployment is still possible:

```powershell
cd infra
npx cdk deploy "storycanon-dev-*" -c stage=dev
```

After RDS is created, update the application `DATABASE_URL` secret. Use the endpoint and generated DB password from the stack outputs and RDS secret.

```powershell
$stage = "dev"
$region = "ap-northeast-1"
$dbPassword = aws secretsmanager get-secret-value `
  --region $region `
  --secret-id "<DatabaseSecretArn>" `
  --query SecretString `
  --output text | ConvertFrom-Json | Select-Object -ExpandProperty password

$databaseUrl = "postgresql://storycanon:$dbPassword@<DatabaseEndpoint>:5432/storycanon?schema=public"
aws secretsmanager put-secret-value `
  --region $region `
  --secret-id "storycanon-$stage/DATABASE_URL" `
  --secret-string $databaseUrl
```

Legacy App Runner deployment is still possible only for accounts that can create App Runner services:

```powershell
.\scripts\create-aws-dev.ps1 -Stage dev -Region ap-northeast-1 -AwsAccountId "<account-id>" -ConfirmCreate "create-storycanon-dev" -AllowLegacyAppRunner
```

For local or separately managed environments, migrations can still be run manually from a trusted environment with access to the database:

```powershell
npm run prisma:deploy -w apps/web
```

## Stop dev runtime

Use this when you want to pause the runtime after a short test but keep the CloudFormation stacks and data.

```powershell
.\scripts\stop-aws-dev.ps1 -Stage dev -Region ap-northeast-1
```

This pauses legacy App Runner and stops the RDS instance when possible.

Important: ECS Express Mode, ALB, VPC resources, and other supporting resources cannot be fully "stopped" by this script and may continue to incur charges. For dev verification, prefer full deletion after testing.

## Delete dev environment

Use this when the AWS test environment is no longer needed.

```powershell
.\scripts\delete-aws-dev.ps1 -Stage dev -Region ap-northeast-1 -ConfirmDestroy "delete-storycanon-dev"
```

To also remove the retained ECR repository:

```powershell
.\scripts\delete-aws-dev.ps1 -Stage dev -Region ap-northeast-1 -ConfirmDestroy "delete-storycanon-dev" -DestroyRetainedEcr
```

The delete script refuses to operate on `prod` unless `-AllowProd` is passed. After deletion, check CloudFormation, ECS Express Mode, RDS, VPC, ECR, S3, and Secrets Manager for leftovers. Older environments created before the NAT removal change may still leave a NAT Gateway behind if stack deletion fails midway.
