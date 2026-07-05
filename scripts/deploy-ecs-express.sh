#!/usr/bin/env bash
set -euo pipefail

log_step() {
  printf '\n==> %s\n' "$1"
}

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Environment variable '$name' is required." >&2
    exit 1
  fi
}

aws_text() {
  aws "$@" --output text 2>/dev/null || true
}

put_secret() {
  local name="$1"
  local value="$2"
  aws secretsmanager put-secret-value \
    --region "$REGION" \
    --secret-id "$PREFIX/$name" \
    --secret-string "$value" >/dev/null
}

put_secret_if_set() {
  local name="$1"
  local value="$2"
  if [[ -n "$value" ]]; then
    put_secret "$name" "$value"
  fi
}

stack_output() {
  local stack_name="$1"
  local output_key="$2"
  aws cloudformation describe-stacks \
    --region "$REGION" \
    --stack-name "$stack_name" \
    --query "Stacks[0].Outputs[?OutputKey=='$output_key'].OutputValue | [0]" \
    --output text
}

ensure_role() {
  local role_name="$1"
  local trust_policy_file="$2"
  local role_arn
  role_arn="$(aws_text iam get-role --role-name "$role_name" --query 'Role.Arn')"
  if [[ -n "$role_arn" && "$role_arn" != "None" ]]; then
    echo "$role_arn"
    return
  fi

  aws iam create-role \
    --role-name "$role_name" \
    --assume-role-policy-document "file://$trust_policy_file" \
    --query 'Role.Arn' \
    --output text
}

wait_for_role() {
  local role_name="$1"
  for _ in $(seq 1 12); do
    if aws iam get-role --role-name "$role_name" >/dev/null 2>&1; then
      return
    fi
    sleep 5
  done
  echo "IAM role '$role_name' did not become visible in time." >&2
  exit 1
}

ensure_service_linked_role() {
  if aws iam get-role --role-name AWSServiceRoleForECS >/dev/null 2>&1; then
    return
  fi

  aws iam create-service-linked-role \
    --aws-service-name ecs.amazonaws.com \
    --description "Service-linked role for Amazon ECS" >/dev/null

  wait_for_role AWSServiceRoleForECS
}

wait_for_service_deleted() {
  local service_arn="$1"
  for _ in $(seq 1 24); do
    local status
    status="$(aws_text ecs describe-express-gateway-service --region "$REGION" --service-arn "$service_arn" --query 'service.status.statusCode')"
    if [[ -z "$status" || "$status" == "None" ]]; then
      return
    fi
    sleep 10
  done
  echo "ECS Express service '$service_arn' was not deleted in time." >&2
  exit 1
}

render_json() {
  local file="$1"
  cat >"$file"
}

create_service() {
  aws ecs create-express-gateway-service \
    --region "$REGION" \
    --cluster default \
    --service-name "$SERVICE_NAME" \
    --execution-role-arn "$EXECUTION_ROLE_ARN" \
    --infrastructure-role-arn "$INFRASTRUCTURE_ROLE_ARN" \
    --task-role-arn "$TASK_ROLE_ARN" \
    --primary-container "file://$PRIMARY_CONTAINER_FILE" \
    --network-configuration "file://$NETWORK_CONFIGURATION_FILE" \
    --cpu "256" \
    --memory "512" \
    --scaling-target "file://$SCALING_TARGET_FILE" \
    --health-check-path "/api/health" \
    --monitor-resources DEPLOYMENT \
    --monitor-mode TEXT-ONLY
}

update_service() {
  aws ecs update-express-gateway-service \
    --region "$REGION" \
    --service-arn "$SERVICE_ARN" \
    --execution-role-arn "$EXECUTION_ROLE_ARN" \
    --task-role-arn "$TASK_ROLE_ARN" \
    --primary-container "file://$PRIMARY_CONTAINER_FILE" \
    --network-configuration "file://$NETWORK_CONFIGURATION_FILE" \
    --cpu "256" \
    --memory "512" \
    --scaling-target "file://$SCALING_TARGET_FILE" \
    --health-check-path "/api/health" \
    --monitor-resources DEPLOYMENT \
    --monitor-mode TEXT-ONLY
}

