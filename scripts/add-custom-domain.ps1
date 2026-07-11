param(
  [string]$Stage = "dev",
  [string]$Region = "ap-northeast-1",
  [string]$Profile = $env:AWS_PROFILE,
  [Parameter(Mandatory = $true)][string]$HostedZoneId,
  [Parameter(Mandatory = $true)][string]$DomainName
)

# Attaches a custom domain to an already-deployed ECS Express service.
#
# ECS Express Mode has no built-in custom-domain API; this script performs the
# same manual steps documented by AWS for "Adding a custom domain to your
# service" (see docs/infrastructure.md), driven from the CLI instead of the
# console:
#   1. Request + DNS-validate an ACM certificate for $DomainName
#   2. Add $DomainName as an additional host-header match on the existing
#      listener rule (kept alongside the auto-generated *.ecs...on.aws host)
#   3. Attach the new certificate to the HTTPS listener
#   4. Create a Route 53 alias record pointing $DomainName at the ALB
#
# These changes live outside of Express Mode's own management and can be
# reset by scripts/remove-custom-domain.ps1. A full service recreation
# (RECREATE_SERVICE=true) replaces the ALB and will require re-running this
# script.

$ErrorActionPreference = "Stop"

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][scriptblock]$Command
  )
  Write-Host ""
  Write-Host "==> $Label"
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "$Label failed with exit code $LASTEXITCODE"
  }
}

function Write-Utf8NoBom {
  param([Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)][string]$Content)
  [System.IO.File]::WriteAllText($Path, $Content, (New-Object System.Text.UTF8Encoding($false)))
}

function ConvertTo-AwsFileUri {
  param([Parameter(Mandatory = $true)][string]$Path)
  return "file://$($Path.Replace('\', '/'))"
}

$AwsProfileArgs = @()
if (-not [string]::IsNullOrWhiteSpace($Profile)) {
  $AwsProfileArgs += @("--profile", $Profile)
}

$Prefix = "storycanon-$Stage"
$AccountId = aws @AwsProfileArgs sts get-caller-identity --query Account --output text
$ServiceArn = "arn:aws:ecs:${Region}:${AccountId}:service/default/$Prefix-app"

Write-Host "Adding custom domain '$DomainName' to $Prefix-app in $Region."

$AlbArn = aws @AwsProfileArgs ecs describe-express-gateway-service `
  --region $Region --service-arn $ServiceArn `
  --query "service.activeConfigurations[0].ingressPaths[0].endpoint" --output text
if ([string]::IsNullOrWhiteSpace($AlbArn) -or $AlbArn -eq "None") {
  throw "Could not resolve the ECS Express service's current ingress endpoint. Is $Prefix-app running?"
}
$AutoDomain = $AlbArn
Write-Host "  Auto-generated domain: https://$AutoDomain"

# The ALB itself isn't returned directly by describe-express-gateway-service,
# so find it by its well-known naming convention.
$LoadBalancerArn = aws @AwsProfileArgs elbv2 describe-load-balancers --region $Region `
  --query "LoadBalancers[?contains(LoadBalancerName, 'ecs-express')].LoadBalancerArn | [0]" --output text
if ([string]::IsNullOrWhiteSpace($LoadBalancerArn) -or $LoadBalancerArn -eq "None") {
  throw "Could not find the ECS Express-managed Application Load Balancer."
}
$AlbDnsName = aws @AwsProfileArgs elbv2 describe-load-balancers --region $Region `
  --load-balancer-arns $LoadBalancerArn --query "LoadBalancers[0].DNSName" --output text
$AlbZoneId = aws @AwsProfileArgs elbv2 describe-load-balancers --region $Region `
  --load-balancer-arns $LoadBalancerArn --query "LoadBalancers[0].CanonicalHostedZoneId" --output text

$ListenerArn = aws @AwsProfileArgs elbv2 describe-listeners --region $Region `
  --load-balancer-arn $LoadBalancerArn --query "Listeners[?Protocol=='HTTPS'].ListenerArn | [0]" --output text
if ([string]::IsNullOrWhiteSpace($ListenerArn) -or $ListenerArn -eq "None") {
  throw "Could not find the ALB's HTTPS listener."
}

$RuleArn = aws @AwsProfileArgs elbv2 describe-rules --region $Region `
  --listener-arn $ListenerArn `
  --query "Rules[?Priority!='default'] | [?Conditions[?Field=='host-header']] | [0].RuleArn" --output text
if ([string]::IsNullOrWhiteSpace($RuleArn) -or $RuleArn -eq "None") {
  throw "Could not find the ALB listener rule with a host-header condition."
}

