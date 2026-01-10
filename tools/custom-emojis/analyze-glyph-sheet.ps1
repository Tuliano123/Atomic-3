param(
	[string]$GlyphPath,
	[int]$CellSizePx = 16,
	[int]$Grid = 16,
	[string]$OutReportPath = "",
	[int[]]$ShadowRgb = @()
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($GlyphPath)) { throw "GlyphPath is required" }
if (!(Test-Path -LiteralPath $GlyphPath)) { throw "Glyph not found: $GlyphPath" }

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Runtime.InteropServices

$bytes = [IO.File]::ReadAllBytes($GlyphPath)
$ms = New-Object IO.MemoryStream(,$bytes)
$locked = [System.Drawing.Bitmap]::FromStream($ms)

try {
	$expected = $CellSizePx * $Grid
	if ($locked.Width -ne $expected -or $locked.Height -ne $expected) {
		throw "Expected ${expected}x${expected}px for Grid=${Grid} CellSizePx=${CellSizePx}, got $($locked.Width)x$($locked.Height): $GlyphPath"
	}

	# Copy to 32bpp for predictable BGRA layout
	$bmp = New-Object System.Drawing.Bitmap($locked.Width, $locked.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
	$g = [System.Drawing.Graphics]::FromImage($bmp)
	$g.DrawImage($locked, 0, 0, $locked.Width, $locked.Height)
	$g.Dispose()

	$rect = New-Object System.Drawing.Rectangle(0, 0, $bmp.Width, $bmp.Height)
	$bd = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
	$stride = $bd.Stride
	$buf = New-Object byte[] ($stride * $bmp.Height)
	[System.Runtime.InteropServices.Marshal]::Copy($bd.Scan0, $buf, 0, $buf.Length)
	$bmp.UnlockBits($bd)
	$bmp.Dispose()

	function CellLo([int]$row, [int]$col) {
		$lo = ($row -shl 4) -bor $col
		return ("{0:X2}" -f $lo)
	}

	# Definitions:
	# - "blank": no pixel with alpha>0
	# - "unshaded": has visible pixels, but all visible pixels are pure white (255,255,255)
	# - "shaded": has at least one visible pixel that is NOT pure white
	# Shadow detection (optional):
	# - If -ShadowRgb R G B is provided, a cell is considered "shadowed" if it contains >=1 pixel with that exact RGB and alpha>0.
	$blank = @()
	$unshaded = @()
	$shaded = @()
	$shadowed = @()
	$noShadow = @()

	$useShadow = (@($ShadowRgb).Count -eq 3)
	$shadowR = 0
	$shadowG = 0
	$shadowB = 0
	if ($useShadow) {
		$shadowR = [int]$ShadowRgb[0]
		$shadowG = [int]$ShadowRgb[1]
		$shadowB = [int]$ShadowRgb[2]
	}

	for ($row = 0; $row -lt $Grid; $row++) {
		for ($col = 0; $col -lt $Grid; $col++) {
			$cellX = $col * $CellSizePx
			$cellY = $row * $CellSizePx
			$hasAny = $false
			$hasNonWhite = $false
			$hasShadow = $false

			for ($yy = 0; $yy -lt $CellSizePx; $yy++) {
				$lineOff = ($cellY + $yy) * $stride + ($cellX * 4)
				for ($xx = 0; $xx -lt $CellSizePx; $xx++) {
					$pxOff = $lineOff + ($xx * 4)
					$b = $buf[$pxOff + 0]
					$g = $buf[$pxOff + 1]
					$r = $buf[$pxOff + 2]
					$a = $buf[$pxOff + 3]
					if ($a -eq 0) { continue }
					$hasAny = $true
					if ($useShadow -and -not $hasShadow) {
						if ($r -eq $shadowR -and $g -eq $shadowG -and $b -eq $shadowB) { $hasShadow = $true }
					}
					if ($r -ne 255 -or $g -ne 255 -or $b -ne 255) { $hasNonWhite = $true; break }
				}
				if ($hasNonWhite) { break }
			}

			$lo = CellLo $row $col
			if (-not $hasAny) {
				$blank += $lo
			} elseif ($hasNonWhite) {
				$shaded += $lo
			} else {
				$unshaded += $lo
			}

			if ($useShadow) {
				if (-not $hasAny) {
					# ignore blank
				} elseif ($hasShadow) {
					$shadowed += $lo
				} else {
					$noShadow += $lo
				}
			}
		}
	}

	$report = [PSCustomObject]@{
		generatedAt = (Get-Date).ToString('o')
		glyphPath = $GlyphPath
		cellSizePx = $CellSizePx
		grid = "${Grid}x${Grid}"
		blankCells = @($blank)
		unshadedCells = @($unshaded)
		shadedCells = @($shaded)
		blankCount = @($blank).Count
		unshadedCount = @($unshaded).Count
		shadedCount = @($shaded).Count
		shadowRgb = if ($useShadow) { @($shadowR, $shadowG, $shadowB) } else { @() }
		shadowedCells = if ($useShadow) { @($shadowed) } else { @() }
		noShadowCells = if ($useShadow) { @($noShadow) } else { @() }
		shadowedCount = if ($useShadow) { @($shadowed).Count } else { 0 }
		noShadowCount = if ($useShadow) { @($noShadow).Count } else { 0 }
	}

	if ([string]::IsNullOrWhiteSpace($OutReportPath)) {
		$OutReportPath = Join-Path (Split-Path -Parent $GlyphPath) ("analyze-{0}.json" -f ([IO.Path]::GetFileNameWithoutExtension($GlyphPath)))
	}
	$report | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $OutReportPath -Encoding UTF8

	Write-Host "WROTE: $OutReportPath"
	if ($useShadow) {
		Write-Host ("blank={0} shadowed={1} noShadow={2} (legacy: unshaded={3} shaded={4})" -f $report.blankCount, $report.shadowedCount, $report.noShadowCount, $report.unshadedCount, $report.shadedCount)
	} else {
		Write-Host ("blank={0} unshaded={1} shaded={2}" -f $report.blankCount, $report.unshadedCount, $report.shadedCount)
	}

} finally {
	$locked.Dispose()
	$ms.Dispose()
}