require_env AWS_ACCOUNT_ID
require_env AWS_REGION
require_env GOOGLE_CLIENT_ID
require_env GOOGLE_CLIENT_SECRET
require_env NEXTAUTH_SECRET
require_env APP_API_TOKEN_PEPPER

STAGE="${STAGE:-prod}"
REGION="${AWS_REGION}"
PREFIX="storycanon-$STAGE"
SERVICE_NAME="$PREFIX-app"
SERVICE_ARN="arn:aws:ecs:${REGION}:${AWS_ACCOUNT_ID}:service/default/${SERVICE_NAME}"
REPOSITORY_NAME="$PREFIX-web"
REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
IMAGE_TAG="${IMAGE_TAG:-${GITHUB_SHA:-latest}}"
IMAGE_URI="${REGISTRY}/${REPOSITORY_NAME}:${IMAGE_TAG}"
LATEST_IMAGE_URI="${REGISTRY}/${REPOSITORY_NAME}:latest"
APP_DOMAIN_NAME="${APP_DOMAIN_NAME:-}"
NEXTAUTH_URL_INPUT="${NEXTAUTH_URL:-}"
PAYMENT_MODE="${PAYMENT_MODE:-mock}"
BOOTSTRAP="${BOOTSTRAP:-false}"
RECREATE_SERVICE="${RECREATE_SERVICE:-false}"
STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY:-}"
STRIPE_WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET:-}"
STRIPE_PRICE_PLUS="${STRIPE_PRICE_PLUS:-}"
STRIPE_PRICE_PRO="${STRIPE_PRICE_PRO:-}"

if [[ -n "$NEXTAUTH_URL_INPUT" ]]; then
  RESOLVED_NEXTAUTH_URL="$NEXTAUTH_URL_INPUT"
elif [[ -n "$APP_DOMAIN_NAME" ]]; then
  RESOLVED_NEXTAUTH_URL="https://${APP_DOMAIN_NAME}"
else
  RESOLVED_NEXTAUTH_URL="https://${SERVICE_NAME}.ecs.${REGION}.on.aws"
fi

echo "StoryCanon ECS Express deployment"
echo "  Stage:          $STAGE"
echo "  Region:         $REGION"
echo "  Account:        $AWS_ACCOUNT_ID"
echo "  Prefix:         $PREFIX"
echo "  NEXTAUTH_URL:   $RESOLVED_NEXTAUTH_URL"
echo "  Image:          $IMAGE_URI"

ACTUAL_ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
if [[ "$ACTUAL_ACCOUNT" != "$AWS_ACCOUNT_ID" ]]; then
  echo "AWS account mismatch. Expected $AWS_ACCOUNT_ID but got $ACTUAL_ACCOUNT." >&2
  exit 1
fi

if [[ "$BOOTSTRAP" == "true" ]]; then
  log_step "CDK bootstrap"
  (
    cd infra
    npx cdk bootstrap "aws://${AWS_ACCOUNT_ID}/${REGION}"
  )
fi

log_step "Deploy base stacks"
(
  cd infra
  npx cdk deploy \
    "${PREFIX}-network" \
    "${PREFIX}-storage" \
    "${PREFIX}-secrets" \
    "${PREFIX}-database" \
    -c "stage=${STAGE}" \
    -c "region=${REGION}" \
    --require-approval never
)

DATABASE_SECRET_ARN="$(stack_output "${PREFIX}-database" "DatabaseSecretArn")"
DATABASE_ENDPOINT="$(stack_output "${PREFIX}-database" "DatabaseEndpoint")"
APP_SECURITY_GROUP_ID="$(stack_output "${PREFIX}-network" "AppSecurityGroupId")"
PUBLIC_SUBNET_IDS="$(stack_output "${PREFIX}-network" "PublicSubnetIds")"
EXPORT_BUCKET_NAME="$(stack_output "${PREFIX}-storage" "ExportBucketName")"