Invoke-Checked "Request ACM certificate for $DomainName" {
  $global:CertArn = aws @AwsProfileArgs acm request-certificate --region $Region `
    --domain-name $DomainName --validation-method DNS --query "CertificateArn" --output text
}
Write-Host "  Certificate ARN: $CertArn"

Start-Sleep -Seconds 3
$ValidationName = aws @AwsProfileArgs acm describe-certificate --region $Region --certificate-arn $CertArn `
  --query "Certificate.DomainValidationOptions[0].ResourceRecord.Name" --output text
$ValidationValue = aws @AwsProfileArgs acm describe-certificate --region $Region --certificate-arn $CertArn `
  --query "Certificate.DomainValidationOptions[0].ResourceRecord.Value" --output text

$ValidationChangeBatch = @{
  Changes = @(
    @{
      Action            = "UPSERT"
      ResourceRecordSet = @{
        Name            = $ValidationName
        Type            = "CNAME"
        TTL             = 300
        ResourceRecords = @(@{ Value = $ValidationValue })
      }
    }
  )
} | ConvertTo-Json -Depth 10
$ValidationFile = New-TemporaryFile
Write-Utf8NoBom -Path $ValidationFile.FullName -Content $ValidationChangeBatch

Invoke-Checked "Create DNS validation record in Route 53" {
  aws @AwsProfileArgs route53 change-resource-record-sets --hosted-zone-id $HostedZoneId `
    --change-batch (ConvertTo-AwsFileUri $ValidationFile.FullName) | Out-Host
}
Remove-Item $ValidationFile -Force

Write-Host ""
Write-Host "==> Waiting for certificate to be issued (DNS validation can take a few minutes)"
$Issued = $false
for ($i = 0; $i -lt 30; $i++) {
  $Status = aws @AwsProfileArgs acm describe-certificate --region $Region --certificate-arn $CertArn `
    --query "Certificate.Status" --output text
  Write-Host "  attempt $($i + 1): $Status"
  if ($Status -eq "ISSUED") { $Issued = $true; break }
  Start-Sleep -Seconds 20
}
if (-not $Issued) {
  throw "Certificate was not issued in time. Check DNS propagation and retry."
}

$ConditionsJson = @(
  @{ Field = "host-header"; HostHeaderConfig = @{ Values = @($AutoDomain, $DomainName) } }
) | ConvertTo-Json -Depth 10
$ConditionsFile = New-TemporaryFile
Write-Utf8NoBom -Path $ConditionsFile.FullName -Content $ConditionsJson

Invoke-Checked "Add '$DomainName' as an additional host-header match on the listener rule" {
  aws @AwsProfileArgs elbv2 modify-rule --region $Region --rule-arn $RuleArn `
    --conditions (ConvertTo-AwsFileUri $ConditionsFile.FullName) | Out-Host
}
Remove-Item $ConditionsFile -Force

Invoke-Checked "Attach certificate to the HTTPS listener" {
  aws @AwsProfileArgs elbv2 add-listener-certificates --region $Region `
    --listener-arn $ListenerArn --certificates "CertificateArn=$CertArn" | Out-Host
}

$AliasChangeBatch = @{
  Changes = @(
    @{
      Action            = "UPSERT"
      ResourceRecordSet = @{
        Name        = "$DomainName."
        Type        = "A"
        AliasTarget = @{
          HostedZoneId         = $AlbZoneId
          DNSName              = $AlbDnsName
          EvaluateTargetHealth = $true
        }
      }
    }
  )
} | ConvertTo-Json -Depth 10
$AliasFile = New-TemporaryFile
Write-Utf8NoBom -Path $AliasFile.FullName -Content $AliasChangeBatch

Invoke-Checked "Create Route 53 alias record for $DomainName" {
  aws @AwsProfileArgs route53 change-resource-record-sets --hosted-zone-id $HostedZoneId `
    --change-batch (ConvertTo-AwsFileUri $AliasFile.FullName) | Out-Host
}
Remove-Item $AliasFile -Force

Write-Host ""
Write-Host "Custom domain added."
Write-Host "  https://$DomainName"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  - Redeploy with APP_DOMAIN_NAME=$DomainName so NEXTAUTH_URL matches (scripts/deploy-ecs-express.sh)."
Write-Host "  - Add the Google OAuth redirect URI: https://$DomainName/api/auth/callback/google"
Write-Host "  - Add a Stripe webhook endpoint (if used): https://$DomainName/api/stripe/webhook"
Write-Host "  - Record the certificate ARN if you'll run remove-custom-domain.ps1 later: $CertArn"
