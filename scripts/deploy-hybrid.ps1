param(
  [string]$Stage = "dev",
  [string]$Region = "ap-northeast-1",
  [string]$AwsAccountId = $env:AWS_ACCOUNT_ID,
  [string]$Profile = $env:AWS_PROFILE,
  [string]$AppDomainName,
  [string]$NextAuthUrl,
  [string]$GoogleClientId = $env:GOOGLE_CLIENT_ID,
  [string]$GoogleClientSecret = $env:GOOGLE_CLIENT_SECRET,
  [string]$NextAuthSecret = $env:NEXTAUTH_SECRET,
  [string]$ApiTokenPepper = $env:APP_API_TOKEN_PEPPER,
  [string]$CloudflareTunnelToken = $env:CLOUDFLARE_TUNNEL_TOKEN,
  [string]$StripeSecretKey = $env:STRIPE_SECRET_KEY,
  [string]$StripeWebhookSecret = $env:STRIPE_WEBHOOK_SECRET,
  [string]$StripePricePlus = $env:STRIPE_PRICE_PLUS,
  [string]$StripePricePro = $env:STRIPE_PRICE_PRO,
  [string]$PaymentMode = "mock",
  [string]$ConfirmCreate,
  [switch]$Bootstrap,
  [switch]$SkipImageBuild,
  [switch]$SkipInfra
)

# Hybrid deployment: keeps the CDK network + RDS (managed automated backups) and
# runs the web container plus a Cloudflare Tunnel on a single in-VPC EC2 host.
# There is no load balancer and no inbound port; ingress is via the tunnel.
$ErrorActionPreference = "Stop"

function New-RandomSecret {
  $bytes = New-Object byte[] 32
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  return [Convert]::ToBase64String($bytes)
}

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][scriptblock]$Command
  )
  Write-Host ""
  Write-Host "==> $Label"
  & $Command
  if ($LASTEXITCODE -ne 0) { throw "$Label failed with exit code $LASTEXITCODE" }
}

function Invoke-OptionalAwsText {
  param([Parameter(Mandatory = $true)][scriptblock]$Command)
  $previous = $ErrorActionPreference
  $global:LASTEXITCODE = 0
  try {
    $ErrorActionPreference = "Continue"
    return & $Command 2>$null
  } finally {
    $script:OptionalAwsLastExitCode = $LASTEXITCODE
    $ErrorActionPreference = $previous
  }
}

function Test-DockerAvailable {
  docker version --format "{{.Server.Version}}" | Out-Null
  return $LASTEXITCODE -eq 0
}

function Get-StackOutput {
  param(
    [Parameter(Mandatory = $true)][string]$StackName,
    [Parameter(Mandatory = $true)][string]$OutputKey
  )
  $query = "Stacks[0].Outputs[?OutputKey=='$OutputKey'].OutputValue | [0]"
  return aws @AwsProfileArgs cloudformation describe-stacks `
    --region $Region --stack-name $StackName --query $query --output text
}

function Put-AppSecret {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Value
  )
  aws @AwsProfileArgs secretsmanager put-secret-value `
    --region $Region --secret-id "$Prefix/$Name" --secret-string $Value | Out-Null
}

function Write-JsonTempFile {
  param(
    [Parameter(Mandatory = $true)][object]$Value,
    [Parameter(Mandatory = $true)][string]$Name
  )
  $path = Join-Path ([System.IO.Path]::GetTempPath()) $Name
  $json = $Value | ConvertTo-Json -Depth 20
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($path, $json, $utf8NoBom)
  return $path
}

# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
if ([string]::IsNullOrWhiteSpace($AwsAccountId)) {
  throw "AwsAccountId is required. Pass -AwsAccountId or set AWS_ACCOUNT_ID."
}
if ($ConfirmCreate -ne "create-storycanon-$Stage") {
  throw "Pass -ConfirmCreate `"create-storycanon-$Stage`" to create/update AWS resources."
}
if ([string]::IsNullOrWhiteSpace($GoogleClientId)) {
  throw "GoogleClientId is required. Pass -GoogleClientId or set GOOGLE_CLIENT_ID."
}
if ([string]::IsNullOrWhiteSpace($GoogleClientSecret)) {
  throw "GoogleClientSecret is required. Pass -GoogleClientSecret or set GOOGLE_CLIENT_SECRET."
}
if ([string]::IsNullOrWhiteSpace($CloudflareTunnelToken)) {
  throw "CloudflareTunnelToken is required. Create a tunnel in Cloudflare Zero Trust, then pass -CloudflareTunnelToken or set CLOUDFLARE_TUNNEL_TOKEN."
}
if ([string]::IsNullOrWhiteSpace($NextAuthSecret)) { $NextAuthSecret = New-RandomSecret }
if ([string]::IsNullOrWhiteSpace($ApiTokenPepper)) { $ApiTokenPepper = New-RandomSecret }

$AwsProfileArgs = @()
if (-not [string]::IsNullOrWhiteSpace($Profile)) {
  $AwsProfileArgs += @("--profile", $Profile)
  $env:AWS_PROFILE = $Profile
}

$env:AWS_REGION = $Region
$env:AWS_DEFAULT_REGION = $Region
$env:CDK_DEFAULT_REGION = $Region
$env:CDK_DEFAULT_ACCOUNT = $AwsAccountId

$Prefix = "storycanon-$Stage"
$RepositoryName = "$Prefix-web"
$Registry = "$AwsAccountId.dkr.ecr.$Region.amazonaws.com"
$ImageUri = "$Registry/$RepositoryName`:latest"

if ([string]::IsNullOrWhiteSpace($NextAuthUrl)) {
  if (-not [string]::IsNullOrWhiteSpace($AppDomainName)) {
    $NextAuthUrl = "https://$AppDomainName"
  } else {
    throw "Provide -NextAuthUrl (your Cloudflare public hostname) or -AppDomainName. The tunnel does not auto-generate a URL."
  }
}

Write-Host "StoryCanon hybrid (EC2 + RDS + Cloudflare Tunnel) deployment"
Write-Host "  Stage:          $Stage"
Write-Host "  Region:         $Region"
Write-Host "  Account:        $AwsAccountId"
Write-Host "  Prefix:         $Prefix"
Write-Host "  NEXTAUTH_URL:   $NextAuthUrl"
Write-Host "  Image:          $ImageUri"
Write-Host ""
Write-Warning "This creates/updates billable AWS resources (EC2, RDS, VPC). RDS keeps managed automated backups."

$ActualAccount = aws @AwsProfileArgs sts get-caller-identity --query Account --output text
if ($LASTEXITCODE -ne 0) { throw "aws sts get-caller-identity failed. Configure AWS credentials/profile first." }
if ($ActualAccount -ne $AwsAccountId) {
  throw "AWS account mismatch. Expected $AwsAccountId but current credentials are $ActualAccount."
}

if (-not $SkipImageBuild -and -not (Test-DockerAvailable)) {
  throw "Docker daemon is not available. Start Docker Desktop, or rerun with -SkipImageBuild if $ImageUri is already pushed."
}

# ---------------------------------------------------------------------------
# 1. Infrastructure (network + storage + secrets + database + compute)
# ---------------------------------------------------------------------------
if (-not $SkipInfra) {
  if ($Bootstrap) {
    Invoke-Checked "CDK bootstrap" {
      Push-Location infra
      try { npx cdk bootstrap "aws://$AwsAccountId/$Region" } finally { Pop-Location }
    }
  }

  Invoke-Checked "Build infra package" { npm run build -w infra }
  Invoke-Checked "Build web package" { npm run build -w apps/web }

  $Stacks = @(
    "$Prefix-network",
    "$Prefix-storage",
    "$Prefix-secrets",
    "$Prefix-database",
    "$Prefix-compute"
  )
  Invoke-Checked "Deploy hybrid stacks" {
    Push-Location infra
    try {
      $cdkArgs = @("cdk", "deploy") + $Stacks + @(
        "-c", "stage=$Stage",
        "-c", "region=$Region",
        "--require-approval", "never"
      )
      npx @cdkArgs
    } finally { Pop-Location }
  }
} else {
  Write-Warning "Skipping infrastructure deploy (-SkipInfra). Assuming stacks already exist."
}

# ---------------------------------------------------------------------------
# 2. Read stack outputs
# ---------------------------------------------------------------------------
$DatabaseSecretArn = Get-StackOutput -StackName "$Prefix-database" -OutputKey "DatabaseSecretArn"
$DatabaseEndpoint = Get-StackOutput -StackName "$Prefix-database" -OutputKey "DatabaseEndpoint"
$ExportBucketName = Get-StackOutput -StackName "$Prefix-storage" -OutputKey "ExportBucketName"
$InstanceId = Get-StackOutput -StackName "$Prefix-compute" -OutputKey "InstanceId"

foreach ($value in @($DatabaseSecretArn, $DatabaseEndpoint, $ExportBucketName, $InstanceId)) {
  if ([string]::IsNullOrWhiteSpace($value) -or $value -eq "None") {
    throw "Could not read a required CloudFormation output. Deploy infrastructure first (omit -SkipInfra)."
  }
}

$DbPasswordJson = aws @AwsProfileArgs secretsmanager get-secret-value `
  --region $Region --secret-id $DatabaseSecretArn --query SecretString --output text
if ($LASTEXITCODE -ne 0) { throw "Could not read database password secret." }
$DbPassword = ($DbPasswordJson | ConvertFrom-Json).password
$DatabaseUrl = "postgresql://storycanon:$DbPassword@${DatabaseEndpoint}:5432/storycanon?schema=public"

# ---------------------------------------------------------------------------
# 3. Application secrets
# ---------------------------------------------------------------------------
Invoke-Checked "Update application secrets" {
  Put-AppSecret -Name "DATABASE_URL" -Value $DatabaseUrl
  Put-AppSecret -Name "NEXTAUTH_URL" -Value $NextAuthUrl
  Put-AppSecret -Name "NEXTAUTH_SECRET" -Value $NextAuthSecret
  Put-AppSecret -Name "GOOGLE_CLIENT_ID" -Value $GoogleClientId
  Put-AppSecret -Name "GOOGLE_CLIENT_SECRET" -Value $GoogleClientSecret
  Put-AppSecret -Name "APP_API_TOKEN_PEPPER" -Value $ApiTokenPepper
  Put-AppSecret -Name "CLOUDFLARE_TUNNEL_TOKEN" -Value $CloudflareTunnelToken
  if (-not [string]::IsNullOrWhiteSpace($StripeSecretKey)) { Put-AppSecret -Name "STRIPE_SECRET_KEY" -Value $StripeSecretKey }
  if (-not [string]::IsNullOrWhiteSpace($StripeWebhookSecret)) { Put-AppSecret -Name "STRIPE_WEBHOOK_SECRET" -Value $StripeWebhookSecret }
}

# ---------------------------------------------------------------------------
# 4. ECR repository + image
# ---------------------------------------------------------------------------
$RepositoryExists = Invoke-OptionalAwsText {
  aws @AwsProfileArgs ecr describe-repositories `
    --region $Region --repository-names $RepositoryName `
    --query "repositories[0].repositoryName" --output text
}
if ($OptionalAwsLastExitCode -ne 0 -or $RepositoryExists -ne $RepositoryName) {
  Invoke-Checked "Create ECR repository" {
    aws @AwsProfileArgs ecr create-repository `
      --region $Region --repository-name $RepositoryName `
      --image-scanning-configuration scanOnPush=true | Out-Null
  }
}

if (-not $SkipImageBuild) {
  Invoke-Checked "Login to ECR" {
    aws @AwsProfileArgs ecr get-login-password --region $Region |
      docker login --username AWS --password-stdin $Registry
  }
  # Build for linux/amd64 to match the x86_64 EC2 host (t3.small).
  Invoke-Checked "Build web Docker image" {
    docker build --platform linux/amd64 -f apps/web/Dockerfile -t $ImageUri .
  }
  Invoke-Checked "Push web Docker image" { docker push $ImageUri }
} else {
  Write-Warning "Skipping Docker image build/push. Ensure $ImageUri exists before rollout."
}

# ---------------------------------------------------------------------------
# 5. Roll out on the instance via SSM (agentless; no SSH/inbound needed)
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "==> Wait for instance $InstanceId to register with SSM"
$Online = $false
for ($attempt = 1; $attempt -le 60; $attempt++) {
  $ping = Invoke-OptionalAwsText {
    aws @AwsProfileArgs ssm describe-instance-information `
      --region $Region `
      --filters "Key=InstanceIds,Values=$InstanceId" `
      --query "InstanceInformationList[0].PingStatus" --output text
  }
  if ($OptionalAwsLastExitCode -eq 0 -and $ping -eq "Online") { $Online = $true; break }
  Start-Sleep -Seconds 10
}
if (-not $Online) { throw "Instance $InstanceId did not become SSM-Online. Check the instance and its egress." }

