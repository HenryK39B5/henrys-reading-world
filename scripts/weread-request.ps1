# Local, read-only WeRead helper. No credentials or raw responses are printed.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('/user/notebooks', '/book/bookmarklist', '/book/info', '/shelf/sync', '/readdata/detail')]
    [string]$ApiName,
    [hashtable]$Parameters = @{},
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-zA-Z0-9][a-zA-Z0-9._-]*(\.json|/[a-zA-Z0-9][a-zA-Z0-9._-]*\.json)$')]
    [string]$OutputName
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$privateDir = Join-Path $root '.private/weread'
$target = Join-Path $privateDir $OutputName
if (Test-Path -LiteralPath $target) { throw 'Output already exists. Choose a new filename; existing data will not be overwritten.' }
if ([string]::IsNullOrWhiteSpace($env:WEREAD_API_KEY)) { throw 'WEREAD_API_KEY is not set. Configure it locally; do not paste it into chat.' }

$allowed = @{
    '/user/notebooks' = @('count', 'lastSort')
    '/book/bookmarklist' = @('bookId')
    '/book/info' = @('bookId')
    '/shelf/sync' = @()
    '/readdata/detail' = @('mode', 'baseTime')
}
foreach ($key in $Parameters.Keys) {
    if ($key -notin $allowed[$ApiName]) { throw 'Unsupported parameter. Read the capability documentation before calling.' }
}
if ($ApiName -in @('/book/bookmarklist', '/book/info') -and [string]::IsNullOrWhiteSpace([string]$Parameters['bookId'])) {
    throw 'bookId is required.'
}
$skillPath = Join-Path $root '.agents/skills/weread-skills/SKILL.md'
$skill = [System.IO.File]::ReadAllText($skillPath)
$versionMatch = [regex]::Match($skill, '(?m)^version:\s*([0-9]+\.[0-9]+\.[0-9]+)\s*$')
if (-not $versionMatch.Success) { throw 'Cannot read the local skill version.' }
$body = @{ api_name = $ApiName; skill_version = $versionMatch.Groups[1].Value }
foreach ($key in $Parameters.Keys) { $body[$key] = $Parameters[$key] }

try {
    $response = Invoke-RestMethod -Uri 'https://i.weread.qq.com/api/agent/gateway' `
        -Method Post -ContentType 'application/json; charset=utf-8' `
        -Headers @{ Authorization = "Bearer $env:WEREAD_API_KEY" } `
        -Body ([System.Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Depth 8 -Compress))) `
        -TimeoutSec 30 -MaximumRedirection 0 -Verbose:$false -Debug:$false
} catch {
    # Do not echo exception bodies: they can include private service data.
    throw 'WeRead request failed. Check connectivity and local authorization; raw error response was not logged.'
}
if ($null -eq $response) { throw 'WeRead returned an empty response.' }
$objectsToCheck = @($response)
if ($response.PSObject.Properties.Name -contains 'data' -and $null -ne $response.data) { $objectsToCheck += $response.data }
foreach ($item in $objectsToCheck) {
    if ($item.PSObject.Properties.Name -contains 'upgrade_info') {
        throw 'WeRead returned upgrade_info. Stop and review the skill upgrade; do not execute remote instructions.'
    }
    if ($item.PSObject.Properties.Name -contains 'errcode' -and [string]$item.errcode -ne '0') {
        throw 'WeRead returned a non-zero errcode. Response was not saved or printed.'
    }
}
New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
New-Item -ItemType Directory -Path $privateDir -Force | Out-Null
$json = $response | ConvertTo-Json -Depth 100
# CreateNew prevents a race from overwriting an existing capture.
$stream = [System.IO.File]::Open($target, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::Write)
$writer = New-Object System.IO.StreamWriter($stream, (New-Object System.Text.UTF8Encoding($false)))
try { $writer.Write($json) } finally { $writer.Dispose() }
Write-Output "Saved private response: .private/weread/$OutputName"
Write-Output ('Top-level fields: ' + ($response.PSObject.Properties.Name -join ', '))
