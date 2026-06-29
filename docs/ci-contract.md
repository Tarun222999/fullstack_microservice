# CI Contract

This document describes the current Continuous Integration contract for this repository.

## Purpose

The phase 1 CI pipeline is the merge gate for normal code changes. Its job is to prove that a clean runner can:

- install dependencies reproducibly
- lint all workspaces
- typecheck all workspaces
- verify formatting
- run the phase 1 test suites
- build every workspace/service

It does not deploy anything.

## Triggers

The GitHub Actions workflow lives at `.github/workflows/ci.yml` and runs on:

- every `pull_request`
- every `push` to `main`

## Runtime Contract

The CI runner uses:

- Node `22`
- pnpm `10.28.1`
- Go version from `services/email-service/go.mod`

Dependencies are installed with:

```bash
pnpm install --frozen-lockfile
```

This means CI installs exactly what is recorded in `pnpm-lock.yaml` and fails if the lockfile and manifests drift out of sync.

## Required Merge Check

The required GitHub status check for merging into `main` is:

- `Validate`

Branch protection should also require:

- pull requests before merging
- status checks to pass before merging
- branches to be up to date before merging
- force pushes blocked

## Validation Flow

The workflow executes `scripts/verify-ci-prereqs.ps1`, which currently runs these checks workspace-by-workspace:

### Lint

- `pnpm --filter @chatapp/common run lint`
- `pnpm --filter @chatapp/auth-service run lint`
- `pnpm --filter @chatapp/user-service run lint`
- `pnpm --filter chat-service run lint`
- `pnpm --filter gateway-service run lint`

### Typecheck

- `pnpm --filter @chatapp/common run typecheck`
- `pnpm --filter @chatapp/auth-service run typecheck`
- `pnpm --filter @chatapp/user-service run typecheck`
- `pnpm --filter chat-service run typecheck`
- `pnpm --filter gateway-service run typecheck`

### Format Check

- `pnpm --filter @chatapp/common run format:check`
- `pnpm --filter @chatapp/auth-service run format:check`
- `pnpm --filter @chatapp/user-service run format:check`
- `pnpm --filter chat-service run format:check`
- `pnpm --filter gateway-service run format:check`
- `gofmt -l .` inside `services/email-service`

### Tests

- `pnpm --filter @chatapp/auth-service run test`
- `pnpm --filter @chatapp/user-service run test`
- `pnpm --filter chat-service run test`
- `pnpm --filter gateway-service run test`
- `go test ./...` inside `services/email-service`

### Build

- `pnpm --filter @chatapp/common run build`
- `pnpm --filter @chatapp/auth-service run build`
- `pnpm --filter @chatapp/user-service run build`
- `pnpm --filter chat-service run build`
- `pnpm --filter gateway-service run build`
- `go build ./...` inside `services/email-service`

## Why The Checks Run Workspace-By-Workspace

The repository uses explicit workspace commands in CI instead of root recursive `pnpm -r ...` commands because local Windows verification exposed `spawn EPERM` issues with recursive pnpm process launching. The explicit commands are easier to verify and have been reliable in GitHub Actions.

## Phase Boundary

Phase 1 CI includes:

- lint
- typecheck
- format verification
- unit/service test suites
- builds

Phase 2 CI will add DB/Testcontainers integration lanes. Those tests are documented separately in [db-testing.md](./db-testing.md) and are intentionally not part of the first merge gate.

## Local Verification

Before opening a PR, you can run the same validation flow locally with:

```powershell
.\scripts\verify-ci-prereqs.ps1
```

If CI fails, the expected workflow is:

1. inspect the first failing step
2. fix the underlying code/config issue
3. push again and let the PR rerun

## Future Improvements

Possible next improvements after CI phase 1:

- split the workflow into multiple jobs for faster feedback
- add caching refinements if needed
- add DB integration test lanes in phase 2
- add CD only after CI remains stable