for value in "$DATABASE_SECRET_ARN" "$DATABASE_ENDPOINT" "$APP_SECURITY_GROUP_ID" "$PUBLIC_SUBNET_IDS" "$EXPORT_BUCKET_NAME"; do
  if [[ -z "$value" || "$value" == "None" ]]; then
    echo "Could not read required CloudFormation output." >&2
    exit 1
  fi
done

DB_PASSWORD_JSON="$(aws secretsmanager get-secret-value --region "$REGION" --secret-id "$DATABASE_SECRET_ARN" --query SecretString --output text)"
DB_PASSWORD="$(python -c 'import json,sys; print(json.loads(sys.stdin.read())["password"])' <<<"$DB_PASSWORD_JSON")"
DATABASE_URL="postgresql://storycanon:${DB_PASSWORD}@${DATABASE_ENDPOINT}:5432/storycanon?schema=public"

log_step "Update application secrets"
put_secret "DATABASE_URL" "$DATABASE_URL"
put_secret "NEXTAUTH_URL" "$RESOLVED_NEXTAUTH_URL"
put_secret "NEXTAUTH_SECRET" "$NEXTAUTH_SECRET"
put_secret "GOOGLE_CLIENT_ID" "$GOOGLE_CLIENT_ID"
put_secret "GOOGLE_CLIENT_SECRET" "$GOOGLE_CLIENT_SECRET"
put_secret "APP_API_TOKEN_PEPPER" "$APP_API_TOKEN_PEPPER"
put_secret_if_set "STRIPE_SECRET_KEY" "$STRIPE_SECRET_KEY"
put_secret_if_set "STRIPE_WEBHOOK_SECRET" "$STRIPE_WEBHOOK_SECRET"

if ! aws ecr describe-repositories --region "$REGION" --repository-names "$REPOSITORY_NAME" >/dev/null 2>&1; then
  log_step "Create ECR repository"
  aws ecr create-repository \
    --region "$REGION" \
    --repository-name "$REPOSITORY_NAME" \
    --image-scanning-configuration scanOnPush=true >/dev/null
fi

log_step "Login to ECR"
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REGISTRY"

log_step "Build web Docker image"
docker build -f apps/web/Dockerfile -t "$IMAGE_URI" -t "$LATEST_IMAGE_URI" .

log_step "Push web Docker image"
docker push "$IMAGE_URI"
docker push "$LATEST_IMAGE_URI"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

TASK_TRUST_FILE="$TMP_DIR/task-trust.json"
INFRA_TRUST_FILE="$TMP_DIR/infra-trust.json"
PRIMARY_CONTAINER_FILE="$TMP_DIR/primary-container.json"
NETWORK_CONFIGURATION_FILE="$TMP_DIR/network-configuration.json"
SCALING_TARGET_FILE="$TMP_DIR/scaling-target.json"
EXECUTION_POLICY_FILE="$TMP_DIR/execution-inline-policy.json"
TASK_POLICY_FILE="$TMP_DIR/task-inline-policy.json"
INFRA_POLICY_FILE="$TMP_DIR/infra-inline-policy.json"

render_json "$TASK_TRUST_FILE" <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "ecs-tasks.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
JSON

