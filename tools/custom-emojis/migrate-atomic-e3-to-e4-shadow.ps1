param(
	[string]$GlyphE3Path = "c:\Users\anthe\Desktop\Desarrollo\RP\font\glyph_E3.png",
	[string]$GlyphE4Path = "c:\Users\anthe\Desktop\Desarrollo\RP\font\glyph_E4.png",
	[string]$MappingE3Path = "c:\Users\anthe\Desktop\Desarrollo\RP\font\mapping.atomic-essential.json",
	[string]$MappingE4Path = "c:\Users\anthe\Desktop\Desarrollo\RP\font\mapping.atomic-e4.json",
	[int[]]$ShadowRgb = @(127,127,127),
	[switch]$Apply,
	[switch]$MoveBackupsOutOfRP
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

function Assert-File([string]$p, [string]$label) {
	if (!(Test-Path -LiteralPath $p)) { throw "$label not found: $p" }
}

Assert-File $GlyphE3Path "GlyphE3"
Assert-File $GlyphE4Path "GlyphE4"
Assert-File $MappingE3Path "MappingE3"
Assert-File $MappingE4Path "MappingE4"

if (@($ShadowRgb).Count -ne 3) { throw "ShadowRgb must be 3 ints (R,G,B)." }
$shadowR = [int]$ShadowRgb[0]
$shadowG = [int]$ShadowRgb[1]
$shadowB = [int]$ShadowRgb[2]

function LoadBmp([string]$path) {
	$bytes = [IO.File]::ReadAllBytes($path)
	$ms = New-Object IO.MemoryStream(,$bytes)
	$locked = [System.Drawing.Bitmap]::FromStream($ms)
	$bmp = New-Object System.Drawing.Bitmap($locked)
	$locked.Dispose(); $ms.Dispose()
	return $bmp
}

function SaveBmp([System.Drawing.Bitmap]$bmp, [string]$path) {
	$tmp = "$path.tmp.png"
	$bmp.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png)
	Move-Item -LiteralPath $tmp -Destination $path -Force
}

function CellRect16([string]$hexE3orE4) {
	$lo = [Convert]::ToInt32($hexE3orE4.Substring(2), 16)
	$x = ($lo -band 0x0F) * 16
	$y = (($lo -shr 4) -band 0x0F) * 16
	return New-Object System.Drawing.Rectangle($x,$y,16,16)
}

function CellRect32([string]$hexE4) {
	$lo = [Convert]::ToInt32($hexE4.Substring(2), 16)
	$x = ($lo -band 0x0F) * 32
	$y = (($lo -shr 4) -band 0x0F) * 32
	return New-Object System.Drawing.Rectangle($x,$y,32,32)
}

function GetCellStats16([System.Drawing.Bitmap]$bmp, [System.Drawing.Rectangle]$r) {
	$hasAny = $false
	$hasShadow = $false
	for ($yy=0; $yy -lt 16; $yy++) {
		for ($xx=0; $xx -lt 16; $xx++) {
			$c = $bmp.GetPixel($r.X+$xx, $r.Y+$yy)
			if ($c.A -eq 0) { continue }
			$hasAny = $true
			if (-not $hasShadow -and $c.R -eq $shadowR -and $c.G -eq $shadowG -and $c.B -eq $shadowB) { $hasShadow = $true }
		}
	}
	return [PSCustomObject]@{ hasAny=$hasAny; hasShadow=$hasShadow }
}

function CropToAlphaBounds([System.Drawing.Bitmap]$src16) {
	$minX=16; $minY=16; $maxX=-1; $maxY=-1
	for ($y=0; $y -lt 16; $y++) {
		for ($x=0; $x -lt 16; $x++) {
			$c=$src16.GetPixel($x,$y)
			if ($c.A -eq 0) { continue }
			if ($x -lt $minX) { $minX=$x }
			if ($y -lt $minY) { $minY=$y }
			if ($x -gt $maxX) { $maxX=$x }
			if ($y -gt $maxY) { $maxY=$y }
		}
	}
	if ($maxX -lt 0) {
		return New-Object System.Drawing.Rectangle(0,0,16,16)
	}
	return New-Object System.Drawing.Rectangle($minX,$minY,($maxX-$minX+1),($maxY-$minY+1))
}

