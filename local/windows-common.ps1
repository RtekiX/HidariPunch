$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$LocalRoot = Join-Path $ProjectRoot '.local'
function Find-HidariNode {
    $systemNode = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($systemNode) {
        $version = & $systemNode.Source --version
        if ($LASTEXITCODE -eq 0 -and $version -match '^v(\d+)\.' -and [int]$Matches[1] -ge 22) { return $systemNode.Source }
    }
    $portableRoot = Join-Path $LocalRoot 'node'
    if (Test-Path -LiteralPath $portableRoot) {
        $portableNode = Get-ChildItem -LiteralPath $portableRoot -Filter node.exe -Recurse -File | Select-Object -First 1
        if ($portableNode) { return $portableNode.FullName }
    }
    return $null
}
function Get-HidariDownload([string]$Url, [string]$Destination) {
    $options = @{Uri=$Url; OutFile=$Destination; UseBasicParsing=$true}
    if ($env:HIDARI_DOWNLOAD_PROXY) { $options.Proxy = $env:HIDARI_DOWNLOAD_PROXY }
    Invoke-WebRequest @options
}
function Install-HidariNode {
    $node = Find-HidariNode
    if ($node) { return $node }
    Write-Host 'Downloading portable Node.js 22 LTS from nodejs.org...'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $null = New-Item -ItemType Directory -Force -Path $LocalRoot
    $sumsPath = Join-Path $LocalRoot 'node-SHASUMS256.txt'
    Get-HidariDownload 'https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt' $sumsPath
    $line = Get-Content -LiteralPath $sumsPath | Where-Object { $_ -match '^([a-f0-9]{64})\s+(node-v22\.[0-9.]+-win-x64\.zip)$' } | Select-Object -First 1
    if (-not $line -or $line -notmatch '^([a-f0-9]{64})\s+(node-v22\.[0-9.]+-win-x64\.zip)$') { throw 'Cannot find the official Windows x64 Node.js archive.' }
    $expectedHash = $Matches[1]
    $filename = $Matches[2]
    $archive = Join-Path $LocalRoot $filename
    Get-HidariDownload ('https://nodejs.org/dist/latest-v22.x/' + $filename) $archive
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedHash) { throw 'Node.js archive checksum mismatch.' }
    Expand-Archive -LiteralPath $archive -DestinationPath (Join-Path $LocalRoot 'node') -Force
    $node = Find-HidariNode
    if (-not $node) { throw 'Portable Node.js was not found after extraction.' }
    return $node
}
