#!/usr/bin/env bash
set -euo pipefail

# Deploys StoryCanon as an ECS Fargate service behind a self-managed ALB, using
# CodeDeploy blue/green for zero-downtime cutovers (see infra/lib/compute-stack.ts).
#
# Flow:
#   1. Deploy base stacks (network/storage/secrets/database) and populate secrets.
#   2. Ensure the ECR repo exists, then build+push the image BEFORE the service is
#      created (a CODE_DEPLOY service that cannot pull :latest fails to stabilize).
#   3. Deploy the compute stack with useExistingEcrRepository=true.
#   4. Register a task definition revision for the commit image, then apply the
#      Prisma migrations once as a one-off ECS task running that same image.
#   5. First deploy: the service is created by CDK already running :latest, so no
#      CodeDeploy run is needed. Subsequent deploys drive a CodeDeploy blue/green
#      deployment onto the revision from step 4.

log_step() { printf '\n==> %s\n' "$1"; }

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Environment variable '$name' is required." >&2
    exit 1
  fi
}

put_secret() {
  aws secretsmanager put-secret-value \
    --region "$REGION" \
    --secret-id "$PREFIX/$1" \
    --secret-string "$2" >/dev/null
}

put_secret_if_set() {
  if [[ -n "$2" ]]; then
    put_secret "$1" "$2"
  fi
}

stack_output() {
  aws cloudformation describe-stacks \
    --region "$REGION" \
    --stack-name "$1" \
    --query "Stacks[0].Outputs[?OutputKey=='$2'].OutputValue | [0]" \
    --output text
}

stack_exists() {
  aws cloudformation describe-stacks --region "$REGION" --stack-name "$1" >/dev/null 2>&1
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
REPOSITORY_NAME="$PREFIX-web"
REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
IMAGE_TAG="${IMAGE_TAG:-${GITHUB_SHA:-latest}}"
IMAGE_URI="${REGISTRY}/${REPOSITORY_NAME}:${IMAGE_TAG}"
LATEST_IMAGE_URI="${REGISTRY}/${REPOSITORY_NAME}:latest"
APP_DOMAIN_NAME="${APP_DOMAIN_NAME:-}"
HOSTED_ZONE_NAME="${HOSTED_ZONE_NAME:-}"
NEXTAUTH_URL_INPUT="${NEXTAUTH_URL:-}"
BOOTSTRAP="${BOOTSTRAP:-false}"
PAYMENT_MODE="${PAYMENT_MODE:-mock}"
GA_MEASUREMENT_ID="${GA_MEASUREMENT_ID:-}"
STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY:-}"
STRIPE_WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET:-}"
STRIPE_PRICE_PLUS_MONTHLY="${STRIPE_PRICE_PLUS_MONTHLY:-}"
STRIPE_PRICE_PLUS_YEARLY="${STRIPE_PRICE_PLUS_YEARLY:-}"
STRIPE_PRICE_PRO_MONTHLY="${STRIPE_PRICE_PRO_MONTHLY:-}"
STRIPE_PRICE_PRO_YEARLY="${STRIPE_PRICE_PRO_YEARLY:-}"
COMPUTE_STACK="$PREFIX-app"
CONTAINER_NAME="web"
CONTAINER_PORT="3000"

export AWS_REGION
export CDK_DEFAULT_ACCOUNT="$AWS_ACCOUNT_ID"
export CDK_DEFAULT_REGION="$REGION"
# Read by infra/bin/storycanon.ts when synthesizing the compute stack.
export PAYMENT_MODE HOSTED_ZONE_NAME APP_DOMAIN_NAME GA_MEASUREMENT_ID
export STRIPE_PRICE_PLUS_MONTHLY STRIPE_PRICE_PLUS_YEARLY STRIPE_PRICE_PRO_MONTHLY STRIPE_PRICE_PRO_YEARLY

if [[ -n "$NEXTAUTH_URL_INPUT" ]]; then
  RESOLVED_NEXTAUTH_URL="$NEXTAUTH_URL_INPUT"
elif [[ -n "$APP_DOMAIN_NAME" ]]; then
  RESOLVED_NEXTAUTH_URL="https://${APP_DOMAIN_NAME}"
else
  RESOLVED_NEXTAUTH_URL=""
fi

echo "StoryCanon blue/green deployment"
echo "  Stage:          $STAGE"
echo "  Region:         $REGION"
echo "  Account:        $AWS_ACCOUNT_ID"
echo "  Prefix:         $PREFIX"
echo "  Image:          $IMAGE_URI"
echo "  NEXTAUTH_URL:   ${RESOLVED_NEXTAUTH_URL:-<unchanged>}"

