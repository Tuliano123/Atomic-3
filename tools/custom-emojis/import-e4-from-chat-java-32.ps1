param(
	# Ruta al PNG fuente. Ya no se versiona dentro del RP (se borró la carpeta examples).
	# Pásala explícitamente cuando la necesites.
	[string]$ChatJava32Path = "",
	[string]$OutGlyphE4Path = "c:\Users\anthe\Desktop\Desarrollo\RP\font\glyph_E4.png",
	[string]$MappingE4Path = "c:\Users\anthe\Desktop\Desarrollo\RP\font\mapping.atomic-e4.json",
	[int]$DetectLumaEpsilon = 10,
	[int]$CellBgBorderPx = 1,
	[double]$AlphaGamma = 1.0,
	[int]$MinAlpha = 8,
	[switch]$NoFrame,
	[switch]$NoCenterDot,
	[switch]$Apply
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

if (!(Test-Path -LiteralPath $ChatJava32Path)) { throw "ChatJava32Path not found: $ChatJava32Path" }
if (!(Test-Path -LiteralPath $OutGlyphE4Path)) { throw "glyph_E4.png not found: $OutGlyphE4Path" }
if (!(Test-Path -LiteralPath $MappingE4Path)) { throw "mapping.atomic-e4.json not found: $MappingE4Path" }

# Tokens in the order they appear in chat-java-32.png.
$tokensRaw = @(
	[string]([char]0x2654), # ♔
	[string]([char]0x2655), # ♕
	[string]([char]0x265A), # ♚
	[string]([char]0x265B), # ♛
	[string]([char]0x269C), # ⚜
	[string]([char]0x2646), # ♆
	[string]([char]0x262A), # ☪
	[string]([char]0x2726), # ✦
	[string]([char]0x2727), # ✧
	[string]([char]0x2671), # ♱
	[string]([char]0x2670), # ♰
	[string]([char]0x272E), # ✮
	[string]([char]0x272F), # ✯
	[string]([char]0x06DE), # ۞
	[string]([char]0x270C), # ✌
	[string]([char]0x2622), # ☢
	[string]([char]0x2623), # ☣
	[string]([char]0x0E51), # ๑
	[string]([char]0x2740), # ❀
	[string]([char]0x273F), # ✿
	[string]([char]0x262D), # ☭
	[string]([char]0x30C4), # ツ
	[string]([char]0x2668), # ♨
	[string]([char]0x271F), # ✟
	[string]([char]0x0B90), # ஐ
	[string]([char]0x2732), # ✲
	[string]([char]0x2748), # ❈
	[string]([char]0x27B9), # ➹
	[string]([char]0x271A), # ✚
	[string]([char]0x272A)  # ✪
)
$tokens = $tokensRaw
Write-Host ("tokens={0}" -f $tokens.Count)

function LoadBmp([string]$path) {
	$bytes = [IO.File]::ReadAllBytes($path)
	$ms = New-Object IO.MemoryStream(,$bytes)
	$locked = [System.Drawing.Bitmap]::FromStream($ms)
	$bmp = New-Object System.Drawing.Bitmap($locked)
	$locked.Dispose(); $ms.Dispose()
	return $bmp
}

function SaveBmp([System.Drawing.Bitmap]$bmp, [string]$path) {
	$dir = Split-Path -Parent $path
	if ($dir -and !(Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
	$bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
}

function GetLuma([System.Drawing.Color]$c) {
	# ITU-R BT.709
	return [int](0.2126 * $c.R + 0.7152 * $c.G + 0.0722 * $c.B)
}

function IsGlyphPixel([System.Drawing.Color]$c, [int]$lumaThreshold) {
	if ($c.A -le 0) { return $false }
	return ((GetLuma $c) -ge $lumaThreshold)
}

function MedianInt([int[]]$arr) {
	if (-not $arr -or $arr.Count -eq 0) { return 0 }
	[Array]::Sort($arr)
	return $arr[[int][Math]::Floor($arr.Length / 2)]
}

function GetBackgroundLumaFromBorder([System.Drawing.Bitmap]$bmp, [System.Drawing.Rectangle]$rect, [int]$borderPx) {
	$border = [Math]::Max(1, $borderPx)
	$lumas = New-Object System.Collections.Generic.List[int]
	$x0 = $rect.X
	$y0 = $rect.Y
	$x1 = $rect.X + $rect.Width - 1
	$y1 = $rect.Y + $rect.Height - 1
	for ($y = $y0; $y -le $y1; $y++) {
		for ($x = $x0; $x -le $x1; $x++) {
			$onBorder = ($x -lt ($x0 + $border) -or $x -gt ($x1 - $border) -or $y -lt ($y0 + $border) -or $y -gt ($y1 - $border))
			if (-not $onBorder) { continue }
			$c = $bmp.GetPixel($x, $y)
			if ($c.A -le 0) { continue }
			$lumas.Add((GetLuma $c)) | Out-Null
		}
	}
	return (MedianInt ($lumas.ToArray()))
}

function GetBboxGlyph([System.Drawing.Bitmap]$bmp, [int]$lumaThreshold) {
	$minX=$bmp.Width; $minY=$bmp.Height; $maxX=-1; $maxY=-1
	for ($y=0; $y -lt $bmp.Height; $y++) {
		for ($x=0; $x -lt $bmp.Width; $x++) {
			$c=$bmp.GetPixel($x,$y)
			if (IsGlyphPixel $c $lumaThreshold) {
				if ($x -lt $minX) { $minX=$x }
				if ($y -lt $minY) { $minY=$y }
				if ($x -gt $maxX) { $maxX=$x }
				if ($y -gt $maxY) { $maxY=$y }
			}
		}
	}
	if ($maxX -lt 0) { throw "No glyph pixels found in source" }
	return New-Object System.Drawing.Rectangle($minX,$minY,($maxX-$minX+1),($maxY-$minY+1))
}

function ScoreGrid([System.Drawing.Bitmap]$bmp, [System.Drawing.Rectangle]$bbox, [int]$cellW, [int]$xStart, [int]$n, [int]$lumaThreshold) {
	$nonEmpty=0
	$total=0
	for ($i=0; $i -lt $n; $i++) {
		$cx = $xStart + ($i * $cellW)
		$cnt=0
		for ($y=$bbox.Y; $y -lt ($bbox.Y+$bbox.Height); $y++) {
			for ($x=$cx; $x -lt ($cx+$cellW); $x++) {
				if ($x -lt 0 -or $x -ge $bmp.Width) { continue }
				$c=$bmp.GetPixel($x,$y)
				if (IsGlyphPixel $c $lumaThreshold) { $cnt++ }
			}
		}
		if ($cnt -gt 0) { $nonEmpty++ }
		$total += $cnt
	}
	# Penalize pixels outside the grid range inside bbox (encourages tight placement)
	$outside=0
	$gridX0=$xStart
	$gridX1=$xStart + ($n*$cellW) - 1
	for ($y=$bbox.Y; $y -lt ($bbox.Y+$bbox.Height); $y++) {
		for ($x=$bbox.X; $x -lt ($bbox.X+$bbox.Width); $x++) {
			if ($x -ge $gridX0 -and $x -le $gridX1) { continue }
			$c=$bmp.GetPixel($x,$y)
			if (IsGlyphPixel $c $lumaThreshold) { $outside++ }
		}
	}
	$score = ($nonEmpty * 1000000) + ($total * 10) - ($outside * 5)
	return [PSCustomObject]@{ score=$score; nonEmpty=$nonEmpty; total=$total; outside=$outside }
}

function CropToBounds([System.Drawing.Bitmap]$bmp, [int]$x, [int]$y, [int]$w, [int]$h, [int]$lumaThreshold) {
	$minX=$w; $minY=$h; $maxX=-1; $maxY=-1
	for ($yy=0; $yy -lt $h; $yy++) {
		for ($xx=0; $xx -lt $w; $xx++) {
			$c=$bmp.GetPixel($x+$xx,$y+$yy)
			if (IsGlyphPixel $c $lumaThreshold) {
				if ($xx -lt $minX) { $minX=$xx }
				if ($yy -lt $minY) { $minY=$yy }
				if ($xx -gt $maxX) { $maxX=$xx }
				if ($yy -gt $maxY) { $maxY=$yy }
			}
		}
	}
	if ($maxX -lt 0) { return New-Object System.Drawing.Rectangle(0,0,$w,$h) }
	return New-Object System.Drawing.Rectangle($minX,$minY,($maxX-$minX+1),($maxY-$minY+1))
}

function MakeCell16([System.Drawing.Bitmap]$src, [System.Drawing.Rectangle]$cellRect, [int]$lumaThreshold) {
	# Extract into a temporary bitmap.
	$tmp = New-Object System.Drawing.Bitmap($cellRect.Width, $cellRect.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
	$g=[System.Drawing.Graphics]::FromImage($tmp)
	$g.CompositingMode=[System.Drawing.Drawing2D.CompositingMode]::SourceCopy
	$g.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
	$g.DrawImage($src, (New-Object System.Drawing.Rectangle(0,0,$cellRect.Width,$cellRect.Height)), $cellRect, [System.Drawing.GraphicsUnit]::Pixel)
	$g.Dispose()

	# Build alpha from contrast vs background, keeping grays/darks.
	# Background is estimated from the border pixels of the extracted cell.
	$bgRect = New-Object System.Drawing.Rectangle(0,0,$tmp.Width,$tmp.Height)
	$bgLuma = GetBackgroundLumaFromBorder $tmp $bgRect $CellBgBorderPx
	$den = [Math]::Max(1.0, (255.0 - [double]$bgLuma))
	for ($y=0; $y -lt $tmp.Height; $y++) {
		for ($x=0; $x -lt $tmp.Width; $x++) {
			$c=$tmp.GetPixel($x,$y)
			if ($c.A -le 0) {
				$tmp.SetPixel($x,$y,[System.Drawing.Color]::FromArgb(0,0,0,0))
				continue
			}
			$lum = [double](GetLuma $c)
			$t = ($lum - [double]$bgLuma) / $den
			if ($t -lt 0) { $t = 0 }
			if ($t -gt 1) { $t = 1 }
			if ($AlphaGamma -ne 1.0) { $t = [Math]::Pow($t, $AlphaGamma) }
			$a = [int][Math]::Round(255.0 * $t)
			if ($a -lt $MinAlpha) { $a = 0 }
			$tmp.SetPixel($x,$y,[System.Drawing.Color]::FromArgb($a,255,255,255))
		}
	}

	# Crop to bounds using alpha (reuse CropToBounds by treating lumaThreshold as alpha threshold via luma of white).
	# We treat any non-transparent pixel as glyph.
	$minX=$tmp.Width; $minY=$tmp.Height; $maxX=-1; $maxY=-1
	for ($yy=0; $yy -lt $tmp.Height; $yy++) {
		for ($xx=0; $xx -lt $tmp.Width; $xx++) {
			$c=$tmp.GetPixel($xx,$yy)
			if ($c.A -gt 0) {
				if ($xx -lt $minX) { $minX=$xx }
				if ($yy -lt $minY) { $minY=$yy }
				if ($xx -gt $maxX) { $maxX=$xx }
				if ($yy -gt $maxY) { $maxY=$yy }
			}
		}
	}
	if ($maxX -lt 0) {
		$crop = New-Object System.Drawing.Rectangle(0,0,$tmp.Width,$tmp.Height)
	} else {
		$crop = New-Object System.Drawing.Rectangle($minX,$minY,($maxX-$minX+1),($maxY-$minY+1))
	}
	$cropped = New-Object System.Drawing.Bitmap($crop.Width, $crop.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
	$g2=[System.Drawing.Graphics]::FromImage($cropped)
	$g2.CompositingMode=[System.Drawing.Drawing2D.CompositingMode]::SourceCopy
	$g2.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
	$g2.DrawImage($tmp, (New-Object System.Drawing.Rectangle(0,0,$crop.Width,$crop.Height)), $crop, [System.Drawing.GraphicsUnit]::Pixel)
	$g2.Dispose()
	$tmp.Dispose()

	# Create 16x16 via 2x2 -> 1x1 downsample when possible.
	$dst = New-Object System.Drawing.Bitmap(16,16,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
	# Clear
	for ($yy=0; $yy -lt 16; $yy++) { for ($xx=0; $xx -lt 16; $xx++) { $dst.SetPixel($xx,$yy,[System.Drawing.Color]::FromArgb(0,0,0,0)) } }

	# If cropped is roughly 2x resolution (<=32x32), downsample by blocks; else fall back to fit-scale.
	if ($cropped.Width -le 32 -and $cropped.Height -le 32 -and $cropped.Width -ge 17 -and $cropped.Height -ge 17) {
		$w2 = [Math]::Min(32, $cropped.Width)
		$h2 = [Math]::Min(32, $cropped.Height)
		# Pad into a 32x32 canvas (top-left) so 2x2 blocks align.
		$canvas = New-Object System.Drawing.Bitmap(32,32,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
		$gC=[System.Drawing.Graphics]::FromImage($canvas)
		$gC.CompositingMode=[System.Drawing.Drawing2D.CompositingMode]::SourceCopy
		$gC.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
		$gC.Clear([System.Drawing.Color]::FromArgb(0,0,0,0))
		$gC.DrawImage($cropped, (New-Object System.Drawing.Rectangle(0,0,$cropped.Width,$cropped.Height)))
		$gC.Dispose()
		for ($y=0; $y -lt 16; $y++) {
			for ($x=0; $x -lt 16; $x++) {
				$sumA=0
				for ($dy=0; $dy -lt 2; $dy++) {
					for ($dx=0; $dx -lt 2; $dx++) {
						$c2 = $canvas.GetPixel($x*2+$dx, $y*2+$dy)
						$sumA += $c2.A
					}
				}
				$a = [int][Math]::Round($sumA / 4.0)
				if ($a -lt $MinAlpha) { $a = 0 }
				$dst.SetPixel($x,$y,[System.Drawing.Color]::FromArgb($a,255,255,255))
			}
		}
		$canvas.Dispose()
	} else {
		# Fit-scale alpha mask preserving aspect ratio.
		$scale = [Math]::Min(16.0 / [double]$cropped.Width, 16.0 / [double]$cropped.Height)
		$tw = [int][Math]::Max(1, [Math]::Round($cropped.Width * $scale))
		$thh = [int][Math]::Max(1, [Math]::Round($cropped.Height * $scale))
		$offX = [int][Math]::Floor((16 - $tw) / 2)
		$offY = [int][Math]::Floor((16 - $thh) / 2)
		$g3=[System.Drawing.Graphics]::FromImage($dst)
		$g3.CompositingMode=[System.Drawing.Drawing2D.CompositingMode]::SourceCopy
		$g3.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
		$g3.PixelOffsetMode=[System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
		$g3.DrawImage($cropped, (New-Object System.Drawing.Rectangle($offX,$offY,$tw,$thh)))
		$g3.Dispose()
	}
	$cropped.Dispose()
	return $dst
}

function CellRect32FromLo([int]$lo) {
	$x = ($lo -band 0x0F) * 32
	$y = (($lo -shr 4) -band 0x0F) * 32
	return New-Object System.Drawing.Rectangle($x,$y,32,32)
}

function Put16Into32([System.Drawing.Bitmap]$dst32, [System.Drawing.Rectangle]$cell32, [System.Drawing.Bitmap]$glyph16) {
	$offX = $cell32.X + 8
	$offY = $cell32.Y + 8 - 1
	if ($offY -lt $cell32.Y) { $offY = $cell32.Y }
	# Clear whole cell to avoid any bleed.
	$gClr=[System.Drawing.Graphics]::FromImage($dst32)
	$gClr.CompositingMode=[System.Drawing.Drawing2D.CompositingMode]::SourceCopy
	$gClr.FillRectangle((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(0,0,0,0))), $cell32)
	$gClr.Dispose()

	$g=[System.Drawing.Graphics]::FromImage($dst32)
	$g.CompositingMode=[System.Drawing.Drawing2D.CompositingMode]::SourceCopy
	$g.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
	$g.PixelOffsetMode=[System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
	# Clip strictly to the 16x16 debug box area.
	$clip = New-Object System.Drawing.Rectangle($offX,$offY,16,16)
	$g.SetClip($clip)
	$g.DrawImage($glyph16, (New-Object System.Drawing.Rectangle($offX,$offY,16,16)))
	$g.ResetClip()

	if (-not $NoFrame) {
		$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255,255,0,0), 1)
		try {
			# Marco exacto 16x16 (debug)
			$g.DrawRectangle($pen, $offX, $offY, 15, 15)
		} finally {
			$pen.Dispose()
		}
	}
	if (-not $NoCenterDot) {
		# Centro real de 16x16 es (7.5, 7.5); marcamos un punto 2x2 para indicar el centro exacto.
		$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255,255,0,0))
		try {
			$g.FillRectangle($brush, $offX + 7, $offY + 7, 2, 2)
		} finally {
			$brush.Dispose()
		}
	}
	$g.Dispose()
}

$src = LoadBmp $ChatJava32Path
try {
	# Detect background luma from image border and use it to detect any glyph pixels (including dark grays).
	$imgRect = New-Object System.Drawing.Rectangle(0,0,$src.Width,$src.Height)
	$bgLumaImg = GetBackgroundLumaFromBorder $src $imgRect 2
	$detectTh = [int]([Math]::Min(255, $bgLumaImg + $DetectLumaEpsilon))
	Write-Host ("bgLuma(image)={0} detectTh={1}" -f $bgLumaImg, $detectTh)
	$bbox = GetBboxGlyph $src $detectTh
	Write-Host ("bbox: x={0}..{1} y={2}..{3} size={4}x{5}" -f $bbox.X, ($bbox.X+$bbox.Width-1), $bbox.Y, ($bbox.Y+$bbox.Height-1), $bbox.Width, $bbox.Height)

	$n = $tokens.Count
	$best = $null
	foreach ($cellW in 6..18) {
		$maxStart = $src.Width - ($n * $cellW)
		if ($maxStart -lt 0) { continue }
		for ($xStart=0; $xStart -le $maxStart; $xStart++) {
			$s = ScoreGrid $src $bbox $cellW $xStart $n $detectTh
			if (-not $best -or $s.score -gt $best.score) {
				$best = [PSCustomObject]@{ cellW=$cellW; xStart=$xStart; score=$s.score; nonEmpty=$s.nonEmpty; total=$s.total; outside=$s.outside }
			}
		}
	}
	if (-not $best) { throw "Could not find a grid alignment" }
	Write-Host ("best: cellW={0} xStart={1} nonEmpty={2}/{3} total={4} outside={5}" -f $best.cellW, $best.xStart, $best.nonEmpty, $n, $best.total, $best.outside)

	# Determine y-band from pixels within the chosen grid x-range
	$gridX0=$best.xStart
	$gridX1=$best.xStart + ($n*$best.cellW) - 1
	$minY=$src.Height; $maxY=-1
	for ($y=0; $y -lt $src.Height; $y++) {
		$on=$false
		for ($x=$gridX0; $x -le $gridX1; $x++) {
			$c=$src.GetPixel($x,$y)
			if (IsGlyphPixel $c $detectTh) { $on=$true; break }
		}
		if ($on) { if ($y -lt $minY) { $minY=$y }; if ($y -gt $maxY) { $maxY=$y } }
	}
	if ($maxY -lt 0) { throw "No pixels found inside chosen grid" }
	$bandH = ($maxY-$minY+1)
	Write-Host ("yBand: y={0}..{1} h={2}" -f $minY, $maxY, $bandH)

	# Load destination E4, clear it, and draw sequentially.
	$dst = LoadBmp $OutGlyphE4Path
	try {
		if ($dst.Width -ne 512 -or $dst.Height -ne 512) { throw "glyph_E4.png must be 512x512" }
		$g0=[System.Drawing.Graphics]::FromImage($dst)
		$g0.Clear([System.Drawing.Color]::FromArgb(0,0,0,0))
		$g0.Dispose()

		$newMap = [ordered]@{}

		for ($i=0; $i -lt $n; $i++) {
			$token = $tokens[$i]
			$srcRect = New-Object -TypeName System.Drawing.Rectangle -ArgumentList @(
				[int]($best.xStart + ($i * $best.cellW)),
				[int]$minY,
				[int]$best.cellW,
				[int]$bandH
			)
			$glyph16 = MakeCell16 $src $srcRect $detectTh
			try {
				$lo = $i
				$cell32 = CellRect32FromLo $lo
				Put16Into32 $dst $cell32 $glyph16
			} finally {
				$glyph16.Dispose()
			}
			$newMap[$token] = ("E4{0:X2}" -f $i)
		}

		if (-not $Apply) {
			Write-Host "(dry-run) No files written. Use -Apply to write glyph_E4.png + mapping.atomic-e4.json"
			return
		}

		SaveBmp $dst $OutGlyphE4Path
		$mapObj = Get-Content -LiteralPath $MappingE4Path -Raw -Encoding UTF8 | ConvertFrom-Json
		$mapObj.customMap = $newMap
		$mapObj.notes.custom = "E4 (32x32 celda): sprites 16x16 centrados (Y=-1), alpha por contraste vs fondo (incluye grises/oscuros). Marco rojo 16x16: $(-not $NoFrame). Punto centro: $(-not $NoCenterDot)."
		$mapObj | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $MappingE4Path -Encoding UTF8

		Write-Host "WROTE: $OutGlyphE4Path"
		Write-Host "WROTE: $MappingE4Path"
	} finally {
		$dst.Dispose()
	}

} finally {
	$src.Dispose()
}
