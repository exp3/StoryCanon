param(
  [string]$Stage = "dev",
  [string]$Region = "ap-northeast-1",
  [string]$AwsAccountId = $env:AWS_ACCOUNT_ID
)

if (-not $AwsAccountId) {
  throw "AWS account id is required. Pass -AwsAccountId or set AWS_ACCOUNT_ID."
}

$Repository = "storycanon-$Stage-web"
$Image = "$AwsAccountId.dkr.ecr.$Region.amazonaws.com/$Repository`:latest"

aws ecr get-login-password --region $Region | docker login --username AWS --password-stdin "$AwsAccountId.dkr.ecr.$Region.amazonaws.com"
docker build -f apps/web/Dockerfile -t $Image .
docker push $Image

$ServiceArn = aws apprunner list-services --region $Region --query "ServiceSummaryList[?ServiceName=='storycanon-$Stage-app'].ServiceArn | [0]" --output text
if ($ServiceArn -eq "None" -or -not $ServiceArn) {
  throw "App Runner service storycanon-$Stage-app was not found."
}

aws apprunner start-deployment --region $Region --service-arn $ServiceArn