ACTUAL_ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
if [[ "$ACTUAL_ACCOUNT" != "$AWS_ACCOUNT_ID" ]]; then
  echo "AWS account mismatch. Expected $AWS_ACCOUNT_ID but got $ACTUAL_ACCOUNT." >&2
  exit 1
fi

if [[ "$BOOTSTRAP" == "true" ]]; then
  log_step "CDK bootstrap"
  ( cd infra && npx cdk bootstrap "aws://${AWS_ACCOUNT_ID}/${REGION}" )
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

for value in "$DATABASE_SECRET_ARN" "$DATABASE_ENDPOINT"; do
  if [[ -z "$value" || "$value" == "None" ]]; then
    echo "Could not read required CloudFormation output." >&2
    exit 1
  fi
done

DB_PASSWORD_JSON="$(aws secretsmanager get-secret-value --region "$REGION" --secret-id "$DATABASE_SECRET_ARN" --query SecretString --output text)"
DB_PASSWORD="$(python -c 'import json,sys; print(json.loads(sys.stdin.read())["password"])' <<<"$DB_PASSWORD_JSON")"
# `sslmode=no-verify`: RDS sets rds.force_ssl=1, and Prisma 7 connects through
# node-postgres, which unlike the old Rust engine defaults to no TLS at all.
# This encrypts without verifying the certificate, which is what the engine
# effectively did (sslmode=prefer). `require` would mean full verification here
# and warns that it changes meaning in pg v9, so it is deliberately not used.
DATABASE_URL="postgresql://storycanon:${DB_PASSWORD}@${DATABASE_ENDPOINT}:5432/storycanon?schema=public&sslmode=no-verify"

log_step "Update application secrets"
put_secret "DATABASE_URL" "$DATABASE_URL"
put_secret_if_set "NEXTAUTH_URL" "$RESOLVED_NEXTAUTH_URL"
put_secret "NEXTAUTH_SECRET" "$NEXTAUTH_SECRET"
put_secret "GOOGLE_CLIENT_ID" "$GOOGLE_CLIENT_ID"
put_secret "GOOGLE_CLIENT_SECRET" "$GOOGLE_CLIENT_SECRET"
put_secret "APP_API_TOKEN_PEPPER" "$APP_API_TOKEN_PEPPER"
put_secret_if_set "STRIPE_SECRET_KEY" "$STRIPE_SECRET_KEY"
put_secret_if_set "STRIPE_WEBHOOK_SECRET" "$STRIPE_WEBHOOK_SECRET"

# The compute stack references an existing ECR repo, so it must exist and hold a
# :latest image before the service is created.
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

COMPUTE_EXISTS=false
if stack_exists "$COMPUTE_STACK"; then
  COMPUTE_EXISTS=true
fi

log_step "Deploy compute stack (ALB + blue/green service)"
(
  cd infra
  npx cdk deploy "$COMPUTE_STACK" \
    -c "stage=${STAGE}" \
    -c "region=${REGION}" \
    -c "useExistingEcrRepository=true" \
    --require-approval never
)

log_step "Register task definition revision for this commit"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

# Take the task definition CDK manages (env, secrets, roles) and register a new
# revision that only swaps the container image to the commit-tagged one. This
# happens before the migration step below so that migrations run on exactly the
# image that is about to serve traffic.
aws ecs describe-task-definition \
  --region "$REGION" \
  --task-definition "$REPOSITORY_NAME" \
  --query "taskDefinition" > "$TMP_DIR/current-td.json"

python -c '
import json, sys
td = json.load(open(sys.argv[1]))
image = sys.argv[2]
container = sys.argv[3]
matched = False
for c in td.get("containerDefinitions", []):
    if c.get("name") == container:
        c["image"] = image
        matched = True
# Without this, renaming the container in compute-stack.ts would quietly register
# a revision still carrying the previous image - and the migration task below
# would then apply migrations from the OLD code while reporting success.
if not matched:
    sys.exit("Container %r is not in task definition %r." % (container, sys.argv[1]))
for key in ["taskDefinitionArn", "revision", "status", "requiresAttributes",
            "compatibilities", "registeredAt", "registeredBy"]:
    td.pop(key, None)
json.dump(td, open(sys.argv[4], "w"))
' "$TMP_DIR/current-td.json" "$IMAGE_URI" "$CONTAINER_NAME" "$TMP_DIR/new-td.json"

