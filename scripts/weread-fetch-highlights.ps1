# Batch driver for authorized real-data capture. Read-only, resumable, no raw text printed.
#
# Usage:
#   ./scripts/weread-fetch-highlights.ps1 -BuildPlan
#   ./scripts/weread-fetch-highlights.ps1 -Limit 25
#
# Behaviour:
#   - Plan is derived from cached notebook pages, deduplicated by bookId (cursor pages can overlap).
#   - Existing capture files are never overwritten or re-fetched, so the run is resumable.
#   - Only highlight content (/book/bookmarklist) is requested; personal thoughts are not collected.
#   - Output lives under .private/weread/highlights/ and stays out of version control.
[CmdletBinding(DefaultParameterSetName = 'Fetch')]
param(
    [Parameter(ParameterSetName = 'Plan')]
    [switch]$BuildPlan,
    [int]$Limit = [int]::MaxValue,
    [int]$DelayMs = 400,
    [int]$MinHighlights = 1
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$privateDir = Join-Path $root '.private'
$rawDir = Join-Path $privateDir 'weread'
$outDir = Join-Path $rawDir 'highlights'
$curationDir = Join-Path $privateDir 'curation'
$planPath = Join-Path $curationDir 'fetch-plan.json'
$logPath = Join-Path $curationDir 'fetch-log.json'

function Read-JsonFile([string]$Path) {
    return [System.IO.File]::ReadAllText($Path) | ConvertFrom-Json
}

if ($BuildPlan) {
    $pages = Get-ChildItem $rawDir -File -Filter 'notebooks-page-*.json' | Sort-Object Name
    if ($pages.Count -eq 0) { throw 'No cached notebook pages. Fetch the overview first.' }
    $byId = @{}
    foreach ($page in $pages) {
        foreach ($item in @((Read-JsonFile $page.FullName).books)) {
            $id = [string]$item.bookId
            if ([string]::IsNullOrWhiteSpace($id)) { continue }
            # Cursor pages can repeat an entry; keep the richest observation.
            if (-not $byId.ContainsKey($id) -or [int]$item.noteCount -gt [int]$byId[$id].noteCount) {
                $byId[$id] = $item
            }
        }
    }
    $ranked = $byId.Values | Where-Object { $_.noteCount -ge $MinHighlights } |
        Sort-Object @{ Expression = { [int]$_.noteCount }; Descending = $true }, bookId
    $i = 0
    $plan = foreach ($item in $ranked) {
        $i++
        [pscustomobject]@{
            index       = $i
            bookId      = [string]$item.bookId
            noteCount   = [int]$item.noteCount
            bookFile    = 'highlights-{0:d3}.json' -f $i
            title       = [string]$item.book.title
            author      = [string]$item.book.author
            markedStatus = $item.markedStatus
            readingProgress = $item.readingProgress
        }
    }
    New-Item -ItemType Directory -Path $curationDir -Force | Out-Null
    [System.IO.File]::WriteAllText($planPath, (@($plan) | ConvertTo-Json -Depth 5), (New-Object System.Text.UTF8Encoding($false)))
    Write-Output ("plan entries: {0}" -f @($plan).Count)
    Write-Output ("planned highlight lines: {0}" -f (($plan | Measure-Object noteCount -Sum).Sum))
    Write-Output "plan written: .private/curation/fetch-plan.json"
    return
}

if (-not (Test-Path $planPath)) { throw 'No fetch plan. Run with -BuildPlan first.' }
# Note: Read-JsonFile returns a deserialized array as a single object; do not wrap it in @(), which would nest it.
$plan = Read-JsonFile $planPath
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

$log = [ordered]@{ startedAt = (Get-Date).ToString('s'); ok = @(); failed = @(); skippedExisting = 0; requested = 0 }
foreach ($entry in $plan) {
    $target = Join-Path $outDir $entry.bookFile
    if (Test-Path -LiteralPath $target) { $log.skippedExisting++; continue }
    if ($log.requested -ge $Limit) { break }
    $log.requested++
    try {
        & (Join-Path $PSScriptRoot 'weread-request.ps1') -ApiName '/book/bookmarklist' `
            -Parameters @{ bookId = $entry.bookId } -OutputName ("highlights/{0}" -f $entry.bookFile) | Out-Null
        $captured = Read-JsonFile $target
        $capturedCount = if ($null -eq $captured.updated) { 0 } else { @($captured.updated).Count }
        $log.ok += [ordered]@{ index = $entry.index; bookFile = $entry.bookFile; highlights = $capturedCount }
        Write-Output ("ok  #{0:d3} highlights={1} file={2}" -f $entry.index, $capturedCount, $entry.bookFile)
    } catch {
        $log.failed += [ordered]@{ index = $entry.index; bookFile = $entry.bookFile; reason = [string]$_.Exception.Message }
        Write-Output ("FAIL #{0:d3} file={1} reason={2}" -f $entry.index, $entry.bookFile, $_.Exception.Message)
    }
    Start-Sleep -Milliseconds $DelayMs
}
$log.finishedAt = (Get-Date).ToString('s')
[System.IO.File]::WriteAllText($logPath, ($log | ConvertTo-Json -Depth 6), (New-Object System.Text.UTF8Encoding($false)))
Write-Output ("captured ok: {0}; failed: {1}; already present: {2}; requested this run: {3}" -f $log.ok.Count, $log.failed.Count, $log.skippedExisting, $log.requested)
