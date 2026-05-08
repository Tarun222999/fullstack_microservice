# CD Contract

This document describes the current Continuous Delivery/Deployment contract for this repository.

## Purpose

The first CD workflow is intentionally small and production-focused. Its job is to provide a controlled way to deploy the application services to Railway production after CI is already green.

It is not responsible for:

- running CI checks
- database creation
- database migration automation
- staging deployment
- rollback automation

## Current Release Model

The current deployment model is:

- manual workflow start
- explicit CI-success verification for the current `main` commit
- production approval before deployment
- direct deploy to Railway production
- health verification after deployment

## Trigger

The GitHub Actions workflow lives at `.github/workflows/cd.yml` and runs only via:

- `workflow_dispatch`

That means deployments do not start automatically on push or merge. A human must manually start the workflow from the GitHub Actions UI.

## Branch Policy

Production deployments are allowed only from:

- `main`

The workflow fails early if it is triggered from any other branch.

The workflow also verifies that the `CI` workflow succeeded for the current `main` commit before Railway deployment begins. This is an explicit CD gate in addition to branch protection.

## Production Approval

The deployment job targets the GitHub environment:

- `fearless-creation / production`

This environment is the production approval gate.

Because it has required reviewers configured, the job pauses before deployment and waits for approval. Only after approval does the job receive access to the production-scoped Railway secret and variables stored in that environment.

## Railway Deployment Model

Deployments are executed through the Railway CLI using a Railway project token.

The workflow uses:

- `RAILWAY_TOKEN` as an environment secret
- `RAILWAY_PROJECT_ID` as an environment variable
- `RAILWAY_PROJECT_NAME` as an environment variable

The Railway CLI deploy command used is `railway up`.

The GitHub Actions workflow pins the Railway CLI version to `4.40.0` for reproducible deploy behavior across runs.

Railway documentation notes:

- `railway up` uploads and deploys the current code archive
- `--service` targets a specific service
- `--environment` targets a specific Railway environment
- `--project` targets a specific Railway project
- `--ci` is intended for CI/CD usage

Sources:

- [Railway CLI: Deploying with the CLI](https://docs.railway.com/cli/deploying)
- [Railway CLI: railway up](https://docs.railway.com/cli/up)
- [Railway CLI overview](https://docs.railway.com/cli)

## Deploy Scope

The manual workflow currently supports a `deploy_scope` input with these options:

- `all`
- `auth-service`
- `user-service`
- `chat-service`
- `gateway-service`

If `all` is selected, services deploy in this order:

1. `auth-service`
2. `user-service`
3. `chat-service`
4. `gateway-service`

This keeps the public gateway last so internal services update first.

## Health Check

After deployment, the workflow verifies:

- [Gateway health](https://gateway-service-production-4262.up.railway.app/health)

If the health check fails, the workflow fails.

## Database Policy

The current CD workflow does not automate database changes.

That means:

- application services are deployed
- existing production databases remain in place
- no database is recreated by the workflow
- schema migrations stay manual for now

This is intentional for the first production deployment phase.

## Future Evolution

Likely future improvements:

- add staging before production
- run smoke tests beyond `/health`
- promote from staging to production
- automate carefully reviewed migrations
- add rollback procedures
