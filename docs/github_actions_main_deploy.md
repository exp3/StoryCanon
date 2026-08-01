# GitHub Actions Main Deploy

This repository includes a GitHub Actions workflow for automatic deployment when `main` is updated.

Target GitHub repository:

- `git@github.com:exp3/StoryCanon.git`

Files:

- `.github/workflows/deploy-main.yml`
- `scripts/deploy-ecs-express.sh`
- `scripts/github/aws-github-oidc-trust-policy.json`
- `scripts/github/aws-github-actions-policy.json`

## Deployment model

The workflow builds a commit-specific Docker image, pushes it to ECR, and then updates the ECS Express service to use that image.

Because the service update is done with a new image tag and ECS Express deployment monitoring, the old runtime stays in place until the new deployment becomes healthy. In practice, this gives a blue/green style cutover at the service level.

## Trigger

- Push to `main`
- Manual run with `workflow_dispatch`

## Required GitHub repository variables

- `AWS_REGION`
- `AWS_ACCOUNT_ID`
- `STORYCANON_STAGE`
  - Example: `prod`
- `APP_DOMAIN_NAME`
  - Optional if `NEXTAUTH_URL` is set directly
- `NEXTAUTH_URL`
  - Recommended for stable OAuth callback behavior
  - Example: `https://storycanon.example.com`
- `PAYMENT_MODE`
  - Example: `mock` or `live`
- `CDK_BOOTSTRAP`
  - `true` or `false`
  - Usually `false` after initial setup
- `ECS_RECREATE_SERVICE`
  - `true` or `false`
  - Use `true` only when immutable ECS Express settings must be recreated
- `STRIPE_PRICE_PLUS_MONTHLY`
  - Stripe Price ID for the Plus plan, monthly billing
- `STRIPE_PRICE_PLUS_YEARLY`
  - Stripe Price ID for the Plus plan, yearly billing
- `STRIPE_PRICE_PRO_MONTHLY`
  - Stripe Price ID for the Pro plan, monthly billing
- `STRIPE_PRICE_PRO_YEARLY`
  - Stripe Price ID for the Pro plan, yearly billing

## Required GitHub repository secrets

- `AWS_GITHUB_ACTIONS_ROLE_ARN`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXTAUTH_SECRET`
- `APP_API_TOKEN_PEPPER`

Required for billing (Stripe Checkout / Customer Portal / webhook):

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

## AWS role expectation

`AWS_GITHUB_ACTIONS_ROLE_ARN` should be an IAM role assumable by GitHub Actions OIDC for the `exp3/StoryCanon` repository and should be allowed to:

- deploy the StoryCanon CDK base stacks
- create and update ECS Express services
- push images to ECR
- write Secrets Manager values
- read CloudFormation outputs
- create and update the named IAM roles used by ECS Express

In other words, it needs permissions covering:

- CloudFormation
- ECS / ECS Express
- ECR
- IAM
- Secrets Manager
- EC2 describe calls used by ECS networking
- RDS describe calls used by dependent stack deployment

Repository-scoped templates are included here:

- trust policy: `scripts/github/aws-github-oidc-trust-policy.json`
- permissions policy: `scripts/github/aws-github-actions-policy.json`

Replace `<AWS_ACCOUNT_ID>` in the trust policy before use.

## Notes

- The workflow intentionally deploys only the base stacks (`network`, `storage`, `secrets`, `database`) from CDK. The runtime service itself is managed by `scripts/deploy-ecs-express.sh`.
- The legacy App Runner stack is not part of this workflow.
- For the current dev-oriented infrastructure setup, NAT Gateway is removed from new environments.
- For Google OAuth, make sure the callback URI includes:
  - `https://<your-domain>/api/auth/callback/google`
- For Stripe billing, create a webhook endpoint in the Stripe Dashboard pointing to:
  - `https://<your-domain>/api/stripe/webhook`
  - Subscribed events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
  - Copy its signing secret into `STRIPE_WEBHOOK_SECRET`

## First-time setup flow

1. Create the target AWS environment once, or let the workflow create/update the base stacks.
2. Configure the GitHub OIDC IAM role for `exp3/StoryCanon` and save its ARN in `AWS_GITHUB_ACTIONS_ROLE_ARN`.
3. Set all required repository variables and secrets.
4. Add the Google OAuth callback URL for the final production domain.
5. Merge into `main`.

## Recommended GitHub settings

- Repository: `exp3/StoryCanon`
- Default branch: `main`
- GitHub Environment: `production`
- Store production deployment secrets in the `production` environment when possible

## Rollback

This workflow does not yet create a separate GitHub-level rollback workflow.

Operational rollback options today:

- rerun deployment with a previously known-good image tag
- manually update the ECS Express service to the previous image
- if needed, extend `scripts/deploy-ecs-express.sh` to accept an explicit `IMAGE_TAG`

The script already accepts `IMAGE_TAG`, so a manual workflow dispatch can be extended later for targeted rollback.