# Read the canonical compose file and ship it to the instance as base64 so no
# quoting is lost. Secrets are fetched on the instance from Secrets Manager and
# never travel through the (logged) SSM command payload.
$ComposePath = Join-Path $PSScriptRoot "..\deploy\docker-compose.yml"
if (-not (Test-Path $ComposePath)) { throw "deploy/docker-compose.yml not found at $ComposePath." }
$ComposeBytes = [System.IO.File]::ReadAllBytes((Resolve-Path $ComposePath))
$ComposeB64 = [Convert]::ToBase64String($ComposeBytes)

$RemoteTemplate = @'
set -euo pipefail
REGION="__REGION__"
PREFIX="__PREFIX__"
REGISTRY="__REGISTRY__"
IMAGE_URI="__IMAGE_URI__"
APP_DIR=/opt/storycanon
mkdir -p "$APP_DIR"
cd "$APP_DIR"

# Wait for user-data bootstrap (docker + compose plugin) on first deploy.
for i in $(seq 1 60); do
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    break
  fi
  echo "waiting for docker to be ready..."
  sleep 5
done

echo "__COMPOSE_B64__" | base64 -d > docker-compose.yml

sec() { aws secretsmanager get-secret-value --region "$REGION" --secret-id "$PREFIX/$1" --query SecretString --output text; }

