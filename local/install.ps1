param(
    [ValidateSet('auto','cpu','vulkan')][string]$Backend='auto',
    [ValidateSet('auto','base','kotoba-v2')][string]$Model='auto',
    [switch]$CheckOnly,
    [switch]$NoStart
)
. (Join-Path $PSScriptRoot 'windows-common.ps1')
if ($env:PROCESSOR_ARCHITECTURE -ne 'AMD64') { throw 'The one-click setup supports Windows x64 only.' }
if ($Backend -eq 'auto') {
    if (Test-Path -LiteralPath (Join-Path $env:WINDIR 'System32/vulkan-1.dll')) { $Backend='vulkan' } else { $Backend='cpu' }
}
$automaticModel = $Model -eq 'auto'
if ($automaticModel) { if ($Backend -eq 'vulkan') { $Model='kotoba-v2' } else { $Model='base' } }
if ($CheckOnly) { @{backend=$Backend; model=$Model; nodeAvailable=[bool](Find-HidariNode); localData='.local'; requiresApiKey=$false} | ConvertTo-Json; exit 0 }
Set-Location -LiteralPath $ProjectRoot
$node = Install-HidariNode
$env:PATH = (Split-Path -Parent $node) + ';' + $env:PATH
Write-Host "Preparing model=$Model backend=$Backend. Downloads are stored in .local only."
& $node (Join-Path $PSScriptRoot 'setup.cjs') $Model
if ($LASTEXITCODE -ne 0) { throw 'Model setup failed. Check the network or HIDARI_DOWNLOAD_PROXY.' }
if ($Backend -eq 'vulkan') {
    & $node (Join-Path $PSScriptRoot 'setup-vulkan.cjs')
    if ($LASTEXITCODE -eq 0) { & $node (Join-Path $PSScriptRoot 'verify-runtime.cjs') $Model 'vulkan' }
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'Vulkan verification failed. Falling back to the CPU engine.'
        $Backend='cpu'
        if ($automaticModel) {
            $Model='base'
            & $node (Join-Path $PSScriptRoot 'setup.cjs') $Model
            if ($LASTEXITCODE -ne 0) { throw 'CPU model setup failed.' }
        }
    }
}
if ($Backend -eq 'cpu') {
    & $node (Join-Path $PSScriptRoot 'verify-runtime.cjs') $Model 'cpu'
    if ($LASTEXITCODE -ne 0) { throw 'Local CPU inference verification failed. See .local/verify-runtime.log.' }
}
$config = @{backend=$Backend; vulkanCompat=$true; model=$Model}
[IO.File]::WriteAllText((Join-Path $LocalRoot 'runtime-config.json'), ($config | ConvertTo-Json), (New-Object Text.UTF8Encoding($false)))
Write-Host ''
Write-Host 'Setup complete. No API key is required for Japanese subtitles.'
Write-Host 'Chrome: chrome://extensions > Developer mode > Load unpacked > select this project folder.'
Write-Host 'Then refresh YouTube, open HidariPunch and click Start recognition.'
if (-not $NoStart) { & $node (Join-Path $PSScriptRoot 'server.cjs') $Model $Backend; exit $LASTEXITCODE }
