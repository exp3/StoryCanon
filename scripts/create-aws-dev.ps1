param(
  [string]$Stage = "dev",
  [string]$Region = "ap-northeast-1",
  [string]$AwsAccountId = $env:AWS_ACCOUNT_ID,
  [string]$Profile = $env:AWS_PROFILE,
  [string]$HostedZoneName,
  [string]$AppDomainName,
  [string]$NextAuthUrl,
  [string]$GoogleClientId = $env:GOOGLE_CLIENT_ID,
  [string]$GoogleClientSecret = $env:GOOGLE_CLIENT_SECRET,
  [string]$NextAuthSecret = $env:NEXTAUTH_SECRET,
  [string]$ApiTokenPepper = $env:APP_API_TOKEN_PEPPER,
  [string]$ConfirmCreate,
  [switch]$Bootstrap,
  [switch]$SkipImageBuild,
  [switch]$AllowLegacyAppRunner
)

$ErrorActionPreference = "Stop"

if (-not $AllowLegacyAppRunner) {
  throw "App Runner is no longer recommended for new environments. Use scripts/create-aws-dev-ecs-express.ps1 instead. Pass -AllowLegacyAppRunner only if this AWS account can still create new App Runner services."
}

function New-RandomSecret {
  $bytes = New-Object byte[] 32
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $rng.GetBytes($bytes)
  } finally {
    $rng.Dispose()
  }
  return [Convert]::ToBase64String($bytes)
}

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Label,
    [Parameter(Mandatory = $true)]
    [scriptblock]$Command
  )

  Write-Host ""
  Write-Host "==> $Label"
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "$Label failed with exit code $LASTEXITCODE"
  }
}

function Get-StackOutput {
  param(
    [Parameter(Mandatory = $true)]
    [string]$StackName,
    [Parameter(Mandatory = $true)]
    [string]$OutputKey
  )

  $query = "Stacks[0].Outputs[?OutputKey=='$OutputKey'].OutputValue | [0]"
  return aws @AwsProfileArgs cloudformation describe-stacks `
    --region $Region `
    --stack-name $StackName `
    --query $query `
    --output text
}

function Put-AppSecret {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [Parameter(Mandatory = $true)]
    [string]$Value
  )

  aws @AwsProfileArgs secretsmanager put-secret-value `
    --region $Region `
    --secret-id "$Prefix/$Name" `
    --secret-string $Value | Out-Null
}

if ($Stage -eq "prod") {
  throw "This script is intended for disposable verification environments. Refusing Stage=prod."
}

if ([string]::IsNullOrWhiteSpace($AwsAccountId)) {
  throw "AwsAccountId is required. Pass -AwsAccountId or set AWS_ACCOUNT_ID."
}

if ($ConfirmCreate -ne "create-storycanon-$Stage") {
  throw "Pass -ConfirmCreate `"create-storycanon-$Stage`" to create AWS resources."
}

if ([string]::IsNullOrWhiteSpace($GoogleClientId)) {
  throw "GoogleClientId is required. Pass -GoogleClientId or set GOOGLE_CLIENT_ID."
}

if ([string]::IsNullOrWhiteSpace($GoogleClientSecret)) {
  throw "GoogleClientSecret is required. Pass -GoogleClientSecret or set GOOGLE_CLIENT_SECRET."
}

if ([string]::IsNullOrWhiteSpace($NextAuthSecret)) {
  $NextAuthSecret = New-RandomSecret
}

if ([string]::IsNullOrWhiteSpace($ApiTokenPepper)) {
  $ApiTokenPepper = New-RandomSecret
}

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
    $UpdateNextAuthToAppRunnerUrl = $false
  } else {
    $NextAuthUrl = "https://pending-$Prefix.invalid"
    $UpdateNextAuthToAppRunnerUrl = $true
  }
} else {
  $UpdateNextAuthToAppRunnerUrl = $false
}

Write-Host "StoryCanon verification environment creation"
Write-Host "  Stage:          $Stage"
Write-Host "  Region:         $Region"
Write-Host "  Account:        $AwsAccountId"
Write-Host "  Prefix:         $Prefix"
Write-Host "  NEXTAUTH_URL:   $NextAuthUrl"
Write-Host "  Image:          $ImageUri"
Write-Host ""
Write-Warning "This creates billable AWS resources. Run scripts/delete-aws-dev.ps1 after verification."

$ActualAccount = aws @AwsProfileArgs sts get-caller-identity --query Account --output text
if ($LASTEXITCODE -ne 0) {
  throw "aws sts get-caller-identity failed. Configure AWS credentials/profile first."
}

if ($ActualAccount -ne $AwsAccountId) {
  throw "AWS account mismatch. Expected $AwsAccountId but current credentials are $ActualAccount."
}

if ($Bootstrap) {
  Invoke-Checked "CDK bootstrap" {
    Push-Location infra
    try {
      npx cdk bootstrap "aws://$AwsAccountId/$Region"
    } finally {
      Pop-Location
    }
  }
}

Invoke-Checked "Build infra package" {
  npm run build -w infra
}

Invoke-Checked "Build web package" {
  npm run build -w apps/web
}

$BaseStacks = @(
  "$Prefix-network",
  "$Prefix-storage",
  "$Prefix-secrets",
  "$Prefix-database"
)

Invoke-Checked "Deploy base stacks" {
  Push-Location infra
  try {
    $args = @("cdk", "deploy") + $BaseStacks + @(
      "-c", "stage=$Stage",
      "-c", "region=$Region",
      "--require-approval", "never"
    )
    npx @args
  } finally {
    Pop-Location
  }
}

