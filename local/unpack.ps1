param([Parameter(Mandatory=$true)][string]$ZipPath, [Parameter(Mandatory=$true)][string]$Destination)
$ErrorActionPreference = 'Stop'
Expand-Archive -LiteralPath $ZipPath -DestinationPath $Destination -Force