function ExtractCell16([System.Drawing.Bitmap]$src, [System.Drawing.Rectangle]$r) {
	$cell = New-Object System.Drawing.Bitmap(16,16,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
	$g=[System.Drawing.Graphics]::FromImage($cell)
	$g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
	$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
	$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
	$g.DrawImage($src, (New-Object System.Drawing.Rectangle(0,0,16,16)), $r, [System.Drawing.GraphicsUnit]::Pixel)
	$g.Dispose()
	return $cell
}

function DrawCell16To16([System.Drawing.Bitmap]$dst, [System.Drawing.Rectangle]$dstRect, [System.Drawing.Bitmap]$cell16) {
	$g=[System.Drawing.Graphics]::FromImage($dst)
	$g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
	$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
	$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
	$g.DrawImage($cell16, $dstRect)
	$g.Dispose()
}

function DrawCell16ToE4([System.Drawing.Bitmap]$dstE4, [System.Drawing.Rectangle]$dstCell32, [System.Drawing.Bitmap]$srcCell16) {
	# Crop to alpha bounds, scale to 16x16, center in 32x32 with Y=-1 (same feel).
	$cropRect = CropToAlphaBounds $srcCell16
	$cropped = New-Object System.Drawing.Bitmap($cropRect.Width, $cropRect.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
	$g1=[System.Drawing.Graphics]::FromImage($cropped)
	$g1.CompositingMode=[System.Drawing.Drawing2D.CompositingMode]::SourceCopy
	$g1.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
	$g1.DrawImage($srcCell16, (New-Object System.Drawing.Rectangle(0,0,$cropRect.Width,$cropRect.Height)), $cropRect, [System.Drawing.GraphicsUnit]::Pixel)
	$g1.Dispose()

	$scaled = New-Object System.Drawing.Bitmap(16,16,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
	$g2=[System.Drawing.Graphics]::FromImage($scaled)
	$g2.CompositingMode=[System.Drawing.Drawing2D.CompositingMode]::SourceCopy
	$g2.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
	$g2.PixelOffsetMode=[System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
	$g2.DrawImage($cropped, (New-Object System.Drawing.Rectangle(0,0,16,16)))
	$g2.Dispose()
	$cropped.Dispose()

	$offX = $dstCell32.X + [int][Math]::Floor((32-16)/2)
	$offY = $dstCell32.Y + [int][Math]::Floor((32-16)/2) - 1
	if ($offY -lt $dstCell32.Y) { $offY = $dstCell32.Y }
	$dstRect = New-Object System.Drawing.Rectangle($offX,$offY,16,16)

	$g3=[System.Drawing.Graphics]::FromImage($dstE4)
	$g3.CompositingMode=[System.Drawing.Drawing2D.CompositingMode]::SourceCopy
	$g3.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
	$g3.PixelOffsetMode=[System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
	$g3.DrawImage($scaled, $dstRect)
	$g3.Dispose()
	$scaled.Dispose()
}

function HexFromPrefixAndLo([string]$prefix, [int]$lo) {
	return ($prefix + ("{0:X2}" -f $lo))
}

# Load mappings
$mapE3Obj = Get-Content -LiteralPath $MappingE3Path -Raw -Encoding UTF8 | ConvertFrom-Json
$mapE4Obj = Get-Content -LiteralPath $MappingE4Path -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $mapE3Obj.customMap) { throw "E3 mapping missing customMap" }
if (-not $mapE4Obj.customMap) { throw "E4 mapping missing customMap" }

$entries = @()
foreach ($p in $mapE3Obj.customMap.PSObject.Properties) {
	$token = [string]$p.Name
	$hex = ([string]$p.Value).ToUpper()
	if ($hex -notmatch '^E3[0-9A-F]{2}$') { continue }
	$entries += [PSCustomObject]@{ token=$token; hex=$hex; lo=[Convert]::ToInt32($hex.Substring(2),16) }
}
$entries = $entries | Sort-Object lo

# Load source E3 sheet
$srcE3 = LoadBmp $GlyphE3Path
try {
	if ($srcE3.Width -ne 256 -or $srcE3.Height -ne 256) { throw "glyph_E3.png must be 256x256" }

	$removed = @()
	$keepE3 = @()
	$moveE4 = @()
	$usedLos = New-Object System.Collections.Generic.HashSet[int]

	foreach ($e in $entries) {
		$rect = CellRect16 $e.hex
		$stats = GetCellStats16 $srcE3 $rect
		[void]$usedLos.Add($e.lo)
		if (-not $stats.hasAny) {
			$removed += $e
		} elseif ($stats.hasShadow) {
			$keepE3 += $e
		} else {
			$moveE4 += $e
		}
	}

	# Also detect any non-blank cells not referenced by mapping (for cleanup)
	$extraNonMapped = @()
	for ($lo = 0; $lo -lt 256; $lo++) {
		$hex = HexFromPrefixAndLo 'E3' $lo
		$rect = CellRect16 $hex
		$st = GetCellStats16 $srcE3 $rect
		if (-not $st.hasAny) { continue }
		if (-not $usedLos.Contains($lo)) {
			$extraNonMapped += $lo
		}
	}

	Write-Host ("Mapped tokens: {0}" -f @($entries).Count)
	Write-Host ("Keep in E3 (has shadow): {0}" -f @($keepE3).Count)
	Write-Host ("Move to E4 (no shadow): {0}" -f @($moveE4).Count)
	Write-Host ("Remove (blank mapped cell): {0}" -f @($removed).Count)
	Write-Host ("Extra non-mapped non-blank cells to clear in E3: {0}" -f @($extraNonMapped).Count)

	if (-not $Apply) {
		Write-Host "(dry-run) No files written. Use -Apply to write glyphs+mappings."
		return
	}

	# Backup existing assets
	$stamp = (Get-Date).ToString('yyyyMMdd-HHmmss')
	$backupDir = "c:\Users\anthe\Desktop\Desarrollo\tools\custom-emojis\backups\$stamp"
	New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
	Copy-Item -LiteralPath $GlyphE3Path -Destination (Join-Path $backupDir 'glyph_E3.png') -Force
	Copy-Item -LiteralPath $GlyphE4Path -Destination (Join-Path $backupDir 'glyph_E4.png') -Force
	Copy-Item -LiteralPath $MappingE3Path -Destination (Join-Path $backupDir 'mapping.atomic-essential.json') -Force
	Copy-Item -LiteralPath $MappingE4Path -Destination (Join-Path $backupDir 'mapping.atomic-e4.json') -Force

	# Build new packed sheets
	$newE3 = New-Object System.Drawing.Bitmap(256,256,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
	$gE3=[System.Drawing.Graphics]::FromImage($newE3)
	$gE3.Clear([System.Drawing.Color]::FromArgb(0,0,0,0))
	$gE3.Dispose()

	$newE4 = New-Object System.Drawing.Bitmap(512,512,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
	$gE4=[System.Drawing.Graphics]::FromImage($newE4)
	$gE4.Clear([System.Drawing.Color]::FromArgb(0,0,0,0))
	$gE4.Dispose()

	$newMapE3 = [ordered]@{}
	$newMapE4 = [ordered]@{}

	# Assign sequential lo for E3 kept
	$loE3 = 0
	foreach ($e in ($keepE3 | Sort-Object lo)) {
		$dstHex = HexFromPrefixAndLo 'E3' $loE3
		$srcRect = CellRect16 $e.hex
		$cell16 = ExtractCell16 $srcE3 $srcRect
		try {
			$dstRect = CellRect16 $dstHex
			DrawCell16To16 $newE3 $dstRect $cell16
		} finally {
			$cell16.Dispose()
		}
		$newMapE3[$e.token] = $dstHex
		$loE3++
	}

	# Assign sequential lo for E4 moved
	$loE4 = 0
	foreach ($e in ($moveE4 | Sort-Object lo)) {
		$dstHex = HexFromPrefixAndLo 'E4' $loE4
		$srcRect = CellRect16 $e.hex
		$cell16 = ExtractCell16 $srcE3 $srcRect
		try {
			$dstCell32 = CellRect32 $dstHex
			DrawCell16ToE4 $newE4 $dstCell32 $cell16
		} finally {
			$cell16.Dispose()
		}
		$newMapE4[$e.token] = $dstHex
		$loE4++
	}

	# Write sheets
	SaveBmp $newE3 $GlyphE3Path
	SaveBmp $newE4 $GlyphE4Path
	$newE3.Dispose(); $newE4.Dispose()

	# Update mapping JSON
	$mapE3Obj.customMap = $newMapE3
	$mapE4Obj.customMap = $newMapE4
	$mapE3Obj.notes.custom = "(actualizado) E3 contiene iconos con sombra #7F7F7F (shadow)."
	$mapE4Obj.notes.custom = "(actualizado) E4 contiene iconos SIN sombra #7F7F7F, escalados a 16x16 y centrados (Y=-1)."

	$mapE3Obj | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $MappingE3Path -Encoding UTF8
	$mapE4Obj | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $MappingE4Path -Encoding UTF8

	Write-Host "WROTE: $GlyphE3Path"
	Write-Host "WROTE: $GlyphE4Path"
	Write-Host "WROTE: $MappingE3Path"
	Write-Host "WROTE: $MappingE4Path"
	Write-Host "BACKUP: $backupDir"

	if ($MoveBackupsOutOfRP) {
		$rpFont = Split-Path -Parent $GlyphE3Path
		Get-ChildItem -LiteralPath $rpFont -Filter '*.pre-migration.*.png' -ErrorAction SilentlyContinue | ForEach-Object {
			Move-Item -LiteralPath $_.FullName -Destination $backupDir -Force
		}
	}

} finally {
	$srcE3.Dispose()
}