NEW_TD_ARN="$(aws ecs register-task-definition \
  --region "$REGION" \
  --cli-input-json "file://$TMP_DIR/new-td.json" \
  --query "taskDefinition.taskDefinitionArn" \
  --output text)"

echo "Registered task definition: $NEW_TD_ARN"

# Migrations used to run from the container's CMD, which meant every task start
# re-ran them - including the green task of a blue/green deploy, while blue was
# still serving the old code against the schema being changed. Applying them
# once here, before any traffic shifts, makes that ordering explicit.
#
# The runner itself cannot reach the database: RDS sits in PRIVATE_ISOLATED
# subnets with no NAT and no public endpoint. So this runs as a one-off Fargate
# task inside the VPC on the service's security group - the one the database
# stack's ingress rule trusts on 5432 - and picks DATABASE_URL up from the task
# definition's Secrets Manager bindings. The public IP is required because
# natGateways is 0: pulling from ECR and reading secrets both go via the IGW.
#
# Note the asymmetry this creates: the schema moves forward here, but the
# CodeDeploy group below has autoRollback enabled, and a rollback returns
# traffic to blue WITHOUT reverting the schema. Migrations therefore have to be
# expand-only - additive, and readable by the previous revision - or a failed
# bake turns into an outage instead of a rollback.
log_step "Apply database migrations"

CLUSTER_NAME="$(stack_output "$COMPUTE_STACK" "ClusterName")"
SERVICE_SG_ID="$(stack_output "$COMPUTE_STACK" "ServiceSecurityGroupId")"
PUBLIC_SUBNET_IDS="$(stack_output "${PREFIX}-network" "PublicSubnetIds")"

for value in "$CLUSTER_NAME" "$SERVICE_SG_ID" "$PUBLIC_SUBNET_IDS"; do
  if [[ -z "$value" || "$value" == "None" ]]; then
    echo "Could not read the outputs needed to run the migration task." >&2
    exit 1
  fi
done

MIGRATION_OVERRIDES="$(python -c '
import json, sys
print(json.dumps({
    "containerOverrides": [{
        "name": sys.argv[1],
        "command": ["sh", "-c", "cd apps/web && ../../node_modules/.bin/prisma migrate deploy"],
    }],
}))
' "$CONTAINER_NAME")"

MIGRATION_TASK_ARN="$(aws ecs run-task \
  --region "$REGION" \
  --cluster "$CLUSTER_NAME" \
  --task-definition "$NEW_TD_ARN" \
  --launch-type FARGATE \
  --count 1 \
  --started-by "migrate-${IMAGE_TAG:0:12}" \
  --network-configuration "awsvpcConfiguration={subnets=[$PUBLIC_SUBNET_IDS],securityGroups=[$SERVICE_SG_ID],assignPublicIp=ENABLED}" \
  --overrides "$MIGRATION_OVERRIDES" \
  --query "tasks[0].taskArn" \
  --output text)"

if [[ -z "$MIGRATION_TASK_ARN" || "$MIGRATION_TASK_ARN" == "None" ]]; then
  echo "Migration task did not start. Check the ECS RunTask failures on $CLUSTER_NAME." >&2
  exit 1
fi

echo "Migration task: $MIGRATION_TASK_ARN"

# Polled explicitly rather than with `aws ecs wait tasks-stopped`, whose waiter
# is hard-coded to 6s x 100 attempts. Those 600 seconds have to cover
# provisioning, the image pull and secret resolution before the migration even
# begins, and exceeding them kills this script under `set -e` while the task
# keeps running and commits anyway - which would leave production on old code
# against a migrated schema, with no failed deploy to point at. Raise
# MIGRATION_TIMEOUT_SECONDS before shipping a migration that rewrites a large
# table.
MIGRATION_TIMEOUT_SECONDS="${MIGRATION_TIMEOUT_SECONDS:-1800}"
MIGRATION_POLL_SECONDS=10
MIGRATION_WAITED=0

while true; do
  MIGRATION_STATUS="$(aws ecs describe-tasks \
    --region "$REGION" \
    --cluster "$CLUSTER_NAME" \
    --tasks "$MIGRATION_TASK_ARN" \
    --query "tasks[0].lastStatus" \
    --output text)"

  # "None" means ECS no longer knows about the task. Break either way and let
  # the exit-code gate below decide - it treats a missing code as a failure.
  if [[ "$MIGRATION_STATUS" == "STOPPED" || "$MIGRATION_STATUS" == "None" ]]; then
    break
  fi

  if (( MIGRATION_WAITED >= MIGRATION_TIMEOUT_SECONDS )); then
    echo "Migration task still ${MIGRATION_STATUS} after ${MIGRATION_TIMEOUT_SECONDS}s." >&2
    echo "It may yet finish and commit. Inspect $MIGRATION_TASK_ARN before redeploying." >&2
    echo "No traffic was shifted." >&2
    exit 1
  fi

  sleep "$MIGRATION_POLL_SECONDS"
  MIGRATION_WAITED=$(( MIGRATION_WAITED + MIGRATION_POLL_SECONDS ))