umask 077
cat > .env <<ENVEOF
IMAGE_URI=$IMAGE_URI
NODE_ENV=production
APP_ENV=$PREFIX
PAYMENT_MODE=__PAYMENT_MODE__
DATABASE_HOST=__DATABASE_HOST__
DATABASE_PORT=5432
EXPORT_BUCKET_NAME=__EXPORT_BUCKET__
STRIPE_PRICE_PLUS=__STRIPE_PRICE_PLUS__
STRIPE_PRICE_PRO=__STRIPE_PRICE_PRO__
DATABASE_URL=$(sec DATABASE_URL)
NEXTAUTH_URL=$(sec NEXTAUTH_URL)
NEXTAUTH_SECRET=$(sec NEXTAUTH_SECRET)
GOOGLE_CLIENT_ID=$(sec GOOGLE_CLIENT_ID)
GOOGLE_CLIENT_SECRET=$(sec GOOGLE_CLIENT_SECRET)
STRIPE_SECRET_KEY=$(sec STRIPE_SECRET_KEY)
STRIPE_WEBHOOK_SECRET=$(sec STRIPE_WEBHOOK_SECRET)
APP_API_TOKEN_PEPPER=$(sec APP_API_TOKEN_PEPPER)
CLOUDFLARE_TUNNEL_TOKEN=$(sec CLOUDFLARE_TUNNEL_TOKEN)
ENVEOF
chmod 600 .env

aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REGISTRY"
docker compose pull
docker compose up -d
docker image prune -f
docker compose ps
'@

$RemoteScript = $RemoteTemplate.
  Replace("__REGION__", $Region).
  Replace("__PREFIX__", $Prefix).
  Replace("__REGISTRY__", $Registry).
  Replace("__IMAGE_URI__", $ImageUri).
  Replace("__PAYMENT_MODE__", $PaymentMode).
  Replace("__DATABASE_HOST__", $DatabaseEndpoint).
  Replace("__EXPORT_BUCKET__", $ExportBucketName).
  Replace("__STRIPE_PRICE_PLUS__", $StripePricePlus).
  Replace("__STRIPE_PRICE_PRO__", $StripePricePro).
  Replace("__COMPOSE_B64__", $ComposeB64)

$RemoteB64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($RemoteScript))
$Command = "echo $RemoteB64 | base64 -d | sudo bash"
$ParamsPath = Write-JsonTempFile -Value @{ commands = @($Command) } -Name "$Prefix-ssm-params.json"

Write-Host ""
Write-Host "==> Send rollout command via SSM"
$CommandId = aws @AwsProfileArgs ssm send-command `
  --region $Region `
  --instance-ids $InstanceId `
  --document-name "AWS-RunShellScript" `
  --comment "StoryCanon hybrid rollout" `
  --parameters "file://$ParamsPath" `
  --query "Command.CommandId" --output text
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($CommandId)) {
  throw "Failed to send SSM command."
}

Write-Host "SSM command: $CommandId (polling for completion)"
$Status = "Pending"
for ($attempt = 1; $attempt -le 120; $attempt++) {
  Start-Sleep -Seconds 10
  $Status = Invoke-OptionalAwsText {
    aws @AwsProfileArgs ssm get-command-invocation `
      --region $Region --command-id $CommandId --instance-id $InstanceId `
      --query "Status" --output text
  }
  if ($OptionalAwsLastExitCode -ne 0) { continue }
  if ($Status -in @("Success", "Failed", "Cancelled", "TimedOut")) { break }
  Write-Host "  status: $Status"
}

$StdOut = Invoke-OptionalAwsText {
  aws @AwsProfileArgs ssm get-command-invocation `
    --region $Region --command-id $CommandId --instance-id $InstanceId `
    --query "StandardOutputContent" --output text
}
$StdErr = Invoke-OptionalAwsText {
  aws @AwsProfileArgs ssm get-command-invocation `
    --region $Region --command-id $CommandId --instance-id $InstanceId `
    --query "StandardErrorContent" --output text
}
if ($StdOut) { Write-Host "----- rollout stdout -----"; Write-Host $StdOut }
if ($StdErr) { Write-Host "----- rollout stderr -----"; Write-Host $StdErr }

if ($Status -ne "Success") {
  throw "Rollout command finished with status '$Status'. See output above and CloudWatch/SSM for details."
}

Write-Host ""
Write-Host "Hybrid deployment finished."
Write-Host "  App URL:   $NextAuthUrl  (served through Cloudflare Tunnel)"
Write-Host "  Instance:  $InstanceId"
Write-Host "  Database:  $DatabaseEndpoint  (RDS automated backups retained)"
Write-Host ""
Write-Host "Point your Cloudflare Tunnel public hostname at http://web:3000 (or the instance's localhost:3000)."
Write-Host "Prisma migrations run automatically on container startup."
Write-Warning "When finished, run scripts/delete-aws-dev.ps1 to remove billable resources."
