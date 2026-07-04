param(
  [string]$Stage = "dev",
  [string]$Region = "ap-northeast-1",
  [switch]$AllowProd,
  [switch]$SkipAppRunner,
  [switch]$SkipRds
)

$ErrorActionPreference = "Stop"

if ($Stage -eq "prod" -and -not $AllowProd) {
  throw "Refusing to stop prod. Pass -AllowProd only if you really intend to operate on prod."
}

$Prefix = "storycanon-$Stage"

Write-Host "Stopping AWS runtime resources for $Prefix in $Region."
Write-Host "Note: this pauses App Runner and stops RDS only. VPC/NAT Gateway, Secrets, S3, ECR, and CloudFormation stacks remain and may still incur charges."

if (-not $SkipAppRunner) {
  $ServiceArn = aws apprunner list-services `
    --region $Region `
    --query "ServiceSummaryList[?ServiceName=='$Prefix-app'].ServiceArn | [0]" `
    --output text

  if ($ServiceArn -and $ServiceArn -ne "None") {
    $Status = aws apprunner describe-service `
      --region $Region `
      --service-arn $ServiceArn `
      --query "Service.Status" `
      --output text

    if ($Status -eq "RUNNING") {
      Write-Host "Pausing App Runner service $Prefix-app."
      aws apprunner pause-service --region $Region --service-arn $ServiceArn | Out-Host
    } else {
      Write-Host "App Runner service $Prefix-app is $Status; no pause requested."
    }
  } else {
    Write-Host "App Runner service $Prefix-app was not found."
  }
}

if (-not $SkipRds) {
  $DbId = "$Prefix-db"
  $DbStatus = aws rds describe-db-instances `
    --region $Region `
    --db-instance-identifier $DbId `
    --query "DBInstances[0].DBInstanceStatus" `
    --output text 2>$null

  if ($LASTEXITCODE -ne 0 -or -not $DbStatus -or $DbStatus -eq "None") {
    Write-Host "RDS instance $DbId was not found."
  } elseif ($DbStatus -eq "available") {
    Write-Host "Stopping RDS instance $DbId."
    aws rds stop-db-instance --region $Region --db-instance-identifier $DbId | Out-Host
  } else {
    Write-Host "RDS instance $DbId is $DbStatus; no stop requested."
  }
}

Write-Host "Stop request complete. Use scripts/delete-aws-dev.ps1 to remove the full dev environment and stop VPC/NAT charges."
