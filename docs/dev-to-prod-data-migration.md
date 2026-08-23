# dev → prod データ移行（バストイオン方式）

現 `storycanon-dev` の RDS データ（KBオーダー）を、新規作成する `storycanon-prod` の RDS へ移す一回限りの手順。

- 両側とも PostgreSQL 16 / 同一 Prisma スキーマなので、フルダンプ→空DBへ restore で完結する。
- RDS は isolated private subnet + `publiclyAccessible: false` のため、**各VPC内に一時EC2バストイオンを立てて** `pg_dump` / `pg_restore` を実行する。
- バストイオンは **public subnet** に置き、**既存 app-SG** を付与する。RDS 側SGが app-SG からの 5432 を許可済みなので DB のSGは変更不要。
- 接続は **SSM Session Manager**（SSHキー不要）。ダンプの受け渡しは **S3 中継バケット**。

> ⚠️ このrunbookは billable な AWS リソース（EC2 / S3 / prod スタック一式）を作成し、prod DB に書き込む。各ステップは内容を確認してから実行すること。

---

## 0. 前提変数（ローカル PowerShell）

```powershell
$Account = "199041707218"
$Region  = "ap-northeast-1"
$Profile = "<aws-profile>"
$AwsArgs = @("--profile", $Profile, "--region", $Region)

# 中継バケット名（後で削除する使い捨て）
$TransferBucket = "storycanon-migx-$Account"
```

ヘルパー: CloudFormation 出力の取得

```powershell
function Get-Out($Stack, $Key) {
  aws @AwsArgs cloudformation describe-stacks --stack-name $Stack `
    --query "Stacks[0].Outputs[?OutputKey=='$Key'].OutputValue | [0]" --output text
}
```

---

## 1. prod ベーススタックだけ先に作る（prod DB を空で用意）

アプリより先にDBを作り、restore 後にアプリを出す。これでデプロイ時の `prisma migrate deploy` が「適用済み」と判定し衝突しない。

```powershell
cd infra
npx cdk deploy `
  "storycanon-prod-network" `
  "storycanon-prod-storage" `
  "storycanon-prod-secrets" `
  "storycanon-prod-database" `
  -c stage=prod -c region=$Region --require-approval never
cd ..
```

> `isProd=true` になるので prod DB は削除保護・RETAIN・バックアップ7日、S3はバージョニング有効で作られる。

---

## 2. 中継用 S3 バケットと共有 IAM ロールを作成

### 2-1. 中継バケット

```powershell
aws @AwsArgs s3api create-bucket --bucket $TransferBucket `
  --create-bucket-configuration LocationConstraint=$Region
aws @AwsArgs s3api put-public-access-block --bucket $TransferBucket `
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

### 2-2. バストイオン用 IAM ロール / インスタンスプロファイル

SSM 接続 + Secrets 読取 + 中継バケット読み書きのみ。

```powershell
$RoleName = "storycanon-migration-bastion"

$trust = '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
$trust | Out-File -Encoding ascii -NoNewline "$env:TEMP\mig-trust.json"

aws @AwsArgs iam create-role --role-name $RoleName `
  --assume-role-policy-document "file://$env:TEMP/mig-trust.json"

aws @AwsArgs iam attach-role-policy --role-name $RoleName `
  --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore

$inline = @"
{
  "Version":"2012-10-17",
  "Statement":[
    {"Effect":"Allow","Action":["secretsmanager:GetSecretValue"],
     "Resource":"arn:aws:secretsmanager:$Region`:$Account`:secret:*"},
    {"Effect":"Allow","Action":["s3:GetObject","s3:PutObject","s3:ListBucket"],
     "Resource":["arn:aws:s3:::$TransferBucket","arn:aws:s3:::$TransferBucket/*"]}
  ]
}
"@
$inline | Out-File -Encoding ascii -NoNewline "$env:TEMP\mig-inline.json"
aws @AwsArgs iam put-role-policy --role-name $RoleName `
  --policy-name migration-access --policy-document "file://$env:TEMP/mig-inline.json"

aws @AwsArgs iam create-instance-profile --instance-profile-name $RoleName
aws @AwsArgs iam add-role-to-instance-profile --instance-profile-name $RoleName --role-name $RoleName
Start-Sleep -Seconds 10   # プロファイル反映待ち
```

---

## 3. dev 側: バストイオン起動 → ダンプ → S3

### 3-1. 起動パラメータ取得（dev）

```powershell
$DevSubnet = (Get-Out "storycanon-dev-network" "PublicSubnetIds").Split(",")[0]
$DevAppSg  = Get-Out "storycanon-dev-network" "AppSecurityGroupId"
$DevDbArn  = Get-Out "storycanon-dev-database" "DatabaseSecretArn"
$Ami = aws @AwsArgs ssm get-parameter `
  --name "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64" `
  --query "Parameter.Value" --output text
```

### 3-2. 起動

```powershell
$DevInst = aws @AwsArgs ec2 run-instances --image-id $Ami --instance-type t3.micro `
  --iam-instance-profile Name=$RoleName `
  --subnet-id $DevSubnet --security-group-ids $DevAppSg `
  --associate-public-ip-address `
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=storycanon-mig-dev}]' `
  --query "Instances[0].InstanceId" --output text
