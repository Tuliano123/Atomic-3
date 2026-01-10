param(
	[string]$ExamplesDir = "c:\Users\anthe\Desktop\Desarrollo\RP\font\examples",
	[string]$MappingPath = "c:\Users\anthe\Desktop\Desarrollo\RP\font\mapping.java-symbols.json",
	[string]$OutGlyphPath = "c:\Users\anthe\Desktop\Desarrollo\RP\font\glyph_E3.png"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (!(Test-Path -LiteralPath $ExamplesDir)) {
	throw "ExamplesDir not found: $ExamplesDir"
}
if (!(Test-Path -LiteralPath $MappingPath)) {
	throw "Mapping not found: $MappingPath"
}
if (!(Test-Path -LiteralPath $OutGlyphPath)) {
	throw "Output glyph sheet not found: $OutGlyphPath"
}

Add-Type -AssemblyName System.Drawing

function Get-PngSize([string]$Path) {
	$b = [IO.File]::ReadAllBytes($Path)
	$w = [BitConverter]::ToUInt32([byte[]]@($b[19], $b[18], $b[17], $b[16]), 0)
	$h = [BitConverter]::ToUInt32([byte[]]@($b[23], $b[22], $b[21], $b[20]), 0)
	return @{ Width = [int]$w; Height = [int]$h }
}

$mapping = Get-Content -LiteralPath $MappingPath -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $mapping.entries) {
	throw "mapping.entries missing in JSON: $MappingPath"
}

$destSize = Get-PngSize $OutGlyphPath
if ($destSize.Width -ne 256 -or $destSize.Height -ne 256) {
	throw "Expected glyph sheet 256x256, got ${($destSize.Width)}x${($destSize.Height)}: $OutGlyphPath"
}

$destBytes = [IO.File]::ReadAllBytes($OutGlyphPath)
$destStream = New-Object System.IO.MemoryStream(,$destBytes)
$destBmpLocked = [System.Drawing.Bitmap]::FromStream($destStream)
$destBmp = New-Object System.Drawing.Bitmap($destBmpLocked)
$destBmpLocked.Dispose()
$destStream.Dispose()
$destG = [System.Drawing.Graphics]::FromImage($destBmp)
$destG.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
$destG.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$destG.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

$srcCache = @{} # pageHex -> Bitmap
$missingPages = New-Object System.Collections.Generic.HashSet[string]
$missingGlyphs = @()
$imported = 0

function Get-UnicodePagePath([string]$pageHex) {
	$candidates = @(
		("unicode_page_{0}.png" -f $pageHex.ToLower()),
		("unicode_page_{0}.png" -f $pageHex.ToUpper())
	)
	foreach ($c in $candidates) {
		$p = Join-Path $ExamplesDir $c
		if (Test-Path -LiteralPath $p) { return $p }
	}
	return $null
}

try {
	foreach ($e in $mapping.entries) {
		$hex = [string]$e.puaHex
		if ([string]::IsNullOrWhiteSpace($hex)) { continue }

		# Only our custom sheets (E3xx) live in glyph_E3.png.
		if (-not $hex.StartsWith("E3")) { continue }

		$token = [string]$e.token
		if ([string]::IsNullOrEmpty($token)) { continue }

		# Single-codepoint assumption (the generator excludes multi-codepoint tokens).
		$cp = [System.Char]::ConvertToUtf32($token, 0)
		$page = "{0:X2}" -f (($cp -shr 8) -band 0xFF)
		$lo = $cp -band 0xFF

		$pagePath = Get-UnicodePagePath $page
		if (-not $pagePath) {
			$missingPages.Add($page) | Out-Null
			$missingGlyphs += [PSCustomObject]@{ token = $token; codePoint = ("{0:X4}" -f $cp); page = $page; reason = "missing_unicode_page" }
			continue
		}

		if (-not $srcCache.ContainsKey($page)) {
			$srcSize = Get-PngSize $pagePath
			if ($srcSize.Width -ne 256 -or $srcSize.Height -ne 256) {
				throw "Expected unicode_page_${page}.png to be 256x256, got ${($srcSize.Width)}x${($srcSize.Height)}: $pagePath"
			}
			$srcBytes = [IO.File]::ReadAllBytes($pagePath)
			$srcStream = New-Object System.IO.MemoryStream(,$srcBytes)
			$srcBmpLocked = [System.Drawing.Bitmap]::FromStream($srcStream)
			$srcCache[$page] = New-Object System.Drawing.Bitmap($srcBmpLocked)
			$srcBmpLocked.Dispose()
			$srcStream.Dispose()
		}

		$srcBmp = $srcCache[$page]
		$srcX = ($lo -band 0x0F) * 16
		$srcY = (($lo -shr 4) -band 0x0F) * 16
		$srcRect = New-Object System.Drawing.Rectangle($srcX, $srcY, 16, 16)

		$dstLo = [Convert]::ToInt32($hex.Substring(2), 16)
		$dstX = ($dstLo -band 0x0F) * 16
		$dstY = (($dstLo -shr 4) -band 0x0F) * 16
		$dstRect = New-Object System.Drawing.Rectangle($dstX, $dstY, 16, 16)

		$destG.DrawImage($srcBmp, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
		$imported++
	}
} finally {
	$destG.Dispose()
	$tmpOut = "$OutGlyphPath.tmp.png"
	$destBmp.Save($tmpOut, [System.Drawing.Imaging.ImageFormat]::Png)
	$destBmp.Dispose()
	foreach ($bmp in $srcCache.Values) { $bmp.Dispose() }
	Move-Item -LiteralPath $tmpOut -Destination $OutGlyphPath -Force
}

$missingPagesSorted = @($missingPages) | Sort-Object

$report = [PSCustomObject]@{
	generatedAt = (Get-Date).ToString("o")
	examplesDir = $ExamplesDir
	outGlyph = $OutGlyphPath
	importedCount = $imported
	missingPages = $missingPagesSorted
	missingGlyphs = $missingGlyphs
}

$reportPath = "c:\Users\anthe\Desktop\Desarrollo\tools\custom-emojis\import-report.json"
$report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $reportPath -Encoding UTF8

Write-Host "Imported glyphs: $imported"
Write-Host "Missing unicode pages: $($missingPagesSorted -join ' ')"
Write-Host "Wrote report: $reportPath"
