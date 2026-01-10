param(
	[string]$OutPath,
	[int]$CellSizePx = 32,
	[int]$Grid = 16
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($OutPath)) { throw "OutPath is required" }

Add-Type -AssemblyName System.Drawing

$size = $CellSizePx * $Grid
$bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
try {
	# Transparent by default; ensure full clear.
	$g = [System.Drawing.Graphics]::FromImage($bmp)
	$g.Clear([System.Drawing.Color]::FromArgb(0,0,0,0))
	$g.Dispose()

	$dir = Split-Path -Parent $OutPath
	if (!(Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }

	$tmp = "$OutPath.tmp.png"
	$bmp.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png)
	Move-Item -LiteralPath $tmp -Destination $OutPath -Force
	Write-Host "WROTE: $OutPath (${size}x${size})"
} finally {
	$bmp.Dispose()
}