aws @AwsArgs ec2 wait instance-status-ok --instance-ids $DevInst
```

### 3-3. ダンプ実行（SSM send-command）

DBパスワードはバストイオン上で Secrets から取得するのでコマンドラインに出さない。

```powershell
$dumpScript = @"
set -euo pipefail
sudo dnf install -y postgresql16 >/dev/null
S=`$(aws secretsmanager get-secret-value --region $Region --secret-id $DevDbArn --query SecretString --output text)
export PGHOST=`$(echo `$S | python3 -c 'import sys,json;print(json.load(sys.stdin)["host"])')
export PGPASSWORD=`$(echo `$S | python3 -c 'import sys,json;print(json.load(sys.stdin)["password"])')
pg_dump -U storycanon -d storycanon -Fc -f /tmp/storycanon.dump
aws s3 cp /tmp/storycanon.dump s3://$TransferBucket/storycanon.dump
echo DUMP_DONE
"@

$cmd = aws @AwsArgs ssm send-command --instance-ids $DevInst `
  --document-name "AWS-RunShellScript" `
  --parameters commands="$dumpScript" `
  --query "Command.CommandId" --output text

# 完了確認（数十秒後）
aws @AwsArgs ssm get-command-invocation --command-id $cmd --instance-id $DevInst `
  --query "{Status:Status,Out:StandardOutputContent,Err:StandardErrorContent}"
```

`Status: Success` かつ出力に `DUMP_DONE` を確認したら dev バストイオンを終了。

```powershell
aws @AwsArgs ec2 terminate-instances --instance-ids $DevInst
```

---

## 4. prod 側: バストイオン起動 → restore

### 4-1. 起動パラメータ取得（prod）

```powershell
$ProdSubnet = (Get-Out "storycanon-prod-network" "PublicSubnetIds").Split(",")[0]
$ProdAppSg  = Get-Out "storycanon-prod-network" "AppSecurityGroupId"
$ProdDbArn  = Get-Out "storycanon-prod-database" "DatabaseSecretArn"
```

### 4-2. 起動

```powershell
$ProdInst = aws @AwsArgs ec2 run-instances --image-id $Ami --instance-type t3.micro `
  --iam-instance-profile Name=$RoleName `
  --subnet-id $ProdSubnet --security-group-ids $ProdAppSg `
  --associate-public-ip-address `
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=storycanon-mig-prod}]' `
  --query "Instances[0].InstanceId" --output text
aws @AwsArgs ec2 wait instance-status-ok --instance-ids $ProdInst
```

### 4-3. restore 実行

空の prod DB にフルダンプ（`_prisma_migrations` 込み）を流し込む。

```powershell
$restoreScript = @"
set -euo pipefail
sudo dnf install -y postgresql16 >/dev/null
aws s3 cp s3://$TransferBucket/storycanon.dump /tmp/storycanon.dump
S=`$(aws secretsmanager get-secret-value --region $Region --secret-id $ProdDbArn --query SecretString --output text)
export PGHOST=`$(echo `$S | python3 -c 'import sys,json;print(json.load(sys.stdin)["host"])')
export PGPASSWORD=`$(echo `$S | python3 -c 'import sys,json;print(json.load(sys.stdin)["password"])')
pg_restore -U storycanon -d storycanon --no-owner --no-privileges /tmp/storycanon.dump
psql -U storycanon -d storycanon -c '\dt'
echo RESTORE_DONE
"@

$cmd = aws @AwsArgs ssm send-command --instance-ids $ProdInst `
  --document-name "AWS-RunShellScript" `
  --parameters commands="$restoreScript" `
  --query "Command.CommandId" --output text

aws @AwsArgs ssm get-command-invocation --command-id $cmd --instance-id $ProdInst `
  --query "{Status:Status,Out:StandardOutputContent,Err:StandardErrorContent}"
```

`RESTORE_DONE` とテーブル一覧を確認したら prod バストイオンを終了。

```powershell
aws @AwsArgs ec2 terminate-instances --instance-ids $ProdInst
```

---

## 5. prod アプリをデプロイ

データ投入済みなので、ここでアプリサービスを出す。CI（`main` マージ / `workflow_dispatch`）で `deploy-bluegreen.sh` を実行。`STORYCANON_STAGE=prod` を設定しておくこと。ベーススタックは手順1で作成済みなので更新扱いになる。

デプロイ中の migration ステップ（`scripts/deploy-bluegreen.sh` の one-off ECS タスク）で `prisma migrate deploy` が走るが、restore 済みなので適用済みと判定して何もしない。起動時には実行されない。

---

## 6. 後片付け（課金停止）

```powershell
# バストイオンが両方 terminate 済みであることを確認
aws @AwsArgs s3 rm s3://$TransferBucket/storycanon.dump
aws @AwsArgs s3api delete-bucket --bucket $TransferBucket

aws @AwsArgs iam remove-role-from-instance-profile --instance-profile-name $RoleName --role-name $RoleName
aws @AwsArgs iam delete-instance-profile --instance-profile-name $RoleName
aws @AwsArgs iam delete-role-policy --role-name $RoleName --policy-name migration-access
aws @AwsArgs iam detach-role-policy --role-name $RoleName --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
aws @AwsArgs iam delete-role --role-name $RoleName
```

---

## チェックリスト

- [ ] prod ベーススタック4つ作成（アプリはまだ）
- [ ] 中継バケット / IAM ロール作成
- [ ] dev ダンプ → S3（`DUMP_DONE`）
- [ ] dev バストイオン terminate
- [ ] prod restore（`RESTORE_DONE` + テーブル確認）
- [ ] prod バストイオン terminate
- [ ] prod アプリデプロイ（CI, STAGE=prod）
- [ ] 中継バケット / IAM / EC2 全削除
