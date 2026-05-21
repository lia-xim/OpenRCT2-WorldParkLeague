$repoRoot = Split-Path -Parent $PSScriptRoot
$source = Join-Path $repoRoot "dist\\WorldParkLeague.js"
$target = "C:\\Users\\matth\\Documents\\OpenRCT2\\plugin\\WorldParkLeague.js"
$tempTarget = "$target.tmp"
$backupTarget = "$target.bak"

if (-not (Test-Path $source)) {
    Write-Error "Built plugin file not found: $source"
    exit 1
}

[System.IO.File]::Copy($source, $tempTarget, $true)

if (Test-Path $target) {
    [System.IO.File]::Replace($tempTarget, $target, $backupTarget, $true)
    if (Test-Path $backupTarget) {
        Remove-Item -LiteralPath $backupTarget -Force
    }
}
else {
    Move-Item -LiteralPath $tempTarget -Destination $target -Force
}

Write-Host "Installed World Park League plugin to $target"
