param(
  [string]$Stage = "dev",
  [string]$Region = "ap-northeast-1",
  [string]$Profile = $env:AWS_PROFILE,
  [Parameter(Mandatory = $true)][string]$HostedZoneId,
  [Parameter(Mandatory = $true)][string]$DomainName,
  [string]$CertificateArn
)

# Reverses scripts/add-custom-domain.ps1: removes the Route 53 alias record,
# detaches (and optionally deletes) the ACM certificate, and removes the
# custom domain from the ALB listener rule's host-header condition, leaving
# only the ECS Express auto-generated domain.
#
# Safe to run even if the ECS Express service/ALB has already been deleted
# (e.g. as part of scripts/delete-aws-dev.ps1) — in that case the listener
# rule and certificate steps are skipped automatically, and only the Route 53
# record is removed.

$ErrorActionPreference = "Stop"

function Invoke-OptionalAwsText {
  param([Parameter(Mandatory = $true)][scriptblock]$Command)
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
Write-Host "Removing custom domain '$DomainName' for $Prefix."

# --- Route 53 alias record ---
$ExistingRecord = Invoke-OptionalAwsText {
  aws @AwsProfileArgs route53 list-resource-record-sets --hosted-zone-id $HostedZoneId `
    --query "ResourceRecordSets[?Name=='$DomainName.' && Type=='A']" --output json
}

if ($OptionalAwsLastExitCode -eq 0 -and $ExistingRecord -and $ExistingRecord -ne "[]") {
  $Record = $ExistingRecord | ConvertFrom-Json
  if ($Record.Count -gt 0) {
    $AliasChangeBatch = @{
      Changes = @(
        @{
          Action            = "DELETE"
          ResourceRecordSet = $Record[0]
        }
      )
    } | ConvertTo-Json -Depth 10
    $AliasFile = New-TemporaryFile
    Write-Utf8NoBom -Path $AliasFile.FullName -Content $AliasChangeBatch
    Write-Host "==> Deleting Route 53 alias record for $DomainName"
    aws @AwsProfileArgs route53 change-resource-record-sets --hosted-zone-id $HostedZoneId `
      --change-batch (ConvertTo-AwsFileUri $AliasFile.FullName) | Out-Host
    Remove-Item $AliasFile -Force
  }
} else {
  Write-Host "No Route 53 A record found for $DomainName; skipping."
}

# --- ALB listener rule + certificate (skipped if the service/ALB is already gone) ---
$LoadBalancerArn = Invoke-OptionalAwsText {
  aws @AwsProfileArgs elbv2 describe-load-balancers --region $Region `
    --query "LoadBalancers[?contains(LoadBalancerName, 'ecs-express')].LoadBalancerArn | [0]" --output text
}

if ($OptionalAwsLastExitCode -eq 0 -and $LoadBalancerArn -and $LoadBalancerArn -ne "None") {
  $ListenerArn = aws @AwsProfileArgs elbv2 describe-listeners --region $Region `
    --load-balancer-arn $LoadBalancerArn --query "Listeners[?Protocol=='HTTPS'].ListenerArn | [0]" --output text

  if ($ListenerArn -and $ListenerArn -ne "None") {
    $RuleArn = aws @AwsProfileArgs elbv2 describe-rules --region $Region --listener-arn $ListenerArn `
      --query "Rules[?Priority!='default'] | [?Conditions[?Field=='host-header']] | [0].RuleArn" --output text

    if ($RuleArn -and $RuleArn -ne "None") {
      $CurrentValues = aws @AwsProfileArgs elbv2 describe-rules --region $Region --listener-arn $ListenerArn `
        --query "Rules[?RuleArn=='$RuleArn'] | [0].Conditions[?Field=='host-header'] | [0].HostHeaderConfig.Values" --output json | ConvertFrom-Json
      $RemainingValues = $CurrentValues | Where-Object { $_ -ne $DomainName }

      if ($RemainingValues.Count -gt 0) {
        $ConditionsJson = @(
          @{ Field = "host-header"; HostHeaderConfig = @{ Values = @($RemainingValues) } }
        ) | ConvertTo-Json -Depth 10
        $ConditionsFile = New-TemporaryFile
        Write-Utf8NoBom -Path $ConditionsFile.FullName -Content $ConditionsJson
        Write-Host "==> Removing '$DomainName' from the listener rule's host-header condition"
        aws @AwsProfileArgs elbv2 modify-rule --region $Region --rule-arn $RuleArn `
          --conditions (ConvertTo-AwsFileUri $ConditionsFile.FullName) | Out-Host
        Remove-Item $ConditionsFile -Force
      }
    }

    if ($CertificateArn) {
      Write-Host "==> Removing certificate from the HTTPS listener"
      Invoke-OptionalAwsText {
        aws @AwsProfileArgs elbv2 remove-listener-certificates --region $Region `
          --listener-arn $ListenerArn --certificates "CertificateArn=$CertificateArn" | Out-Host
      } | Out-Null
    }
  }
} else {
  Write-Host "ECS Express ALB not found (service may already be deleted); skipping listener cleanup."
}

