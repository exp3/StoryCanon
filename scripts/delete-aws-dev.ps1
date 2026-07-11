param(
  [string]$Stage = "dev",
  [string]$Region = "ap-northeast-1",
  [string]$Profile = $env:AWS_PROFILE,
  [string]$ConfirmDestroy,
  [switch]$AllowProd,
  [switch]$DestroyRetainedEcr
)

$ErrorActionPreference = "Stop"

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

if ($Stage -eq "prod" -and -not $AllowProd) {
  throw "Refusing to delete prod. Pass -AllowProd only if you really intend to delete prod."
}

$Prefix = "storycanon-$Stage"
$ExpectedConfirmation = "delete-$Prefix"
$AwsProfileArgs = @()
if (-not [string]::IsNullOrWhiteSpace($Profile)) {
  $AwsProfileArgs += @("--profile", $Profile)
}

if ($ConfirmDestroy -ne $ExpectedConfirmation) {
  throw "Deletion requires -ConfirmDestroy '$ExpectedConfirmation'. This is intentional because the operation destroys AWS resources."
}

Write-Host "Deleting AWS environment $Prefix in $Region."
Write-Host "This will run CDK destroy for StoryCanon stacks. For dev, RDS data and the export bucket are expected to be deleted by stack policy."

$ExpressServiceArn = "arn:aws:ecs:${Region}:$(aws @AwsProfileArgs sts get-caller-identity --query Account --output text):service/default/$Prefix-app"
$ExpressStatus = Invoke-OptionalAwsText {
  aws @AwsProfileArgs ecs describe-express-gateway-service `
    --region $Region `
    --service-arn $ExpressServiceArn `
    --query "service.status.statusCode" `
    --output text
}

if ($OptionalAwsLastExitCode -eq 0 -and $ExpressStatus -and $ExpressStatus -ne "None") {
  Write-Host "Deleting ECS Express Mode service $Prefix-app."
  aws @AwsProfileArgs ecs delete-express-gateway-service `
    --region $Region `
    --service-arn $ExpressServiceArn `
    --monitor-resources RESOURCE `
    --monitor-mode TEXT-ONLY | Out-Host
} else {
  Write-Host "ECS Express Mode service $Prefix-app was not found; skipping."
}

Push-Location infra
try {
  $StackNames = @(
    "$Prefix-dns",
    "$Prefix-app",
    "$Prefix-compute",
    "$Prefix-database",
    "$Prefix-storage",
    "$Prefix-secrets",
    "$Prefix-network"
  )

  foreach ($StackName in $StackNames) {
    $Exists = Invoke-OptionalAwsText {
      aws @AwsProfileArgs cloudformation describe-stacks `
        --region $Region `
        --stack-name $StackName `
        --query "Stacks[0].StackName" `
        --output text
    }

    if ($OptionalAwsLastExitCode -eq 0 -and $Exists -eq $StackName) {
      Write-Host "Destroying CloudFormation stack $StackName."
      if ($Profile) {
        $env:AWS_PROFILE = $Profile
      }
      npx cdk destroy $StackName -c stage=$Stage -c region=$Region --force
    } else {
      Write-Host "CloudFormation stack $StackName was not found; skipping."
    }
  }
} finally {
  Pop-Location
}

if ($DestroyRetainedEcr) {
  $RepositoryName = "$Prefix-web"
  $RepositoryExists = Invoke-OptionalAwsText {
    aws @AwsProfileArgs ecr describe-repositories `
      --region $Region `
      --repository-names $RepositoryName `
      --query "repositories[0].repositoryName" `
      --output text
  }

  if ($OptionalAwsLastExitCode -eq 0 -and $RepositoryExists -eq $RepositoryName) {
    Write-Host "Deleting retained ECR repository $RepositoryName."
    aws @AwsProfileArgs ecr delete-repository --region $Region --repository-name $RepositoryName --force | Out-Host
  } else {
    Write-Host "ECR repository $RepositoryName was not found."
  }
} else {
  Write-Host "Retained ECR repository cleanup skipped. Pass -DestroyRetainedEcr to delete $Prefix-web."
}

Write-Host "Delete request complete. Check CloudFormation, ECS Express Mode, RDS, VPC, ECR, S3, and Secrets Manager in $Region for leftovers."
