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
  [string]$ConfirmCreate,
  [switch]$Bootstrap,
  [switch]$SkipImageBuild,
  [switch]$RecreateService
)

$ErrorActionPreference = "Stop"

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

function Invoke-OptionalAwsText {
  param(
    [Parameter(Mandatory = $true)]
    [scriptblock]$Command
  )

  $previousErrorActionPreference = $ErrorActionPreference
  $global:LASTEXITCODE = 0
  try {
    $ErrorActionPreference = "Continue"
    return & $Command 2>$null
  } finally {
    $script:OptionalAwsLastExitCode = $LASTEXITCODE
    $ErrorActionPreference = $previousErrorActionPreference
  }
}

function Test-DockerAvailable {
  docker version --format "{{.Server.Version}}" | Out-Null
  return $LASTEXITCODE -eq 0
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

function Write-JsonTempFile {
  param(
    [Parameter(Mandatory = $true)]
    [object]$Value,
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  $path = Join-Path ([System.IO.Path]::GetTempPath()) $Name
  $json = $Value | ConvertTo-Json -Depth 20
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($path, $json, $utf8NoBom)
  return $path
}

function Ensure-Role {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RoleName,
    [Parameter(Mandatory = $true)]
    [object]$TrustPolicy
  )

  $roleArn = Invoke-OptionalAwsText {
    aws @AwsProfileArgs iam get-role `
      --role-name $RoleName `
      --query "Role.Arn" `
      --output text
  }

  if ($OptionalAwsLastExitCode -eq 0 -and $roleArn -and $roleArn -ne "None") {
    return $roleArn
  }

  $trustPath = Write-JsonTempFile -Value $TrustPolicy -Name "$RoleName-trust.json"
  $createdRoleArn = aws @AwsProfileArgs iam create-role `
    --role-name $RoleName `
    --assume-role-policy-document "file://$trustPath" `
    --query "Role.Arn" `
    --output text

  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($createdRoleArn) -or $createdRoleArn -eq "None") {
    throw "Failed to create IAM role $RoleName."
  }

  return $createdRoleArn
}

function Wait-RoleExists {
  param(
    [Parameter(Mandatory = $true)]
    [string]$RoleName
  )

  for ($attempt = 1; $attempt -le 12; $attempt++) {
    $roleArn = Invoke-OptionalAwsText {
      aws @AwsProfileArgs iam get-role `
        --role-name $RoleName `
        --query "Role.Arn" `
        --output text
    }

    if ($OptionalAwsLastExitCode -eq 0 -and $roleArn -and $roleArn -ne "None") {
      return
    }

    Start-Sleep -Seconds 5
  }

  throw "IAM role $RoleName was not visible after waiting."
}

