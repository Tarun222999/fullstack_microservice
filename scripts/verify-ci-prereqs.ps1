Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

function Invoke-Step {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Label,

        [Parameter(Mandatory = $true)]
        [string]$Command
    )

    Write-Host ""
    Write-Host "==> $Label" -ForegroundColor Cyan
    Write-Host "    $Command" -ForegroundColor DarkGray

    & powershell -NoProfile -Command $Command
    if ($LASTEXITCODE -ne 0) {
        throw "Step failed: $Label"
    }
}

Write-Host "Repo: $repoRoot" -ForegroundColor Green
Invoke-Step -Label "Node version" -Command "node -v"
Invoke-Step -Label "pnpm version" -Command "pnpm -v"

$steps = @(
    @{ Label = "Lint common"; Command = "pnpm --filter @chatapp/common run lint" },
    @{ Label = "Lint auth-service"; Command = "pnpm --filter @chatapp/auth-service run lint" },
    @{ Label = "Lint user-service"; Command = "pnpm --filter @chatapp/user-service run lint" },
    @{ Label = "Lint chat-service"; Command = "pnpm --filter chat-service run lint" },
    @{ Label = "Lint gateway-service"; Command = "pnpm --filter gateway-service run lint" },

    @{ Label = "Typecheck common"; Command = "pnpm --filter @chatapp/common run typecheck" },
    @{ Label = "Typecheck auth-service"; Command = "pnpm --filter @chatapp/auth-service run typecheck" },
    @{ Label = "Typecheck user-service"; Command = "pnpm --filter @chatapp/user-service run typecheck" },
    @{ Label = "Typecheck chat-service"; Command = "pnpm --filter chat-service run typecheck" },
    @{ Label = "Typecheck gateway-service"; Command = "pnpm --filter gateway-service run typecheck" },

    @{ Label = "Format check common"; Command = "pnpm --filter @chatapp/common run format:check" },
    @{ Label = "Format check auth-service"; Command = "pnpm --filter @chatapp/auth-service run format:check" },
    @{ Label = "Format check user-service"; Command = "pnpm --filter @chatapp/user-service run format:check" },
    @{ Label = "Format check chat-service"; Command = "pnpm --filter chat-service run format:check" },
    @{ Label = "Format check gateway-service"; Command = "pnpm --filter gateway-service run format:check" },

    @{ Label = "Test auth-service"; Command = "pnpm --filter @chatapp/auth-service run test" },
    @{ Label = "Test user-service"; Command = "pnpm --filter @chatapp/user-service run test" },
    @{ Label = "Test chat-service"; Command = "pnpm --filter chat-service run test" },
    @{ Label = "Test gateway-service"; Command = "pnpm --filter gateway-service run test" },

    @{ Label = "Build common"; Command = "pnpm --filter @chatapp/common run build" },
    @{ Label = "Build auth-service"; Command = "pnpm --filter @chatapp/auth-service run build" },
    @{ Label = "Build user-service"; Command = "pnpm --filter @chatapp/user-service run build" },
    @{ Label = "Build chat-service"; Command = "pnpm --filter chat-service run build" },
    @{ Label = "Build gateway-service"; Command = "pnpm --filter gateway-service run build" }
)

foreach ($step in $steps) {
    Invoke-Step -Label $step.Label -Command $step.Command
}

Write-Host ""
Write-Host "All CI prerequisite checks passed." -ForegroundColor Green