done

MIGRATION_EXIT_CODE="$(aws ecs describe-tasks \
  --region "$REGION" \
  --cluster "$CLUSTER_NAME" \
  --tasks "$MIGRATION_TASK_ARN" \
  --query "tasks[0].containers[0].exitCode" \
  --output text)"

# Shipping new code onto an un-migrated schema is worse than not shipping, so a
# non-zero exit code - or "None", meaning the container never ran at all - stops
# the deploy here, before CodeDeploy shifts any traffic.
if [[ "$MIGRATION_EXIT_CODE" != "0" ]]; then
  # `|| echo` so a throttled lookup cannot exit the script under `set -e` and
  # swallow the very message it exists to decorate.
  MIGRATION_STOPPED_REASON="$(aws ecs describe-tasks \
    --region "$REGION" \
    --cluster "$CLUSTER_NAME" \
    --tasks "$MIGRATION_TASK_ARN" \
    --query "tasks[0].stoppedReason" \
    --output text 2>/dev/null || echo "unavailable")"
  echo "Migrations failed (exit code: $MIGRATION_EXIT_CODE, reason: $MIGRATION_STOPPED_REASON)." >&2
  echo "Logs are in /ecs/${PREFIX} under the 'web' stream prefix. No traffic was shifted." >&2
  exit 1
fi

echo "Migrations applied."

if [[ "$COMPUTE_EXISTS" == "false" ]]; then
  log_step "First deploy: service created by CDK on the pushed image"
  # On a brand new environment CDK creates the service during the compute stack
  # deploy above, so it briefly runs against a schema the step above had not
  # applied yet. It converges as soon as the migrations land, and a first deploy
  # has no traffic to disturb.
  echo "The freshly created service is already running ${IMAGE_URI}. No CodeDeploy run needed."
else
  log_step "Blue/green deployment via CodeDeploy"

  CD_APP="$(stack_output "$COMPUTE_STACK" "CodeDeployApplicationName")"
  CD_DG="$(stack_output "$COMPUTE_STACK" "CodeDeployDeploymentGroupName")"
  if [[ -z "$CD_APP" || "$CD_APP" == "None" || -z "$CD_DG" || "$CD_DG" == "None" ]]; then
    echo "Could not read CodeDeploy outputs from $COMPUTE_STACK." >&2
    exit 1
  fi

  # AppSpec tells CodeDeploy which task def + container/port to shift traffic onto.
  APPSPEC_CONTENT="$(python -c '
import json, sys
appspec = {
    "version": 0.0,
    "Resources": [{
        "TargetService": {
            "Type": "AWS::ECS::Service",
            "Properties": {
                "TaskDefinition": sys.argv[1],
                "LoadBalancerInfo": {
                    "ContainerName": sys.argv[2],
                    "ContainerPort": int(sys.argv[3]),
                },
            },
        },
    }],
}
print(json.dumps(appspec))
' "$NEW_TD_ARN" "$CONTAINER_NAME" "$CONTAINER_PORT")"

  REVISION="$(python -c '
import json, sys
print(json.dumps({
    "revisionType": "AppSpecContent",
    "appSpecContent": {"content": sys.argv[1]},
}))
' "$APPSPEC_CONTENT")"

  DEPLOYMENT_ID="$(aws deploy create-deployment \
    --region "$REGION" \
    --application-name "$CD_APP" \
    --deployment-group-name "$CD_DG" \
    --revision "$REVISION" \
    --description "StoryCanon $IMAGE_TAG" \
    --query "deploymentId" \
    --output text)"

  echo "CodeDeploy deployment: $DEPLOYMENT_ID"
  echo "Waiting for blue/green cutover and bake to finish..."
  aws deploy wait deployment-successful --region "$REGION" --deployment-id "$DEPLOYMENT_ID"
fi

ALB_DNS="$(stack_output "$COMPUTE_STACK" "AlbDnsName")"

printf '\nDeployment finished.\n'
printf '  ALB:      http://%s\n' "$ALB_DNS"
printf '  Image:    %s\n' "$IMAGE_URI"
printf '  Database: %s\n' "$DATABASE_ENDPOINT"