$DatabaseSecretArn = Get-StackOutput -StackName "$Prefix-database" -OutputKey "DatabaseSecretArn"
$DatabaseEndpoint = Get-StackOutput -StackName "$Prefix-database" -OutputKey "DatabaseEndpoint"

if ([string]::IsNullOrWhiteSpace($DatabaseSecretArn) -or $DatabaseSecretArn -eq "None") {
  throw "Could not read DatabaseSecretArn from $Prefix-database."
}

if ([string]::IsNullOrWhiteSpace($DatabaseEndpoint) -or $DatabaseEndpoint -eq "None") {
  throw "Could not read DatabaseEndpoint from $Prefix-database."
}

$DbPasswordJson = aws @AwsProfileArgs secretsmanager get-secret-value `
  --region $Region `
  --secret-id $DatabaseSecretArn `
  --query SecretString `
  --output text

if ($LASTEXITCODE -ne 0) {
  throw "Could not read database password secret."
}

$DbPassword = ($DbPasswordJson | ConvertFrom-Json).password
$DatabaseUrl = "postgresql://storycanon:$DbPassword@${DatabaseEndpoint}:5432/storycanon?schema=public"

Invoke-Checked "Update application secrets" {
  Put-AppSecret -Name "DATABASE_URL" -Value $DatabaseUrl
  Put-AppSecret -Name "NEXTAUTH_URL" -Value $NextAuthUrl
  Put-AppSecret -Name "NEXTAUTH_SECRET" -Value $NextAuthSecret
  Put-AppSecret -Name "GOOGLE_CLIENT_ID" -Value $GoogleClientId
  Put-AppSecret -Name "GOOGLE_CLIENT_SECRET" -Value $GoogleClientSecret
  Put-AppSecret -Name "APP_API_TOKEN_PEPPER" -Value $ApiTokenPepper
}

$RepoExists = $true
aws @AwsProfileArgs ecr describe-repositories --region $Region --repository-names $RepositoryName | Out-Null
if ($LASTEXITCODE -ne 0) {
  $RepoExists = $false
}

if (-not $RepoExists) {
  Invoke-Checked "Create ECR repository" {
    aws @AwsProfileArgs ecr create-repository `
      --region $Region `
      --repository-name $RepositoryName `
      --image-scanning-configuration scanOnPush=true | Out-Null
  }
}

if (-not $SkipImageBuild) {
  Invoke-Checked "Login to ECR" {
    aws @AwsProfileArgs ecr get-login-password --region $Region |
      docker login --username AWS --password-stdin $Registry
  }

  Invoke-Checked "Build web Docker image" {
    docker build -f apps/web/Dockerfile -t $ImageUri .
  }

  Invoke-Checked "Push web Docker image" {
    docker push $ImageUri
  }
} else {
  Write-Warning "Skipping Docker image build/push. Ensure $ImageUri exists before deploying App Runner."
}

$AppDeployContext = @(
  "-c", "stage=$Stage",
  "-c", "region=$Region",
  "-c", "useExistingEcrRepository=true"
)

Invoke-Checked "Deploy App Runner stack" {
  Push-Location infra
  try {
    $args = @("cdk", "deploy", "$Prefix-app") + $AppDeployContext + @("--require-approval", "never")
    npx @args
  } finally {
    Pop-Location
  }
}

if (-not [string]::IsNullOrWhiteSpace($HostedZoneName) -and -not [string]::IsNullOrWhiteSpace($AppDomainName)) {
  Invoke-Checked "Deploy DNS/custom domain stack" {
    Push-Location infra
    try {
      $args = @(
        "cdk", "deploy", "$Prefix-dns",
        "-c", "stage=$Stage",
        "-c", "region=$Region",
        "-c", "useExistingEcrRepository=true",
        "-c", "hostedZoneName=$HostedZoneName",
        "-c", "appDomainName=$AppDomainName",
        "--require-approval", "never"
      )
      npx @args
    } finally {
      Pop-Location
    }
  }
}

$ServiceArn = aws @AwsProfileArgs apprunner list-services `
  --region $Region `
  --query "ServiceSummaryList[?ServiceName=='$Prefix-app'].ServiceArn | [0]" `
  --output text

if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($ServiceArn) -or $ServiceArn -eq "None") {
  throw "Could not resolve App Runner service ARN for $Prefix-app."
}

$ServiceUrl = aws @AwsProfileArgs apprunner describe-service `
  --region $Region `
  --service-arn $ServiceArn `
  --query Service.ServiceUrl `
  --output text

if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($ServiceUrl) -or $ServiceUrl -eq "None") {
  throw "Could not resolve App Runner service URL."
}

$ResolvedAppUrl = "https://$ServiceUrl"

if ($UpdateNextAuthToAppRunnerUrl) {
  Invoke-Checked "Update NEXTAUTH_URL to App Runner URL" {
    Put-AppSecret -Name "NEXTAUTH_URL" -Value $ResolvedAppUrl
    aws @AwsProfileArgs apprunner start-deployment `
      --region $Region `
      --service-arn $ServiceArn | Out-Null
  }
}

Write-Host ""
Write-Host "Creation finished."
Write-Host "  App Runner URL: $ResolvedAppUrl"
if (-not [string]::IsNullOrWhiteSpace($AppDomainName)) {
  Write-Host "  Custom domain:  https://$AppDomainName"
}
Write-Host "  Database:       $DatabaseEndpoint"
Write-Host ""
Write-Warning "Prisma migrations are NOT applied automatically. The container CMD no longer runs 'prisma migrate deploy' - only scripts/deploy-bluegreen.sh applies migrations, as a one-off ECS task. This environment starts with whatever schema its database already has."
Write-Host "Check App Runner logs if the service does not become healthy."
Write-Warning "After verification, run scripts/delete-aws-dev.ps1 to remove billable resources."
