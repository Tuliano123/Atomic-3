param(
	[string]$MappingPath = "c:\Users\anthe\Desktop\Desarrollo\RP\font\mapping.java-symbols.json",
	[string]$GlyphPath = "c:\Users\anthe\Desktop\Desarrollo\RP\font\glyph_E3.png"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Runtime.InteropServices

function ToIntHex([string]$hex) { [Convert]::ToInt32($hex, 16) }
function TokenKey([string]$t) {
	try { return [char]::ConvertToUtf32($t, 0) } catch { return [int]0 }
}

if (!(Test-Path -LiteralPath $MappingPath)) { throw "Mapping not found: $MappingPath" }
if (!(Test-Path -LiteralPath $GlyphPath)) { throw "Glyph sheet not found: $GlyphPath" }

$mapping = Get-Content -LiteralPath $MappingPath -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $mapping.entries) { throw "mapping.entries missing: $MappingPath" }

# Load glyph sheet into memory and extract raw BGRA bytes for speed.
$pngBytes = [IO.File]::ReadAllBytes($GlyphPath)
$ms = New-Object IO.MemoryStream(,$pngBytes)
$locked = [System.Drawing.Bitmap]::FromStream($ms)
$bmp = New-Object System.Drawing.Bitmap($locked.Width, $locked.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.DrawImage($locked, 0, 0, $locked.Width, $locked.Height)
$g.Dispose()
$locked.Dispose()
$ms.Dispose()

$rect = New-Object System.Drawing.Rectangle(0, 0, $bmp.Width, $bmp.Height)
$bd = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$stride = $bd.Stride
$buf = New-Object byte[] ($stride * $bmp.Height)
[System.Runtime.InteropServices.Marshal]::Copy($bd.Scan0, $buf, 0, $buf.Length)
$bmp.UnlockBits($bd)
$bmp.Dispose()

$sha = [System.Security.Cryptography.SHA256]::Create()
function GetCellHashFast(
	[byte[]]$buf,
	[int]$stride,
	[int]$cellX,
	[int]$cellY,
	[System.Security.Cryptography.HashAlgorithm]$sha
) {
	$cellBytes = New-Object byte[] (16 * 16 * 4)
	$dst = 0
	$nonBlank = $false
	for ($yy = 0; $yy -lt 16; $yy++) {
		$srcOff = ($cellY + $yy) * $stride + ($cellX * 4)
		[Array]::Copy($buf, $srcOff, $cellBytes, $dst, 16 * 4)
		for ($xx = 0; $xx -lt 16; $xx++) {
			# PixelFormat.Format32bppArgb is stored as BGRA; alpha is byte +3
			if ($cellBytes[$dst + ($xx * 4) + 3] -ne 0) { $nonBlank = $true; break }
		}
		$dst += 16 * 4
	}
	$hb = $sha.ComputeHash($cellBytes)
	$hash = [BitConverter]::ToString($hb).Replace('-', '')
	return [PSCustomObject]@{ hash = $hash; nonBlank = $nonBlank }
}

# Build list of (token, puaHex, glyphHash) for E3 only.
$rows = @()
foreach ($e in $mapping.entries) {
	$pua = ([string]$e.puaHex).ToUpper()
	if ([string]::IsNullOrWhiteSpace($pua) -or -not $pua.StartsWith("E3")) { continue }
	$lo = [Convert]::ToInt32($pua.Substring(2), 16)
	$cx = ($lo -band 0x0F) * 16
	$cy = (($lo -shr 4) -band 0x0F) * 16
	$h = GetCellHashFast $buf $stride $cx $cy $sha
	$rows += [PSCustomObject]@{
		token = [string]$e.token
		puaHex = $pua
		sheet = [string]$e.sheet
		cell = ([string]$e.cell).ToUpper()
		hash = $h.hash
		nonBlank = $h.nonBlank
	}
}
$sha.Dispose()

# Strict duplicates are pixel-equal glyphs (excluding blank cells).
$dupGlyphGroups = $rows | Where-Object { $_.nonBlank } | Group-Object hash | Where-Object { $_.Count -gt 1 }

$toRemove = New-Object System.Collections.Generic.HashSet[string]
$removedList = @()

foreach ($g in $dupGlyphGroups) {
	$items = $g.Group | Sort-Object -Property @{Expression = { ToIntHex $_.puaHex } }, @{Expression = { TokenKey $_.token } }, @{Expression = { $_.token } }
	$keep = $items | Select-Object -First 1
	foreach ($it in ($items | Select-Object -Skip 1)) {
		$key = $it.puaHex + "|" + $it.token
		if ($toRemove.Add($key)) {
			$removedList += [PSCustomObject]@{ puaHex = $it.puaHex; token = $it.token; keptPua = $keep.puaHex; keptToken = $keep.token }
		}
	}
}

# Rebuild entries without removed ones, normalize casing, and sort by PUA.
$newEntries = @()
foreach ($e in $mapping.entries) {
	$pua = ([string]$e.puaHex).ToUpper()
	$tok = [string]$e.token
	$key = $pua + "|" + $tok
	if ($toRemove.Contains($key)) { continue }
	$e.puaHex = $pua
	if ($e.PSObject.Properties.Name -contains 'cell' -and $e.cell) { $e.cell = ([string]$e.cell).ToUpper() }
	if (-not ($e.PSObject.Properties.Name -contains 'sheet') -or [string]::IsNullOrEmpty([string]$e.sheet)) {
		$e | Add-Member -NotePropertyName sheet -NotePropertyValue 'E3' -Force
	}
	$newEntries += $e
}

$newEntriesSorted = $newEntries | Sort-Object -Property @{Expression = { ToIntHex ([string]$_.puaHex) } }, @{Expression = { TokenKey ([string]$_.token) } }, @{Expression = { [string]$_.token } }
$mapping.entries = @($newEntriesSorted)

$out = [ordered]@{}
foreach ($name in @(
	'generatedAt',
	'source',
	'puaStartReservedForEssential',
	'skippedMultiCodepointTokensCount',
	'skippedMultiCodepointTokens',
	'skippedCircledTokensCount',
	'skippedCircledTokens',
	'sheets',
	'entries'
)) {
	if ($mapping.PSObject.Properties.Name -contains $name) { $out[$name] = $mapping.$name }
}

$out | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $MappingPath -Encoding UTF8

Write-Host "WROTE: $MappingPath"
Write-Host "DUP_GLYPH_GROUPS_FOUND: $(@($dupGlyphGroups).Count)"
Write-Host "REMOVED_ENTRIES: $(@($removedList).Count)"

if (@($removedList).Count -gt 0) {
	$removedList | Sort-Object puaHex, token | ForEach-Object {
		Write-Host ("- removed {0}@{1} (kept {2}@{3})" -f $_.token, $_.puaHex, $_.keptToken, $_.keptPua)
	}
}

$dupPuaGroups = @($mapping.entries | Group-Object puaHex | Where-Object { $_.Count -gt 1 }).Count
Write-Host "DUP_PUA_GROUPS_AFTER: $dupPuaGroups"
