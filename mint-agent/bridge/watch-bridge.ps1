# mint-agent diagnostic bridge — watcher half.
#
# What this is: lets Claude hand you a read-only diagnostic request (e.g.
# "run inspectDrop.js against gogh-punks-robinhood") without you typing the
# command yourself, by dropping a request file into bridge/requests/ and
# reading the result back from bridge/responses/. This script is the only
# thing that ever actually executes anything — Claude has no way to run
# code on this machine directly, it can only write files here.
#
# Hard safety boundary — read this before running it:
#   - $allowedScripts below is a FIXED allowlist. A request naming any
#     script not on this list is rejected, no exceptions, regardless of
#     what the request file claims.
#   - index.js ("run"/"watch") is deliberately EXCLUDED from the allowlist,
#     permanently. Nothing reachable through this bridge can ever broadcast
#     a transaction, touch wallets.json, or flip dryRun — independent of
#     whatever approved-mints.json currently says. If a future need
#     legitimately requires widening this list, that's a deliberate edit
#     you make to this file yourself, not something this script does on
#     its own.
#   - Arguments are checked against a strict allowed-characters pattern
#     before use, and are always passed as an array to `node`, never
#     interpolated into a shell string — so a crafted argument can't smuggle
#     in extra commands.
#   - Every request and response is appended to bridge-log.jsonl, so there's
#     a full record of everything this bridge has ever run.
#
# Start with:   powershell -ExecutionPolicy Bypass -File bridge\watch-bridge.ps1
# Stop with:    Ctrl+C — safe to stop/start any time, nothing is lost.

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot          # mint-agent/
$requestsDir  = Join-Path $PSScriptRoot "requests"
$responsesDir = Join-Path $PSScriptRoot "responses"
$processedDir = Join-Path $PSScriptRoot "processed"
$logFile      = Join-Path $PSScriptRoot "bridge-log.jsonl"

foreach ($d in @($requestsDir, $responsesDir, $processedDir)) {
    if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d | Out-Null }
}

# The entire point of this bridge is that it can NEVER run anything outside
# this fixed list, no matter what a request file contains. Both entries are
# read-only diagnostics — neither can send a transaction or touch a wallet.
$allowedScripts = @("inspectDrop.js", "validateTarget.js")
$argPattern = '^[a-zA-Z0-9_.\-]+$'

Write-Host "mint-agent diagnostic bridge watching $requestsDir (Ctrl+C to stop)"
Write-Host "Allowed scripts: $($allowedScripts -join ', ')"
Write-Host "Everything this bridge does is logged to $logFile"
Write-Host ""

while ($true) {
    $requests = Get-ChildItem -Path $requestsDir -Filter "*.json" -ErrorAction SilentlyContinue

    foreach ($reqFile in $requests) {
        $req = $null
        try {
            $req = Get-Content $reqFile.FullName -Raw | ConvertFrom-Json

            if (-not $req.id -or -not $req.script) {
                throw "Malformed request: missing id or script"
            }
            if ($allowedScripts -notcontains $req.script) {
                throw "Script '$($req.script)' is not on the allowlist ($($allowedScripts -join ', '))"
            }

            $callArgs = @()
            if ($req.args) {
                foreach ($a in $req.args) {
                    if ($a -notmatch $argPattern) {
                        throw "Argument '$a' contains characters outside the allowed set"
                    }
                    $callArgs += $a
                }
            }

            Push-Location $root
            try {
                $output = & node "src/$($req.script)" @callArgs 2>&1 | Out-String
                $exitCode = $LASTEXITCODE
            } finally {
                Pop-Location
            }

            $response = [ordered]@{
                id          = $req.id
                script      = $req.script
                args        = $callArgs
                exitCode    = $exitCode
                output      = $output
                completedAt = (Get-Date).ToUniversalTime().ToString("o")
            }
        } catch {
            $fallbackId = if ($req -and $req.id) { $req.id } else { $reqFile.BaseName }
            $response = [ordered]@{
                id          = $fallbackId
                error       = $_.Exception.Message
                completedAt = (Get-Date).ToUniversalTime().ToString("o")
            }
        }

        $responsePath = Join-Path $responsesDir "$($response.id).json"
        $response | ConvertTo-Json -Depth 5 | Set-Content -Path $responsePath -Encoding utf8

        ($response | ConvertTo-Json -Depth 5 -Compress) | Add-Content -Path $logFile

        Move-Item -Path $reqFile.FullName -Destination (Join-Path $processedDir $reqFile.Name) -Force
        Write-Host "[$($response.completedAt)] handled request $($response.id)"
    }

    Start-Sleep -Seconds 3
}