# --- ACM certificate (and its DNS validation CNAME record) ---
$ResolvedCertArn = $CertificateArn
if (-not $ResolvedCertArn) {
  $ResolvedCertArn = Invoke-OptionalAwsText {
    aws @AwsProfileArgs acm list-certificates --region $Region `
      --query "CertificateSummaryList[?DomainName=='$DomainName'].CertificateArn | [0]" --output text
  }
  if ($OptionalAwsLastExitCode -ne 0 -or -not $ResolvedCertArn -or $ResolvedCertArn -eq "None") {
    $ResolvedCertArn = $null
  }
}

if ($ResolvedCertArn) {
  $ValidationName = Invoke-OptionalAwsText {
    aws @AwsProfileArgs acm describe-certificate --region $Region --certificate-arn $ResolvedCertArn `
      --query "Certificate.DomainValidationOptions[0].ResourceRecord.Name" --output text
  }
  $ValidationValue = Invoke-OptionalAwsText {
    aws @AwsProfileArgs acm describe-certificate --region $Region --certificate-arn $ResolvedCertArn `
      --query "Certificate.DomainValidationOptions[0].ResourceRecord.Value" --output text
  }

  if ($ValidationName -and $ValidationName -ne "None") {
    $ValidationDeleteBatch = @{
      Changes = @(
        @{
          Action            = "DELETE"
          ResourceRecordSet = @{
            Name            = $ValidationName
            Type            = "CNAME"
            TTL             = 300
            ResourceRecords = @(@{ Value = $ValidationValue })
          }
        }
      )
    } | ConvertTo-Json -Depth 10
    $ValidationDeleteFile = New-TemporaryFile
    Write-Utf8NoBom -Path $ValidationDeleteFile.FullName -Content $ValidationDeleteBatch
    Write-Host "==> Deleting ACM DNS validation record $ValidationName"
    Invoke-OptionalAwsText {
      aws @AwsProfileArgs route53 change-resource-record-sets --hosted-zone-id $HostedZoneId `
        --change-batch (ConvertTo-AwsFileUri $ValidationDeleteFile.FullName) | Out-Host
    } | Out-Null
    Remove-Item $ValidationDeleteFile -Force
  }

  Write-Host "==> Deleting ACM certificate $ResolvedCertArn"
  Invoke-OptionalAwsText {
    aws @AwsProfileArgs acm delete-certificate --region $Region --certificate-arn $ResolvedCertArn
  } | Out-Null
} else {
  Write-Host "No -CertificateArn passed and no matching ACM certificate found for $DomainName; skipping certificate cleanup."
}

Write-Host ""
Write-Host "Custom domain cleanup for $DomainName complete."
