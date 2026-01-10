param(
	[string]$AnalyzeReportPath,
	[string]$GlyphE3Path = "c:\Users\anthe\Desktop\Desarrollo\RP\font\glyph_E3.png",
	[string]$GlyphE4Path = "c:\Users\anthe\Desktop\Desarrollo\RP\font\glyph_E4.png",
	[string]$AtomicE3MappingPath = "c:\Users\anthe\Desktop\Desarrollo\RP\font\mapping.atomic-essential.json",
	[string]$AtomicE4MappingPath = "c:\Users\anthe\Desktop\Desarrollo\RP\font\mapping.atomic-e4.json",
	[string]$AtomicEssentialJsPath = "c:\Users\anthe\Desktop\Desarrollo\Atomic BP\scripts\features\custom-emojis\packs\atomicEssential.js",
	[int]$ShadowR = 127,
	[int]$ShadowG = 127,
	[int]$ShadowB = 127,
	[switch]$Apply
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

function ToSet($arr) {
	$s = New-Object System.Collections.Generic.HashSet[string]
	foreach ($x in @($arr)) {
		if ($null -eq $x) { continue }
		[void]$s.Add(([string]$x).ToUpper())
	}
	return $s
}

function HexToInt([string]$hex) { [Convert]::ToInt32($hex, 16) }

function SortPairsByPua($pairs) {
	$pairs | Sort-Object -Property @{Expression = { HexToInt ([string]$_.pua) } }, @{Expression = { [string]$_.token } }
}

function NewBlankBitmap([int]$w, [int]$h) {
	$bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
	$g = [System.Drawing.Graphics]::FromImage($bmp)
	$g.Clear([System.Drawing.Color]::FromArgb(0,0,0,0))
	$g.Dispose()
	return $bmp
}

function LoadBitmapNoLock([string]$path) {
	$bytes = [IO.File]::ReadAllBytes($path)
	$ms = New-Object IO.MemoryStream(,$bytes)
	$locked = [System.Drawing.Bitmap]::FromStream($ms)
	$bmp = New-Object System.Drawing.Bitmap($locked)
	$locked.Dispose()
	$ms.Dispose()
	return $bmp
}

function SaveBitmapAtomic([System.Drawing.Bitmap]$bmp, [string]$path) {
	$tmp = "$path.tmp.png"
	$bmp.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png)
	Move-Item -LiteralPath $tmp -Destination $path -Force
}

function CellRect16([string]$hexE3OrE4) {
	$lo = [Convert]::ToInt32($hexE3OrE4.Substring(2), 16)
	$x = ($lo -band 0x0F) * 16
	$y = (($lo -shr 4) -band 0x0F) * 16
	return New-Object System.Drawing.Rectangle($x, $y, 16, 16)
}

function CellRect32([string]$hexE4) {
	$lo = [Convert]::ToInt32($hexE4.Substring(2), 16)
	$x = ($lo -band 0x0F) * 32
	$y = (($lo -shr 4) -band 0x0F) * 32
	return New-Object System.Drawing.Rectangle($x, $y, 32, 32)
}

function FindBoundingBox16([System.Drawing.Bitmap]$bmp, [System.Drawing.Rectangle]$r) {
	$minX = 999
	$minY = 999
	$maxX = -1
	$maxY = -1
	for ($yy = 0; $yy -lt $r.Height; $yy++) {
		for ($xx = 0; $xx -lt $r.Width; $xx++) {
			$c = $bmp.GetPixel($r.X + $xx, $r.Y + $yy)
			if ($c.A -eq 0) { continue }
			if ($xx -lt $minX) { $minX = $xx }
			if ($yy -lt $minY) { $minY = $yy }
			if ($xx -gt $maxX) { $maxX = $xx }
			if ($yy -gt $maxY) { $maxY = $yy }
		}
	}
	if ($maxX -lt 0) { return $null }
	return New-Object System.Drawing.Rectangle($r.X + $minX, $r.Y + $minY, ($maxX - $minX + 1), ($maxY - $minY + 1))
}

if ([string]::IsNullOrWhiteSpace($AnalyzeReportPath) -or !(Test-Path -LiteralPath $AnalyzeReportPath)) {
	throw "AnalyzeReportPath not found: $AnalyzeReportPath"
}
if (!(Test-Path -LiteralPath $GlyphE3Path)) { throw "glyph_E3 not found: $GlyphE3Path" }
if (!(Test-Path -LiteralPath $GlyphE4Path)) { throw "glyph_E4 not found: $GlyphE4Path" }
if (!(Test-Path -LiteralPath $AtomicE3MappingPath)) { throw "E3 mapping not found: $AtomicE3MappingPath" }
if (!(Test-Path -LiteralPath $AtomicE4MappingPath)) { throw "E4 mapping not found: $AtomicE4MappingPath" }
if (!(Test-Path -LiteralPath $AtomicEssentialJsPath)) { throw "atomicEssential.js not found: $AtomicEssentialJsPath" }

