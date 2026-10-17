. (Join-Path $PSScriptRoot 'windows-common.ps1')
$node = Find-HidariNode
if (-not $node) { throw 'Run setup.cmd first.' }
Set-Location -LiteralPath $ProjectRoot
Write-Host 'Keep this window open while watching YouTube. Press Ctrl+C to stop the service.'
& $node (Join-Path $PSScriptRoot 'server.cjs')
exit $LASTEXITCODE
