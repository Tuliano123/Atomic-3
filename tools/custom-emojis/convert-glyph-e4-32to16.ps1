param(
	[string]$MasterGlyphE4Path = "c:\Users\anthe\Desktop\Desarrollo\RP\font\glyph_E4.master512.png",
	[string]$OutGlyphE4Path = "c:\Users\anthe\Desktop\Desarrollo\RP\font\glyph_E4.png",
	[string]$MappingE4Path = "c:\Users\anthe\Desktop\Desarrollo\RP\font\mapping.atomic-e4.json",
	[switch]$Apply
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

if (!(Test-Path -LiteralPath $MasterGlyphE4Path)) { throw "MasterGlyphE4Path not found: $MasterGlyphE4Path" }
if (!(Test-Path -LiteralPath $MappingE4Path)) { throw "mapping.atomic-e4.json not found: $MappingE4Path" }

function LoadBmp([string]$path) {
	$bytes = [IO.File]::ReadAllBytes($path)
	$ms = New-Object IO.MemoryStream(,$bytes)
	$locked = [System.Drawing.Bitmap]::FromStream($ms)
	$bmp = New-Object System.Drawing.Bitmap($locked)
	$locked.Dispose(); $ms.Dispose()
	return $bmp
}

function SaveBmp([System.Drawing.Bitmap]$bmp, [string]$path) {
	$bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
}

$mapObj = Get-Content -LiteralPath $MappingE4Path -Raw -Encoding UTF8 | ConvertFrom-Json
$customMap = $mapObj.customMap
if (-not $customMap) { throw "mapping.atomic-e4.json missing customMap" }

$mappedCount = @($customMap.PSObject.Properties).Count

$src = LoadBmp $MasterGlyphE4Path
try {
	if ($src.Width -ne 512 -or $src.Height -ne 512) {
		throw "Expected 512x512 master glyph (32px cells). Found: ${($src.Width)}x${($src.Height)}"
	}

	$dst = New-Object System.Drawing.Bitmap(256,256,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
	try {
		$g=[System.Drawing.Graphics]::FromImage($dst)
		$g.Clear([System.Drawing.Color]::FromArgb(0,0,0,0))
		$g.Dispose()

		$copied = 0
		foreach ($p in $customMap.PSObject.Properties) {
			$hex = [string]$p.Value
			if ($hex.Length -ne 4 -or -not $hex.StartsWith('E4')) { continue }
			# E4RC -> RC is the cell index (00..FF)
			$lo = [Convert]::ToInt32($hex.Substring(2, 2), 16)
			$srcCellX = ($lo -band 0x0F) * 32
			$srcCellY = ((($lo -shr 4) -band 0x0F)) * 32

			# Inner 16x16 area (matches importer placement: +8, +7)
			$srcX0 = $srcCellX + 8
			$srcY0 = $srcCellY + 7

			$dstCellX = ($lo -band 0x0F) * 16
			$dstCellY = ((($lo -shr 4) -band 0x0F)) * 16

			for ($y=0; $y -lt 16; $y++) {
				for ($x=0; $x -lt 16; $x++) {
					$c = $src.GetPixel($srcX0 + $x, $srcY0 + $y)
					# Strip debug overlays (pure red)
					if ($c.A -gt 0 -and $c.R -eq 255 -and $c.G -eq 0 -and $c.B -eq 0) {
						$c = [System.Drawing.Color]::FromArgb(0,0,0,0)
					}
					$dst.SetPixel($dstCellX + $x, $dstCellY + $y, $c)
				}
			}
			$copied++
		}

		Write-Host ("Converted E4: copied={0} mapped={1}" -f $copied, $mappedCount)

		if (-not $Apply) {
			Write-Host "(dry-run) No files written. Use -Apply to write glyph_E4.png (256x256) and update mapping.atomic-e4.json."
			return
		}

		SaveBmp $dst $OutGlyphE4Path
		$mapObj.cellSizePx = 16
		$mapObj.grid = "16x16"
		$mapObj.notes.custom = "E4: sheet 256x256 (celdas 16x16). Glyphs provienen de un master 32x32 y se recortan a 16x16 para mantener ancho/alto estandar en Bedrock."
		$mapObj | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $MappingE4Path -Encoding UTF8
		Write-Host "WROTE: $OutGlyphE4Path"
		Write-Host "WROTE: $MappingE4Path"
	} finally {
		$dst.Dispose()
	}
} finally {
	$src.Dispose()
}