$report = Get-Content -LiteralPath $AnalyzeReportPath -Raw -Encoding UTF8 | ConvertFrom-Json
$blank = ToSet $report.blankCells
$unshaded = ToSet $report.unshadedCells

$e3 = Get-Content -LiteralPath $AtomicE3MappingPath -Raw -Encoding UTF8 | ConvertFrom-Json
$e4 = Get-Content -LiteralPath $AtomicE4MappingPath -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $e3.customMap) { throw "E3 mapping missing customMap: $AtomicE3MappingPath" }
if (-not $e4.customMap) { throw "E4 mapping missing customMap: $AtomicE4MappingPath" }

$removed = @()
$moved = @()
$kept = @()
$passthrough = @()

foreach ($p in $e3.customMap.PSObject.Properties) {
	$token = [string]$p.Name
	$hex = ([string]$p.Value).ToUpper()
	if ($hex -notmatch '^E3[0-9A-F]{2}$') {
		$passthrough += [PSCustomObject]@{ token = $token; pua = $hex }
		continue
	}
	$lo = $hex.Substring(2, 2)
	if ($blank.Contains($lo)) {
		$removed += [PSCustomObject]@{ token = $token; oldPua = $hex; lo = $lo }
		continue
	}
	if ($unshaded.Contains($lo)) {
		$moved += [PSCustomObject]@{ token = $token; oldPua = $hex; lo = $lo }
		continue
	}
	$kept += [PSCustomObject]@{ token = $token; oldPua = $hex; lo = $lo }
}

$keptSorted = $kept | Sort-Object -Property @{Expression = { HexToInt $_.oldPua } }, @{Expression = { $_.token } }
$movedSorted = $moved | Sort-Object -Property @{Expression = { HexToInt $_.oldPua } }, @{Expression = { $_.token } }

# Assign new sequential PUAs
$newE3Pairs = @()
for ($i = 0; $i -lt @($keptSorted).Count; $i++) {
	$lo = "{0:X2}" -f $i
	$newE3Pairs += [PSCustomObject]@{ token = $keptSorted[$i].token; oldPua = $keptSorted[$i].oldPua; pua = ("E3" + $lo) }
}
foreach ($pt in $passthrough) {
	$newE3Pairs += [PSCustomObject]@{ token = $pt.token; oldPua = $pt.pua; pua = $pt.pua }
}

$newE4Pairs = @()
for ($i = 0; $i -lt @($movedSorted).Count; $i++) {
	$lo = "{0:X2}" -f $i
	$newE4Pairs += [PSCustomObject]@{ token = $movedSorted[$i].token; oldPua = $movedSorted[$i].oldPua; pua = ("E4" + $lo) }
}

$newE3PairsSorted = SortPairsByPua $newE3Pairs
$newE4PairsSorted = SortPairsByPua $newE4Pairs

Write-Host ("kept(E3 shadowed)={0} moved(to E4)={1} removed(blank)={2}" -f @($kept).Count, @($moved).Count, @($removed).Count)
Write-Host ("new E3 range: {0}..{1}" -f ($newE3PairsSorted | Select-Object -First 1 | ForEach-Object { $_.pua }), ($newE3PairsSorted | Select-Object -Last 1 | ForEach-Object { $_.pua }))
if (@($newE4PairsSorted).Count -gt 0) {
	Write-Host ("new E4 range: {0}..{1}" -f ($newE4PairsSorted | Select-Object -First 1 | ForEach-Object { $_.pua }), ($newE4PairsSorted | Select-Object -Last 1 | ForEach-Object { $_.pua }))
}

if (-not $Apply) {
	Write-Host "(dry-run) No files written. Use -Apply to write images + mappings + JS."
	return
}

