. (Join-Path $PSScriptRoot 'windows-common.ps1')
$node = Find-HidariNode
if (-not $node) { throw 'Run setup.cmd first.' }
Set-Location -LiteralPath $ProjectRoot
& $node (Join-Path $PSScriptRoot 'update.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Update failed; existing configuration was preserved.' }
Write-Host 'Restart start.cmd. Reload HidariPunch in chrome://extensions, then refresh YouTube.'