render_json "$INFRA_TRUST_FILE" <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowAccessInfrastructureForECSExpressServices",
      "Effect": "Allow",
      "Principal": { "Service": "ecs.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
JSON

EXECUTION_ROLE_NAME="${PREFIX}-ecs-execution-role"
INFRASTRUCTURE_ROLE_NAME="${PREFIX}-ecs-infra-role"
TASK_ROLE_NAME="${PREFIX}-ecs-task-role"

EXECUTION_ROLE_ARN="$(ensure_role "$EXECUTION_ROLE_NAME" "$TASK_TRUST_FILE")"
INFRASTRUCTURE_ROLE_ARN="$(ensure_role "$INFRASTRUCTURE_ROLE_NAME" "$INFRA_TRUST_FILE")"
TASK_ROLE_ARN="$(ensure_role "$TASK_ROLE_NAME" "$TASK_TRUST_FILE")"

ensure_service_linked_role
wait_for_role "$EXECUTION_ROLE_NAME"
wait_for_role "$INFRASTRUCTURE_ROLE_NAME"
wait_for_role "$TASK_ROLE_NAME"

log_step "Attach managed role policies"
aws iam attach-role-policy \
  --role-name "$EXECUTION_ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy >/dev/null
aws iam attach-role-policy \
  --role-name "$INFRASTRUCTURE_ROLE_NAME" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSInfrastructureRoleforExpressGatewayServices >/dev/null

render_json "$EXECUTION_POLICY_FILE" <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": ["arn:aws:secretsmanager:${REGION}:${AWS_ACCOUNT_ID}:secret:${PREFIX}/*"]
    }
  ]
}
JSON

render_json "$TASK_POLICY_FILE" <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"],
      "Resource": ["arn:aws:s3:::${EXPORT_BUCKET_NAME}", "arn:aws:s3:::${EXPORT_BUCKET_NAME}/*"]
    }
  ]
}
JSON

render_json "$INFRA_POLICY_FILE" <<'JSON'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["ec2:DescribeAccountAttributes"],
      "Resource": "*"
    }
  ]
}
JSON

log_step "Attach inline role policies"
aws iam put-role-policy \
  --role-name "$EXECUTION_ROLE_NAME" \
  --policy-name "${PREFIX}-secrets-access" \
  --policy-document "file://${EXECUTION_POLICY_FILE}" >/dev/null
aws iam put-role-policy \
  --role-name "$TASK_ROLE_NAME" \
  --policy-name "${PREFIX}-runtime-access" \
  --policy-document "file://${TASK_POLICY_FILE}" >/dev/null
aws iam put-role-policy \
  --role-name "$INFRASTRUCTURE_ROLE_NAME" \
  --policy-name "${PREFIX}-ecs-express-infra-describe" \
  --policy-document "file://${INFRA_POLICY_FILE}" >/dev/null

IFS=',' read -r -a PUBLIC_SUBNET_ID_ARRAY <<<"$PUBLIC_SUBNET_IDS"
PUBLIC_SUBNETS_JSON="$(printf '"%s",' "${PUBLIC_SUBNET_ID_ARRAY[@]}")"
PUBLIC_SUBNETS_JSON="[${PUBLIC_SUBNETS_JSON%,}]"

render_json "$PRIMARY_CONTAINER_FILE" <<JSON
{
  "image": "${IMAGE_URI}",
  "containerPort": 3000,
  "awsLogsConfiguration": {
    "logGroup": "/ecs/${PREFIX}",
    "logStreamPrefix": "web"
  },
  "environment": [
    { "name": "NODE_ENV", "value": "production" },
    { "name": "APP_ENV", "value": "${PREFIX}" },
    { "name": "PAYMENT_MODE", "value": "${PAYMENT_MODE}" },
    { "name": "DATABASE_HOST", "value": "${DATABASE_ENDPOINT}" },
    { "name": "DATABASE_PORT", "value": "5432" },
    { "name": "EXPORT_BUCKET_NAME", "value": "${EXPORT_BUCKET_NAME}" },
    { "name": "STRIPE_PRICE_PLUS", "value": "${STRIPE_PRICE_PLUS}" },
    { "name": "STRIPE_PRICE_PRO", "value": "${STRIPE_PRICE_PRO}" }
  ],
  "secrets": [
    { "name": "DATABASE_URL", "valueFrom": "arn:aws:secretsmanager:${REGION}:${AWS_ACCOUNT_ID}:secret:${PREFIX}/DATABASE_URL" },
    { "name": "NEXTAUTH_URL", "valueFrom": "arn:aws:secretsmanager:${REGION}:${AWS_ACCOUNT_ID}:secret:${PREFIX}/NEXTAUTH_URL" },
    { "name": "NEXTAUTH_SECRET", "valueFrom": "arn:aws:secretsmanager:${REGION}:${AWS_ACCOUNT_ID}:secret:${PREFIX}/NEXTAUTH_SECRET" },
    { "name": "GOOGLE_CLIENT_ID", "valueFrom": "arn:aws:secretsmanager:${REGION}:${AWS_ACCOUNT_ID}:secret:${PREFIX}/GOOGLE_CLIENT_ID" },
    { "name": "GOOGLE_CLIENT_SECRET", "valueFrom": "arn:aws:secretsmanager:${REGION}:${AWS_ACCOUNT_ID}:secret:${PREFIX}/GOOGLE_CLIENT_SECRET" },
    { "name": "APP_API_TOKEN_PEPPER", "valueFrom": "arn:aws:secretsmanager:${REGION}:${AWS_ACCOUNT_ID}:secret:${PREFIX}/APP_API_TOKEN_PEPPER" },
    { "name": "STRIPE_SECRET_KEY", "valueFrom": "arn:aws:secretsmanager:${REGION}:${AWS_ACCOUNT_ID}:secret:${PREFIX}/STRIPE_SECRET_KEY" },
    { "name": "STRIPE_WEBHOOK_SECRET", "valueFrom": "arn:aws:secretsmanager:${REGION}:${AWS_ACCOUNT_ID}:secret:${PREFIX}/STRIPE_WEBHOOK_SECRET" }
  ]
}
JSON

render_json "$NETWORK_CONFIGURATION_FILE" <<JSON
{
  "securityGroups": ["${APP_SECURITY_GROUP_ID}"],
  "subnets": ${PUBLIC_SUBNETS_JSON}
}
JSON

render_json "$SCALING_TARGET_FILE" <<'JSON'
{
  "minTaskCount": 1,
  "maxTaskCount": 1,
  "autoScalingMetric": "AVERAGE_CPU",
  "autoScalingTargetValue": 60
}
JSON

SERVICE_STATUS="$(aws_text ecs describe-express-gateway-service --region "$REGION" --service-arn "$SERVICE_ARN" --query 'service.status.statusCode')"

if [[ -n "$SERVICE_STATUS" && "$SERVICE_STATUS" != "None" ]]; then
  if [[ "$RECREATE_SERVICE" == "true" ]]; then
    log_step "Delete existing ECS Express service"
    aws ecs delete-express-gateway-service \
      --region "$REGION" \
      --service-arn "$SERVICE_ARN" \
      --monitor-resources RESOURCE \
      --monitor-mode TEXT-ONLY
    wait_for_service_deleted "$SERVICE_ARN"

    log_step "Create ECS Express service"
    create_service
  else
    log_step "Update ECS Express service"
    set +e
    UPDATE_OUTPUT="$(update_service 2>&1)"
    UPDATE_EXIT=$?
    set -e
    if [[ $UPDATE_EXIT -eq 0 ]]; then
      printf '%s\n' "$UPDATE_OUTPUT"
    elif grep -q "Resource not found" <<<"$UPDATE_OUTPUT"; then
      echo "$UPDATE_OUTPUT"
      echo "Existing service reference was stale. Falling back to create."
      log_step "Create ECS Express service"
      create_service
    else
      echo "$UPDATE_OUTPUT" >&2
      exit $UPDATE_EXIT
    fi
  fi
else
  log_step "Create ECS Express service"
  create_service
fi

RESOLVED_ENDPOINT="$(aws_text ecs describe-express-gateway-service --region "$REGION" --service-arn "$SERVICE_ARN" --query 'service.activeConfigurations[0].ingressPaths[0].endpoint')"
if [[ -z "$RESOLVED_ENDPOINT" || "$RESOLVED_ENDPOINT" == "None" ]]; then
  RESOLVED_APP_URL="https://${SERVICE_NAME}.ecs.${REGION}.on.aws"
elif [[ "$RESOLVED_ENDPOINT" == http* ]]; then
  RESOLVED_APP_URL="$RESOLVED_ENDPOINT"
else
  RESOLVED_APP_URL="https://${RESOLVED_ENDPOINT}"
fi

printf '\nDeployment finished.\n'
printf '  URL:      %s\n' "$RESOLVED_APP_URL"
printf '  Image:    %s\n' "$IMAGE_URI"
printf '  Database: %s\n' "$DATABASE_ENDPOINT"
