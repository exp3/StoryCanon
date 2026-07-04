# StoryCanon AWS infrastructure

StoryCanon is prepared for AWS deployment with CDK v2 TypeScript.

## Stacks

- `NetworkStack`: VPC, public/private subnets, App Runner security group.
- `DatabaseStack`: single-AZ encrypted RDS PostgreSQL in private subnets.
- `StorageStack`: private S3 bucket for Markdown/JSON export artifacts.
- `SecretsStack`: application secrets used by App Runner.
- `AppRunnerStack`: ECR repository, App Runner service, VPC connector.
- `DnsStack`: optional App Runner custom domain association.

## Synthesis

```powershell
npm install
npm run build -w infra
cd infra
npx cdk synth -c stage=dev
```

## Deployment outline

Do not run these until you are ready to create AWS resources.

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

Build and push the web image, then start an App Runner deployment:

```powershell
.\scripts\deploy-app-runner.ps1 -Stage dev -Region ap-northeast-1 -AwsAccountId "<account-id>"
```

Run migrations from a trusted environment with access to the database:

```powershell
npm run prisma:deploy -w apps/web
```