function Ensure-EcsServiceLinkedRole {
  $roleName = "AWSServiceRoleForECS"
  $roleArn = Invoke-OptionalAwsText {
    aws @AwsProfileArgs iam get-role `
      --role-name $roleName `
      --query "Role.Arn" `
      --output text
  }

  if ($OptionalAwsLastExitCode -eq 0 -and $roleArn -and $roleArn -ne "None") {
    return
  }

  Write-Host "Creating ECS service-linked role $roleName."
  aws @AwsProfileArgs iam create-service-linked-role `
    --aws-service-name ecs.amazonaws.com `
    --description "Service-linked role for Amazon ECS" | Out-Null

  if ($LASTEXITCODE -ne 0) {
    throw "Failed to create ECS service-linked role $roleName."
  }

  Wait-RoleExists -RoleName $roleName
}

function Wait-ExpressServiceDeleted {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ServiceArn
  )

  for ($attempt = 1; $attempt -le 24; $attempt++) {
    $status = Invoke-OptionalAwsText {
      aws @AwsProfileArgs ecs describe-express-gateway-service `
        --region $Region `
        --service-arn $ServiceArn `
        --query "service.status.statusCode" `
        --output text
    }

    if ($OptionalAwsLastExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($status) -or $status -eq "None") {
      return
    }

    Start-Sleep -Seconds 10
  }

  throw "ECS Express service $ServiceArn was not deleted after waiting."
}

function New-ExpressGatewayService {
  aws @AwsProfileArgs ecs create-express-gateway-service `
    --region $Region `
    --cluster default `
    --service-name $ServiceName `
    --execution-role-arn $ExecutionRoleArn `
    --infrastructure-role-arn $InfrastructureRoleArn `
    --task-role-arn $TaskRoleArn `
    --primary-container "file://$PrimaryContainerPath" `
    --network-configuration "file://$NetworkConfigurationPath" `
    --cpu "256" `
    --memory "512" `
    --scaling-target "file://$ScalingTargetPath" `
    --health-check-path "/api/health" `
    --monitor-resources DEPLOYMENT `
    --monitor-mode TEXT-ONLY | Out-Host
}

function Update-ExpressGatewayService {
  aws @AwsProfileArgs ecs update-express-gateway-service `
    --region $Region `
    --service-arn $ServiceArn `
    --execution-role-arn $ExecutionRoleArn `
    --task-role-arn $TaskRoleArn `
    --primary-container "file://$PrimaryContainerPath" `
    --network-configuration "file://$NetworkConfigurationPath" `
    --cpu "256" `
    --memory "512" `
    --scaling-target "file://$ScalingTargetPath" `
    --health-check-path "/api/health" `
    --monitor-resources DEPLOYMENT `
    --monitor-mode TEXT-ONLY | Out-Host
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
$ServiceName = "$Prefix-app"
$RepositoryName = "$Prefix-web"
$Registry = "$AwsAccountId.dkr.ecr.$Region.amazonaws.com"
$ImageUri = "$Registry/$RepositoryName`:latest"
$PredictedExpressUrl = "https://$ServiceName.ecs.$Region.on.aws"

if ([string]::IsNullOrWhiteSpace($NextAuthUrl)) {
  if (-not [string]::IsNullOrWhiteSpace($AppDomainName)) {
    $NextAuthUrl = "https://$AppDomainName"
  } else {
    $NextAuthUrl = $PredictedExpressUrl
  }
}

Write-Host "StoryCanon ECS Express Mode verification environment creation"
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

if (-not $SkipImageBuild -and -not (Test-DockerAvailable)) {
  throw "Docker daemon is not available. Start Docker Desktop Linux engine, then rerun this script. If the image is already pushed to ECR as ${ImageUri}, rerun with -SkipImageBuild."
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
$AppSecurityGroupId = Get-StackOutput -StackName "$Prefix-network" -OutputKey "AppSecurityGroupId"
$PublicSubnetIds = Get-StackOutput -StackName "$Prefix-network" -OutputKey "PublicSubnetIds"
$ExportBucketName = Get-StackOutput -StackName "$Prefix-storage" -OutputKey "ExportBucketName"

foreach ($value in @($DatabaseSecretArn, $DatabaseEndpoint, $AppSecurityGroupId, $PublicSubnetIds, $ExportBucketName)) {
  if ([string]::IsNullOrWhiteSpace($value) -or $value -eq "None") {
    throw "Could not read required CloudFormation output."
  }
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

$RepositoryExists = Invoke-OptionalAwsText {
  aws @AwsProfileArgs ecr describe-repositories `
    --region $Region `
    --repository-names $RepositoryName `
    --query "repositories[0].repositoryName" `
    --output text
}

if ($OptionalAwsLastExitCode -ne 0 -or $RepositoryExists -ne $RepositoryName) {
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
  Write-Warning "Skipping Docker image build/push. Ensure $ImageUri exists before creating ECS Express service."
}

$TaskTrust = @{
  Version = "2012-10-17"
  Statement = @(@{
    Effect = "Allow"
    Principal = @{ Service = "ecs-tasks.amazonaws.com" }
    Action = "sts:AssumeRole"
  })
}

$InfrastructureTrust = @{
  Version = "2012-10-17"
  Statement = @(@{
    Sid = "AllowAccessInfrastructureForECSExpressServices"
    Effect = "Allow"
    Principal = @{ Service = "ecs.amazonaws.com" }
    Action = "sts:AssumeRole"
  })
}

$ExecutionRoleName = "$Prefix-ecs-execution-role"
$InfrastructureRoleName = "$Prefix-ecs-infra-role"
$TaskRoleName = "$Prefix-ecs-task-role"

$ExecutionRoleArn = Ensure-Role -RoleName $ExecutionRoleName -TrustPolicy $TaskTrust
$InfrastructureRoleArn = Ensure-Role -RoleName $InfrastructureRoleName -TrustPolicy $InfrastructureTrust
$TaskRoleArn = Ensure-Role -RoleName $TaskRoleName -TrustPolicy $TaskTrust

Ensure-EcsServiceLinkedRole
Wait-RoleExists -RoleName $ExecutionRoleName
Wait-RoleExists -RoleName $InfrastructureRoleName
Wait-RoleExists -RoleName $TaskRoleName

Invoke-Checked "Attach ECS managed role policies" {
  aws @AwsProfileArgs iam attach-role-policy `
    --role-name $ExecutionRoleName `
    --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy | Out-Null

  aws @AwsProfileArgs iam attach-role-policy `
    --role-name $InfrastructureRoleName `
    --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSInfrastructureRoleforExpressGatewayServices | Out-Null
}

$SecretsArnPrefix = "arn:aws:secretsmanager:${Region}:${AwsAccountId}:secret:$Prefix/*"
$ExecutionInlinePolicy = @{
  Version = "2012-10-17"
  Statement = @(@{
    Effect = "Allow"
    Action = @("secretsmanager:GetSecretValue")
    Resource = @($SecretsArnPrefix)
  })
}
$ExecutionPolicyPath = Write-JsonTempFile -Value $ExecutionInlinePolicy -Name "$ExecutionRoleName-inline.json"

$TaskInlinePolicy = @{
  Version = "2012-10-17"
  Statement = @(@{
    Effect = "Allow"
    Action = @("s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket")
    Resource = @("arn:aws:s3:::$ExportBucketName", "arn:aws:s3:::$ExportBucketName/*")
  })
}
$TaskPolicyPath = Write-JsonTempFile -Value $TaskInlinePolicy -Name "$TaskRoleName-inline.json"

$InfrastructureInlinePolicy = @{
  Version = "2012-10-17"
  Statement = @(@{
    Effect = "Allow"
    Action = @("ec2:DescribeAccountAttributes")
    Resource = "*"
  })
}
$InfrastructurePolicyPath = Write-JsonTempFile -Value $InfrastructureInlinePolicy -Name "$InfrastructureRoleName-inline.json"

Invoke-Checked "Attach StoryCanon inline role policies" {
  aws @AwsProfileArgs iam put-role-policy `
    --role-name $ExecutionRoleName `
    --policy-name "$Prefix-secrets-access" `
    --policy-document "file://$ExecutionPolicyPath" | Out-Null

  aws @AwsProfileArgs iam put-role-policy `
    --role-name $TaskRoleName `
    --policy-name "$Prefix-runtime-access" `
    --policy-document "file://$TaskPolicyPath" | Out-Null

  aws @AwsProfileArgs iam put-role-policy `
    --role-name $InfrastructureRoleName `
    --policy-name "$Prefix-ecs-express-infra-describe" `
    --policy-document "file://$InfrastructurePolicyPath" | Out-Null
}

Start-Sleep -Seconds 10

$PrimaryContainer = @{
  image = $ImageUri
  containerPort = 3000
  awsLogsConfiguration = @{
    logGroup = "/ecs/$Prefix"
    logStreamPrefix = "web"
  }
  environment = @(
    @{ name = "NODE_ENV"; value = "production" },
    @{ name = "APP_ENV"; value = $Prefix },
    @{ name = "PAYMENT_MODE"; value = "mock" },
    @{ name = "DATABASE_HOST"; value = $DatabaseEndpoint },
    @{ name = "DATABASE_PORT"; value = "5432" },
    @{ name = "EXPORT_BUCKET_NAME"; value = $ExportBucketName }
  )
  secrets = @(
    @{ name = "DATABASE_URL"; valueFrom = "arn:aws:secretsmanager:${Region}:${AwsAccountId}:secret:$Prefix/DATABASE_URL" },
    @{ name = "NEXTAUTH_URL"; valueFrom = "arn:aws:secretsmanager:${Region}:${AwsAccountId}:secret:$Prefix/NEXTAUTH_URL" },
    @{ name = "NEXTAUTH_SECRET"; valueFrom = "arn:aws:secretsmanager:${Region}:${AwsAccountId}:secret:$Prefix/NEXTAUTH_SECRET" },
    @{ name = "GOOGLE_CLIENT_ID"; valueFrom = "arn:aws:secretsmanager:${Region}:${AwsAccountId}:secret:$Prefix/GOOGLE_CLIENT_ID" },
    @{ name = "GOOGLE_CLIENT_SECRET"; valueFrom = "arn:aws:secretsmanager:${Region}:${AwsAccountId}:secret:$Prefix/GOOGLE_CLIENT_SECRET" },
    @{ name = "APP_API_TOKEN_PEPPER"; valueFrom = "arn:aws:secretsmanager:${Region}:${AwsAccountId}:secret:$Prefix/APP_API_TOKEN_PEPPER" }
  )
}
$PrimaryContainerPath = Write-JsonTempFile -Value $PrimaryContainer -Name "$Prefix-primary-container.json"

$NetworkConfiguration = @{
  securityGroups = @($AppSecurityGroupId)
  subnets = @($PublicSubnetIds.Split(","))
}
$NetworkConfigurationPath = Write-JsonTempFile -Value $NetworkConfiguration -Name "$Prefix-network-config.json"

$ScalingTarget = @{
  minTaskCount = 1
  maxTaskCount = 1
  autoScalingMetric = "AVERAGE_CPU"
  autoScalingTargetValue = 60
}
$ScalingTargetPath = Write-JsonTempFile -Value $ScalingTarget -Name "$Prefix-scaling-target.json"

$ServiceArn = "arn:aws:ecs:${Region}:${AwsAccountId}:service/default/$ServiceName"
$ServiceStatus = Invoke-OptionalAwsText {
  aws @AwsProfileArgs ecs describe-express-gateway-service `
    --region $Region `
    --service-arn $ServiceArn `
    --query "service.status.statusCode" `
    --output text
}

if ($OptionalAwsLastExitCode -eq 0 -and $ServiceStatus -and $ServiceStatus -ne "None") {
  if ($RecreateService) {
    Invoke-Checked "Delete existing ECS Express Mode service" {
      aws @AwsProfileArgs ecs delete-express-gateway-service `
        --region $Region `
        --service-arn $ServiceArn `
        --monitor-resources RESOURCE `
        --monitor-mode TEXT-ONLY | Out-Host
    }
    Wait-ExpressServiceDeleted -ServiceArn $ServiceArn

    Invoke-Checked "Create ECS Express Mode service" {
      New-ExpressGatewayService
    }
  } else {
    $UpdateOutput = Invoke-OptionalAwsText {
      Update-ExpressGatewayService 2>&1
    }

    if ($OptionalAwsLastExitCode -eq 0) {
      Write-Host ""
      Write-Host "==> Update ECS Express Mode service"
      if ($UpdateOutput) {
        $UpdateOutput | Out-Host
      }
    } else {
      $UpdateText = [string]::Join([Environment]::NewLine, @($UpdateOutput))
      if ($UpdateText -match "Resource not found") {
        Write-Warning "Existing ECS Express service ARN was stale. Falling back to create."
        Invoke-Checked "Create ECS Express Mode service" {
          New-ExpressGatewayService
        }
      } else {
        Write-Host ""
        Write-Host "==> Update ECS Express Mode service"
        if ($UpdateOutput) {
          $UpdateOutput | Out-Host
        }
        throw "Update ECS Express Mode service failed with exit code $OptionalAwsLastExitCode"
      }
    }
  }
} else {
  Invoke-Checked "Create ECS Express Mode service" {
    New-ExpressGatewayService
  }
}

$ResolvedEndpoint = aws @AwsProfileArgs ecs describe-express-gateway-service `
  --region $Region `
  --service-arn $ServiceArn `
  --query "service.activeConfigurations[0].ingressPaths[0].endpoint" `
  --output text 2>$null

if ([string]::IsNullOrWhiteSpace($ResolvedEndpoint) -or $ResolvedEndpoint -eq "None") {
  $ResolvedAppUrl = $PredictedExpressUrl
} elseif ($ResolvedEndpoint.StartsWith("http")) {
  $ResolvedAppUrl = $ResolvedEndpoint
} else {
  $ResolvedAppUrl = "https://$ResolvedEndpoint"
}

Write-Host ""
Write-Host "Creation finished."
Write-Host "  ECS Express URL: $ResolvedAppUrl"
if (-not [string]::IsNullOrWhiteSpace($AppDomainName)) {
  Write-Host "  Custom domain:    https://$AppDomainName"
}
Write-Host "  Database:         $DatabaseEndpoint"
Write-Host ""
Write-Warning "Prisma migrations are NOT applied automatically. The container CMD no longer runs 'prisma migrate deploy' - only scripts/deploy-bluegreen.sh applies migrations, as a one-off ECS task. This environment starts with whatever schema its database already has."
Write-Host "Check ECS/CloudWatch logs if the service does not become healthy."
Write-Warning "After verification, run scripts/delete-aws-dev.ps1 to remove billable resources."