# Rebuild glyph_E3.png packed
$oldE3 = LoadBitmapNoLock $GlyphE3Path
try {
	$newE3 = NewBlankBitmap 256 256
	$g3 = [System.Drawing.Graphics]::FromImage($newE3)
	$g3.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
	$g3.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
	$g3.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
	try {
		foreach ($pair in $newE3Pairs | Where-Object { $_.pua -match '^E3[0-9A-F]{2}$' }) {
			$src = CellRect16 $pair.oldPua
			$dst = CellRect16 $pair.pua
			$g3.DrawImage($oldE3, $dst, $src, [System.Drawing.GraphicsUnit]::Pixel)
		}
	} finally {
		$g3.Dispose()
	}
	SaveBitmapAtomic $newE3 $GlyphE3Path
	$newE3.Dispose()
} finally {
	$oldE3.Dispose()
}

# Build glyph_E4.png from moved icons (scaled)
$srcE3 = LoadBitmapNoLock $GlyphE3Path
try {
	$newE4 = NewBlankBitmap 512 512
	$g4 = [System.Drawing.Graphics]::FromImage($newE4)
	$g4.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
	$g4.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
	$g4.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

	try {
		foreach ($pair in $newE4Pairs) {
			$srcCell = CellRect16 $pair.oldPua
			$bbox = FindBoundingBox16 $srcE3 $srcCell
			if ($null -eq $bbox) { continue }

			$maxDim = [Math]::Max($bbox.Width, $bbox.Height)
			$scale = 1
			if ($maxDim -le 8) { $scale = 2 }
			$dstW = [Math]::Min(16, $bbox.Width * $scale)
			$dstH = [Math]::Min(16, $bbox.Height * $scale)

			$cell = CellRect32 $pair.pua
			$offX = [int][Math]::Floor((32 - $dstW) / 2)
			$offY = [int][Math]::Max(0, [Math]::Floor((32 - $dstH) / 2) - 1)
			$dstRect = New-Object System.Drawing.Rectangle($cell.X + $offX, $cell.Y + $offY, $dstW, $dstH)

			$g4.DrawImage($srcE3, $dstRect, $bbox, [System.Drawing.GraphicsUnit]::Pixel)
		}
	} finally {
		$g4.Dispose()
	}

	SaveBitmapAtomic $newE4 $GlyphE4Path
	$newE4.Dispose()
} finally {
	$srcE3.Dispose()
}

# Write mappings
$newE3Map = [ordered]@{}
foreach ($it in $newE3PairsSorted) { $newE3Map[$it.token] = $it.pua }
$newE4Map = [ordered]@{}
foreach ($it in $newE4PairsSorted) { $newE4Map[$it.token] = $it.pua }

$e3.customMap = $newE3Map
$e4.customMap = $newE4Map

$e3 | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $AtomicE3MappingPath -Encoding UTF8
$e4 | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $AtomicE4MappingPath -Encoding UTF8

# Regenerate atomicEssential.js from the new combined maps (+ aliases)
$lines = @()
$lines += "// Auto-generated from RP/font/mapping.atomic-essential.json + mapping.atomic-e4.json"
$lines += "// Tokens map to Private Use Area codepoints to render via RP/font/glyph_Ex.png sheets."
$lines += ""
$lines += "function cp(hex) {"
$lines += "\treturn String.fromCodePoint(parseInt(hex, 16));"
$lines += "}"
$lines += ""
$lines += "export const atomicEssentialMap = new Map(["

# Create combined list
$combined = @()
foreach ($it in $newE3PairsSorted) { $combined += [PSCustomObject]@{ token = $it.token; pua = $it.pua } }
foreach ($it in $newE4PairsSorted) { $combined += [PSCustomObject]@{ token = $it.token; pua = $it.pua } }
$combinedSorted = SortPairsByPua $combined

# Add aliases (example requested)
$skull = $combinedSorted | Where-Object { $_.token -eq '☠' } | Select-Object -First 1
if ($skull) {
	$combinedSorted = @([PSCustomObject]@{ token = ':skull:'; pua = $skull.pua }) + $combinedSorted
}

foreach ($it in $combinedSorted) {
	$tok = $it.token.Replace("\\", "\\\\").Replace('"', '\\"')
	$lines += ("`t[`"{0}`", cp(`"{1}`")]," -f $tok, $it.pua)
}

$lines += "]);"
$lines += ""

Set-Content -LiteralPath $AtomicEssentialJsPath -Value ($lines -join "`r`n") -Encoding UTF8

Write-Host "WROTE: $GlyphE3Path"
Write-Host "WROTE: $GlyphE4Path"
Write-Host "WROTE: $AtomicE3MappingPath"
Write-Host "WROTE: $AtomicE4MappingPath"
Write-Host "WROTE: $AtomicEssentialJsPath"

# Report removed tokens (optional quick list)
Write-Host ("REMOVED_TOKENS: {0}" -f @($removed).Count)
