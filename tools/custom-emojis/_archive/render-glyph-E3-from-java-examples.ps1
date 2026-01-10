param(
	[string]$ExamplesDir = "c:\Users\anthe\Desktop\Desarrollo\RP\font\examples",
	[string]$JavaFontJson = "c:\Users\anthe\Desktop\Desarrollo\RP\font\examples\font_examples\include\default.json",
	[string]$AtomicEssentialJs = "c:\Users\anthe\Desktop\Desarrollo\Atomic BP\scripts\features\custom-emojis\packs\atomicEssential.js",
	[string]$OutGlyphPath = "c:\Users\anthe\Desktop\Desarrollo\RP\font\glyph_E3.png"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$TARGET_BOX = 8  # desired glyph box size inside a 16x16 cell

function Get-PngImage([string]$path) {
	# Load into memory to avoid file locks.
	$bytes = [IO.File]::ReadAllBytes($path)
	$ms = New-Object System.IO.MemoryStream(,$bytes)
	$imgLocked = [System.Drawing.Bitmap]::FromStream($ms)
	$img = New-Object System.Drawing.Bitmap($imgLocked)
	$imgLocked.Dispose()
	$ms.Dispose()
	return $img
}

function Get-CodePoints([string]$s) {
	$points = New-Object System.Collections.Generic.List[int]
	for ($i = 0; $i -lt $s.Length; $i++) {
		$cp = [int][char]$s[$i]
		if ([char]::IsHighSurrogate($s[$i]) -and ($i + 1) -lt $s.Length -and [char]::IsLowSurrogate($s[$i + 1])) {
			$cp = [char]::ConvertToUtf32($s, $i)
			$i++
		}
		$points.Add($cp)
	}
	return $points
}

function Build-JavaGlyphIndex([string]$jsonPath, [string]$examplesDir) {
	$index = @{} # cp(int) -> info

	$json = Get-Content -LiteralPath $jsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
	if (-not $json.providers) { return $index }

	foreach ($p in $json.providers) {
		if ($p.type -ne "bitmap") { continue }
		if (-not $p.file) { continue }

		# file is like minecraft:font/nonlatin_european.png
		$fileStr = [string]$p.file
		$basename = [IO.Path]::GetFileName($fileStr)
		$imgPath = Join-Path $examplesDir $basename
		if (!(Test-Path -LiteralPath $imgPath)) {
			continue
		}

		$img = Get-PngImage $imgPath
		try {
			$tileW = [int]($img.Width / 16)
			$tileH = if ($p.PSObject.Properties.Name -contains "height" -and $p.height) { [int]$p.height } else { $tileW }

			# Expect rows count = img.Height / tileH (nonlatin is 536/8=67)
			$rows = [int]([Math]::Floor($img.Height / $tileH))

			$charsArr = $p.chars
			if (-not $charsArr) { continue }

			for ($r = 0; $r -lt $charsArr.Count; $r++) {
				$rowStr = [string]$charsArr[$r]
				$cps = Get-CodePoints $rowStr
				for ($c = 0; $c -lt 16 -and $c -lt $cps.Count; $c++) {
					$cp = $cps[$c]
					if ($cp -eq 0) { continue }
					if (-not $index.ContainsKey($cp)) {
						$index[$cp] = [PSCustomObject]@{
							ImagePath = $imgPath
							TileW = $tileW
							TileH = $tileH
							Row = $r
							Col = $c
						}
					}
				}
			}
		} finally {
			$img.Dispose()
		}
	}

	return $index
}

function Parse-AtomicEssentialE3Map([string]$jsPath) {
	$txt = Get-Content -LiteralPath $jsPath -Raw -Encoding UTF8
	# Match: ["☠", cp("E302")]
	$re = [regex]'\[\s*"(?<token>[^\"]+)"\s*,\s*cp\("(?<hex>E3[0-9A-Fa-f]{2})"\)\s*\]'
	$matches = $re.Matches($txt)
	$out = @()
	foreach ($m in $matches) {
		$out += [PSCustomObject]@{
			Token = $m.Groups['token'].Value
			Hex = $m.Groups['hex'].Value.ToUpper()
		}
	}
	return $out
}


function Quantize-WhiteOnly([System.Drawing.Bitmap]$bmp) {
	# Converts all non-transparent pixels to solid white (let Minecraft handle the black shadow).
	for ($y = 0; $y -lt $bmp.Height; $y++) {
		for ($x = 0; $x -lt $bmp.Width; $x++) {
			$c = $bmp.GetPixel($x, $y)
			if ($c.A -eq 0) { continue }
			$bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, 255, 255, 255))
		}
	}
}

function Draw-Manual8x8Centered(
	[System.Drawing.Bitmap]$bmp,
	[int]$cellCol,
	[int]$cellRow,
	[string[]]$pattern
) {
	# pattern is 8 strings, each 8 chars:
	# 'W' = white, 'G' = white (legacy), '.' = transparent
	$baseX = $cellCol * 16
	$baseY = $cellRow * 16
	$offX = [int][Math]::Floor((16 - $TARGET_BOX) / 2)
	$offY = [int][Math]::Max(0, [Math]::Floor((16 - $TARGET_BOX) / 2) - 1)
	for ($y = 0; $y -lt 8; $y++) {
		$row = $pattern[$y]
		for ($x = 0; $x -lt 8; $x++) {
			$ch = $row[$x]
			if ($ch -eq '.') { continue }
			$color = [System.Drawing.Color]::FromArgb(255, 255, 255, 255)
			$dx = $baseX + $offX + $x
			$dy = $baseY + $offY + $y
			$bmp.SetPixel($dx, $dy, $color)
		}
	}
}

function CellLoToRowCol([string]$lo) {
	$dstLo = [Convert]::ToInt32($lo, 16)
	return [PSCustomObject]@{
		Col = [int]($dstLo -band 0x0F)
		Row = [int](($dstLo -shr 4) -band 0x0F)
		Lo = $lo.ToUpper()
	}
}

function TokenToCodePoint([string]$token) {
	if ([string]::IsNullOrEmpty($token)) { return $null }
	return [char]::ConvertToUtf32($token, 0)
}

if (!(Test-Path -LiteralPath $ExamplesDir)) { throw "ExamplesDir not found: $ExamplesDir" }
if (!(Test-Path -LiteralPath $JavaFontJson)) { throw "JavaFontJson not found: $JavaFontJson" }
if (!(Test-Path -LiteralPath $AtomicEssentialJs)) { throw "AtomicEssentialJs not found: $AtomicEssentialJs" }

$javaIndex = Build-JavaGlyphIndex -jsonPath $JavaFontJson -examplesDir $ExamplesDir
$targets = Parse-AtomicEssentialE3Map -jsPath $AtomicEssentialJs

# Integrity: ensure no duplicate PUA codes among targets.
$seenHex = @{}
foreach ($t in $targets) {
	$h = [string]$t.Hex
	if ([string]::IsNullOrEmpty($h)) { continue }
	if ($seenHex.ContainsKey($h)) {
		throw "Duplicate target PUA '$h' for tokens '$($seenHex[$h])' and '$($t.Token)'"
	}
	$seenHex[$h] = [string]$t.Token
}

# Manual fallbacks for symbols not present in the Java example bitmap providers.
# Key is low byte (RC) like '24' for E324.
$manual = @{
	# Atomic essential mapping fallbacks (E300..E31B)
	"00" = @(
		"...W....",
		"...W....",
		".WWWWW..",
		"..WWW...",
		".WWWWW..",
		"...W....",
		"...W....",
		"........"
	)
	
	# Decorative batch (E3D0..E3ED) — avoid chunky blocks; keep 8x8 simple
	"D0" = @(
		"..WWWW..",
		"..W.....",
		".WWW....",
		"..W.....",
		"..W.W...",
		"..WW....",
		"..W.....",
		"........"
	)
	"D1" = @(
		"......W.",
		".....WW.",
		"....W.W.",
		"...W..W.",
		"..W...W.",
		".W....W.",
		"W.WWWWW.",
		"........"
	)
	"D2" = @(
		".....W..",
		"....WW..",
		"...W.W..",
		"..W..W..",
		".W...W..",
		"W....W..",
		"WWWWWW..",
		"........"
	)
	"D3" = @(
		"....WW..",
		"...W.W..",
		"..W..W..",
		".W...W..",
		"W....W..",
		"WWWWWW..",
		"........",
		"........"
	)
	"D4" = @(
		"...WW...",
		"..W..W..",
		"..W..W..",
		"...WW...",
		"....W...",
		"....W...",
		"....W...",
		"........"
	)
	"D5" = @(
		"...WW...",
		"..WWWW..",
		"..W..W..",
		"...WW...",
		"....W...",
		"....W...",
		"....W...",
		"........"
	)
	"D6" = @(
		"...W....",
		"...W....",
		".WWWWW..",
		"...W....",
		".WWWWW..",
		"...W....",
		"...W....",
		"........"
	)
	"D7" = @(
		"...W....",
		"...W....",
		"..WWW...",
		"...W....",
		"...W....",
		"..WWW...",
		"...W....",
		"........"
	)
	"D8" = @(
		"...W....",
		"...W....",
		"..WWW...",
		"...W....",
		"...W....",
		"...W....",
		"...W....",
		"........"
	)
	"D9" = @(
		"..W.W...",
		".W.W.W..",
		"..WWW...",
		"WWWWW...",
		"..WWW...",
		".W.W.W..",
		"..W.W...",
		"........"
	)
	"DA" = @(
		"........",
		"..W.W...",
		"...W....",
		".WWWWW..",
		"...W....",
		"..W.W...",
		"........",
		"........"
	)
	"DB" = @(
		"..W.W...",
		"...W....",
		"W.W.W.W.",
		".WWWWW..",
		"W.W.W.W.",
		"...W....",
		"..W.W...",
		"........"
	)
	"DC" = @(
		"........",
		"..W.W...",
		"..WWW...",
		".WWWWW..",
		"..WWW...",
		"..W.W...",
		"........",
		"........"
	)
	"DD" = @(
		"...W....",
		"..W.W...",
		".W...W..",
		"..W.W...",
		"..WWW...",
		"..W.W...",
		".W...W..",
		"........"
	)
	"DE" = @(
		"..W.W...",
		".W.W.W..",
		"..WWW...",
		"W.W.W.W.",
		"..WWW...",
		".W.W.W..",
		"..W.W...",
		"........"
	)
	"DF" = @(
		"..W.W...",
		"...W....",
		".W.W.W..",
		"..WWW...",
		".W.W.W..",
		"...W....",
		"..W.W...",
		"........"
	)
	"E0" = @(
		"W..W..W.",
		".W.W.W..",
		"..WWW...",
		"WW.W.WW.",
		"..WWW...",
		".W.W.W..",
		"W..W..W.",
		"........"
	)
	"E1" = @(
		"W..W..W.",
		".WWWWWW.",
		"..WWW...",
		"WW.W.WW.",
		"..WWW...",
		".WWWWWW.",
		"W..W..W.",
		"........"
	)
	"E2" = @(
		"..W.W...",
		"W.W.W.W.",
		".WWWWW..",
		"W.W.W.W.",
		".WWWWW..",
		"W.W.W.W.",
		"..W.W...",
		"........"
	)
	"E3" = @(
		"..W.W...",
		".W.W.W..",
		"W..W..W.",
		"..WWW...",
		"W..W..W.",
		".W.W.W..",
		"..W.W...",
		"........"
	)
	"E4" = @(
		"..W.W...",
		"...W....",
		".W.W.W..",
		"..W.W...",
		".W.W.W..",
		"...W....",
		"..W.W...",
		"........"
	)
	"E5" = @(
		"..W.W...",
		"..WWW...",
		".W.W.W..",
		"..W.W...",
		".W.W.W..",
		"..WWW...",
		"..W.W...",
		"........"
	)
	"E6" = @(
		"..W.W...",
		".WWWWW..",
		"W.W.W.W.",
		"..W.W...",
		"W.W.W.W.",
		".WWWWW..",
		"..W.W...",
		"........"
	)
	"E7" = @(
		"..W.W...",
		".W.W.W..",
		"..WWW...",
		".W.W.W..",
		"..WWW...",
		".W.W.W..",
		"..W.W...",
		"........"
	)
	"E8" = @(
		"..W.W...",
		"...W....",
		".W.W.W..",
		"..WWW...",
		".W.W.W..",
		"...W....",
		"..W.W...",
		"........"
	)
	"E9" = @(
		"..W.W...",
		".W.W.W..",
		"..WWW...",
		"W.W.W.W.",
		"..WWW...",
		".W.W.W..",
		"..W.W...",
		"........"
	)
	"EA" = @(
		"..W.W...",
		".W.W.W..",
		"W..W..W.",
		"..WWW...",
		"W..W..W.",
		".W.W.W..",
		"..W.W...",
		"........"
	)
	"EB" = @(
		"..WWW...",
		".W.W.W..",
		"W..W..W.",
		"..WWW...",
		"W..W..W.",
		".W.W.W..",
		"..WWW...",
		"........"
	)
	"EC" = @(
		"....W...",
		"...WW...",
		"..W.W...",
		".W..W...",
		"W...W...",
		".WWWW...",
		"..W.....",
		"........"
	)
	"ED" = @(
		"...W....",
		"..W.W...",
		".W...W..",
		"..WWW...",
		".W...W..",
		"..W.W...",
		"...W....",
		"........"
	)

	# Decorative batch (E3B2..E3CF)
	"B2" = @(
		"..WWWW..",
		".W....W.",
		"W.WW.W.W",
		"W.W..W.W",
		"W.WW.W.W",
		".W....W.",
		"..WWWW..",
		"........"
	)
	"B3" = @(
		"...W....",
		"...W....",
		".WWWWW..",
		"...W....",
		".WWWWW..",
		"...W....",
		"...W....",
		"........"
	)
	"B4" = @(
		"..WWW...",
		".W...W..",
		"W....WW.",
		"W....WW.",
		"W....WW.",
		".W...W..",
		"..WWW...",
		"........"
	)
	"B5" = @(
		"........",
		"...W....",
		"...WW...",
		"WWWWWWW.",
		"...WW...",
		"...W....",
		"........",
		"........"
	)
	"B6" = @(
		".WW.WW..",
		".WW.WW..",
		".WW.WW..",
		"........",
		"........",
		"........",
		"........",
		"........"
	)
	"B7" = @(
		".WW.....",
		"W..W....",
		".WW.....",
		"..WWW...",
		"..W.....",
		"..W.....",
		"..WWW...",
		"........"
	)
	"B8" = @(
		"..WW....",
		"..WW....",
		"WWWWWW..",
		"..WW....",
		".W.W....",
		"W...W...",
		"........",
		"........"
	)
	"B9" = @(
		".W...W..",
		"..WWW...",
		".W.W.W..",
		"..WWW...",
		".W.W.W..",
		"..WWW...",
		".W...W..",
		"........"
	)
	"BA" = @(
		"...W....",
		"..WW....",
		".WWW....",
		"WWWW....",
		".WWW....",
		"..WW....",
		"...W....",
		"........"
	)
	"BB" = @(
		"....W...",
		"....WW..",
		"....WWW.",
		"....WWWW",
		"....WWW.",
		"....WW..",
		"....W...",
		"........"
	)
	"BC" = @(
		"WWWWWW..",
		"W....W..",
		"W...W...",
		"W..W....",
		"W.W.....",
		"WW....W.",
		"WWWWWW..",
		"........"
	)
	"BD" = @(
		"WWWWWW..",
		"WW.WWW..",
		"WW.WWW..",
		"WWWWWW..",
		"WW.WWW..",
		"WW.WWW..",
		"WWWWWW..",
		"........"
	)
	"BE" = @(
		"..WWW...",
		".WWWWW..",
		"WWWW.WW.",
		"WWWW.WW.",
		"WWWW.WW.",
		".WWWWW..",
		"..WWW...",
		"........"
	)
	"BF" = @(
		"..WWW...",
		".WWWWW..",
		"WW.WWWW.",
		"WW.WWWW.",
		"WW.WWWW.",
		".WWWWW..",
		"..WWW...",
		"........"
	)
	"C0" = @(
		"........",
		"...W....",
		"..WWW...",
		".W.W.W..",
		"WWWWWWW.",
		".W.W.W..",
		"..WWW...",
		"...W...."
	)
	"C1" = @(
		"...W....",
		"..WWW...",
		"...W....",
		"...W....",
		"...W....",
		"..WWW...",
		"...W....",
		"........"
	)
	"C2" = @(
		"........",
		"..WWWW..",
		"..WWWW..",
		"..WWWW..",
		"..WWWW..",
		"........",
		"........",
		"........"
	)
	"C3" = @(
		"........",
		"..WWWW..",
		"..W..W..",
		"..W..W..",
		"..WWWW..",
		"........",
		"........",
		"........"
	)
	"C4" = @(
		"...W....",
		"..W.W...",
		".W...W..",
		"W.....W.",
		".W...W..",
		"..W.W...",
		"...W....",
		"........"
	)
	"C5" = @(
		"........",
		"...WW...",
		"..W..W..",
		"..W..W..",
		"...WW...",
		"........",
		"........",
		"........"
	)
	"C6" = @(
		"WWWWWW..",
		"W....W..",
		"W.WW.W..",
		"W.WW.W..",
		"W.WW.W..",
		"W....W..",
		"WWWWWW..",
		"........"
	)
	"C7" = @(
		"WWWWWW..",
		"W....W..",
		"WWWWWW..",
		"W....W..",
		"WWWWWW..",
		"W....W..",
		"WWWWWW..",
		"........"
	)
	"C8" = @(
		"WWWWWW..",
		"WW.WWW..",
		"WW.WWW..",
		"WW.WWW..",
		"WW.WWW..",
		"WW.WWW..",
		"WWWWWW..",
		"........"
	)
	"C9" = @(
		"WWWWWW..",
		"WW.WWW..",
		"W.W.WW..",
		"WW.WWW..",
		"W.W.WW..",
		"WW.WWW..",
		"WWWWWW..",
		"........"
	)
	"CA" = @(
		"WWWWWW..",
		"W...WW..",
		"W..W.W..",
		"W.W..W..",
		"WW...W..",
		"WWWWWW..",
		"........",
		"........"
	)
	"CB" = @(
		"..WWW...",
		".WWWWW..",
		"WW.W.WW.",
		"WW.W.WW.",
		"WW.W.WW.",
		".WWWWW..",
		"..WWW...",
		"........"
	)
	"CC" = @(
		"..WWW...",
		".WWWWW..",
		"WW...WW.",
		"WW.W.WW.",
		"WW...WW.",
		".WWWWW..",
		"..WWW...",
		"........"
	)
	"CD" = @(
		"...W....",
		"..W.W...",
		".W...W..",
		"W..W..W.",
		".W...W..",
		"..W.W...",
		"...W....",
		"........"
	)
	"CE" = @(
		"..WW....",
		"..W.W...",
		"..W.W...",
		"..WW....",
		"..W.....",
		"..W.....",
		"..W.....",
		"........"
	)
	"CF" = @(
		"........",
		"...W....",
		"...WW...",
		"WWWWWWW.",
		"...WW...",
		"...W....",
		"........",
		"........"
	)
	"01" = @(
		"...W....",
		"..W.W...",
		".W...W..",
		"..WWW...",
		".W...W..",
		"..W.W...",
		"...W....",
		"........"
	)
	"05" = @(
		"W..W..W.",
		".W.W.W..",
		"..WWW...",
		"WW.W.WWW",
		"..WWW...",
		".W.W.W..",
		"W..W..W.",
		"........"
	)
	"06" = @(
		"..WWW...",
		".WWWWW..",
		"WWWWWWW.",
		"..WWW...",
		"...W....",
		"...W....",
		"..W.....",
		"........"
	)
	"07" = @(
		"..WWW...",
		".WWWWW..",
		"WWWWWWW.",
		"WWWWWWW.",
		".WWWWWW.",
		"..WWWW..",
		"........",
		"........"
	)
	"08" = @(
		"..W.W...",
		".WWWWW..",
		"WWW.WWW.",
		".WWWWW..",
		"..W.W...",
		"...W....",
		"...W....",
		"........"
	)
	"09" = @(
		"..WWW...",
		".WW.WW..",
		"WW...WW.",
		".WW.WW..",
		"..WWW...",
		"...W....",
		"........",
		"........"
	)
	"0A" = @(
		".WW.WW..",
		"WWWWWWW.",
		"WWWWWWW.",
		".WWWWW..",
		"..WWW...",
		"...W....",
		"...W....",
		"........"
	)
	"0B" = @(
		"...W....",
		"...W....",
		"...W....",
		"WWWWWWW.",
		"...W....",
		"...W....",
		"...W....",
		"........"
	)

	# Legacy/explicit cells requested (keep populated even if mappings move)
	"2E" = @(
		"..W.W...",
		".WWWWW..",
		"WW.W.WW.",
		"WWWWWWW.",
		"WW.W.WW.",
		".WWWWW..",
		"..W.W...",
		"........"
	)
	"2F" = @(
		"..WWW...",
		".WWWWW..",
		"..WWW...",
		".WWWWW..",
		"WWWWWWW.",
		"..WWW...",
		".W...W..",
		"........"
	)
	"34" = @(
		"........",
		".WWWW...",
		"WW..WW..",
		"W....W..",
		"WW..WW..",
		".WWWW...",
		"..WW....",
		"........"
	)
	"35" = @(
		"..WWW...",
		".W...W..",
		"W..W....",
		"W.WWW...",
		"W..W.W..",
		".W...W..",
		"..WWW...",
		"...W...."
	)
	"7D" = @(
		"......W.",
		".....W..",
		"....W...",
		"...W....",
		"..W.....",
		".W......",
		"WWWWWWW.",
		"........"
	)
	"7E" = @(
		"........",
		"W......W",
		".W....W.",
		"..W..W..",
		"...WW...",
		"........",
		"........",
		"........"
	)
	"7F" = @(
		"........",
		"..WWWW..",
		".W....W.",
		"W......W",
		"W......W",
		".W....W.",
		"..WWWW..",
		"........"
	)
	"0C" = @(
		"..WWW...",
		".W...W..",
		"W..W..W.",
		"W.WWW.W.",
		"W..W..W.",
		".W...W..",
		"..WWW...",
		"........"
	)
	"0D" = @(
		"..W.W...",
		".WWWWW..",
		".WWWWW..",
		"..WWW...",
		".WWWWW..",
		".WWWWW..",
		"..W.W...",
		"........"
	)
	"0E" = @(
		"..W.W...",
		".W.W.W..",
		"..WWW...",
		"WWWWWWW.",
		"..WWW...",
		".W.W.W..",
		"..W.W...",
		"........"
	)
	"0F" = @(
		"W..W..W.",
		".W.W.W..",
		"..WWW...",
		"...W....",
		"..WWW...",
		".W.W.W..",
		"W..W..W.",
		"........"
	)
	"10" = @(
		"...W....",
		"...W....",
		"..WWW...",
		"WWWWWWW.",
		"..WWW...",
		"...W....",
		"...W....",
		"........"
	)
	"11" = @(
		"..WWW...",
		".WWWWW..",
		"WW.W.WW.",
		"WW...WW.",
		"WW.W.WW.",
		".WWWWW..",
		"..WWW...",
		"........"
	)
	"12" = @(
		".WW.WW..",
		"WWWWWWW.",
		"WWWWWWW.",
		".WWWWW..",
		"..WWW...",
		"...W....",
		"........",
		"........"
	)
	"13" = @(
		"..WW....",
		".WWWW...",
		"WWWWWW..",
		".WWWWW..",
		"..WWWW..",
		"...WW...",
		"........",
		"........"
	)
	"14" = @(
		"....WW..",
		"...WWWW.",
		"..WWWWWW",
		"..WWWWW.",
		"..WWWW..",
		"...WW...",
		"........",
		"........"
	)
	"15" = @(
		"W..W..W.",
		".W.W.W..",
		"..WWW...",
		"WWWWWWW.",
		"..WWW...",
		".W.W.W..",
		"W..W..W.",
		"........"
	)
	"16" = @(
		"W..W..W.",
		"..WWW...",
		".WWWWW..",
		"W.WWW.W.",
		".WWWWW..",
		"..WWW...",
		"W..W..W.",
		"........"
	)
	"17" = @(
		"..W.W...",
		".W.W.W..",
		"..WWW...",
		".WWWWW..",
		"..WWW...",
		".W.W.W..",
		"..W.W...",
		"........"
	)
	"18" = @(
		"WWWW....",
		"WW......",
		"WW......",
		"WW......",
		"WW......",
		"WW......",
		"WWWW....",
		"........"
	)
	"19" = @(
		"....WWWW",
		"......WW",
		"......WW",
		"......WW",
		"......WW",
		"......WW",
		"....WWWW",
		"........"
	)
	"1A" = @(
		"WWWWWWWW",
		"...WW...",
		"...WW...",
		"...WW...",
		"...WW...",
		"...WW...",
		"...WW...",
		"........"
	)
	"1B" = @(
		"WWWWWWWW",
		"...W....",
		"...W....",
		"...W....",
		"...W....",
		"...W....",
		"...W....",
		"........"
	)

	# Java chat (curated 20) fallbacks
	"4A" = @(
		"...W....",
		"..WWW...",
		".W.W.W..",
		"..WWW...",
		".WWWWW..",
		"..W.W...",
		".W...W..",
		"........"
	)
	"4C" = @(
		"........",
		"..WW....",
		".W..W...",
		"W....W..",
		"W....W..",
		".W..W...",
		"..WW....",
		"........"
	)
	"4D" = @(
		"........",
		"...WW...",
		"..W..W..",
		"..W..W..",
		"...WW...",
		"....W...",
		"...W....",
		"........"
	)
	"4F" = @(
		"...W....",
		"..WW....",
		".WWW....",
		"WWWWWWW.",
		".WWW....",
		"..WW....",
		"...W....",
		"........"
	)
	"50" = @(
		"....W...",
		"....WW..",
		"....WWW.",
		".WWWWWWW",
		"....WWW.",
		"....WW..",
		"....W...",
		"........"
	)
	"52" = @(
		"...W....",
		"..WWW...",
		".WWWWW..",
		"...W....",
		"...W....",
		"...W....",
		"...W....",
		"........"
	)
	"54" = @(
		"...W....",
		"...W....",
		"...W....",
		"...W....",
		".WWWWW..",
		"..WWW...",
		"...W....",
		"........"
	)
	"55" = @(
		"......W.",
		".....WW.",
		"....WWW.",
		"...WWW..",
		"..WWW...",
		".WWW....",
		"WWW.....",
		"........"
	)
	"56" = @(
		"W.....W.",
		"W.....W.",
		".W...W..",
		".W...W..",
		"..W.W...",
		"..W.W...",
		"...W....",
		"........"
	)
	"57" = @(
		"W...W...",
		".W.W.W..",
		"..W.W...",
		"........",
		"..WWW...",
		".WWWWW..",
		"WWWWWWW.",
		"........"
	)
	"58" = @(
		"..WWW...",
		".W...W..",
		".W..WW..",
		".W.W.W..",
		".WW..W..",
		".W...W..",
		"..WWW...",
		"........"
	)
	"5A" = @(
		"..W.W...",
		"..W.W...",
		"..WWW...",
		"...W....",
		".WWWWW..",
		"...W....",
		"...W....",
		"........"
	)
	"5B" = @(
		"..WWWW..",
		".WWW..W.",
		"WWW..WW.",
		"WWW.WW..",
		"WWW..WW.",
		".WWW..W.",
		"..WWWW..",
		"........"
	)

	# Java chat (30 icons) fallbacks
	"5E" = @(
		"W.....W.",
		".W...W..",
		"..W.W...",
		"...W....",
		"..W.W...",
		".W...W..",
		"W.....W.",
		"........"
	)
	"5F" = @(
		"W.....W.",
		".W...W..",
		"..W.W...",
		"...W....",
		"..W.W...",
		".W...W..",
		"W.....W.",
		"........"
	)
	"60" = @(
		"...WW...",
		"..W..W..",
		"..W..W..",
		"...WW...",
		"....W...",
		"...W....",
		"..W.....",
		"........"
	)
	"61" = @(
		".WWWWWW.",
		"W......W",
		"W.W..W.W",
		"W..WW..W",
		"W......W",
		"W......W",
		".WWWWWW.",
		"........"
	)
	"62" = @(
		"W......W",
		".W....W.",
		"..W..W..",
		"...WW...",
		"..W..W..",
		".W....W.",
		"W......W",
		"........"
	)
	"63" = @(
		"..WWW...",
		".W...W..",
		".W...W..",
		"..WWW...",
		"...W....",
		"..WWW...",
		"...W....",
		"........"
	)
	"64" = @(
		"..WWW...",
		".W...W..",
		".W...W..",
		"..WWW...",
		"...W....",
		"..WWW...",
		"..WWW...",
		"........"
	)
	"65" = @(
		"..W.....",
		".WWW....",
		"..W.W...",
		".WWWWW..",
		"...W....",
		"..W.W...",
		"...W....",
		"........"
	)
	"66" = @(
		"WW...WW.",
		".W.W.W..",
		"..WWW...",
		"...W....",
		"...W....",
		"...W....",
		"...W....",
		"........"
	)
	"67" = @(
		"..WWW...",
		".W...W..",
		".W.W.W..",
		".W..WW..",
		".W.....W",
		".W....W.",
		"..WWW...",
		"........"
	)
	"68" = @(
		"..WWW...",
		".W...W..",
		"W.......",
		"W.......",
		"W.......",
		".W...W..",
		"..WWW...",
		"........"
	)
	"69" = @(
		"WW...WW.",
		"WWW..WW.",
		"WWWW.WW.",
		"WW.WWWW.",
		"WW..WWW.",
		"WW...WW.",
		"........",
		"........"
	)
	"6A" = @(
		"..WWW...",
		".W...W..",
		"....W...",
		"...W....",
		"...W....",
		"........",
		"...W....",
		"........"
	)
	"6B" = @(
		"...W....",
		"........",
		"...W....",
		"...W....",
		"...W....",
		"..W.....",
		".W...W..",
		"..WWW..."
	)
	"6C" = @(
		".WWWWW..",
		".....W..",
		"....W...",
		"...W....",
		"..W.....",
		".W.WWW..",
		".....W..",
		"........"
	)
	"6D" = @(
		"..WWWW..",
		".....W..",
		"..WWWW..",
		".....W..",
		"..WWWW..",
		"........",
		"........",
		"........"
	)
	"6E" = @(
		"..WWWW..",
		".....W..",
		"..WWWW..",
		".....W..",
		"..WWWW..",
		"....W...",
		"..WWW...",
		"........"
	)
	"6F" = @(
		"..WWWW..",
		"..W..W..",
		"..W..W..",
		"..WWWW..",
		"....W...",
		"...W....",
		"..W.....",
		"........"
	)
	"70" = @(
		"..WWWW..",
		"..W..W..",
		"..W..W..",
		"..WWWW..",
		"....W...",
		"...W....",
		"..WWW...",
		"........"
	)
	"71" = @(
		"..WWWW..",
		".....W..",
		"..WWWW..",
		"....W...",
		"..WWWW..",
		"........",
		"........",
		"........"
	)
	"72" = @(
		"..WWWW..",
		".....W..",
		"..WWWW..",
		"....W...",
		"..WWWW..",
		"...W....",
		"..W.....",
		"........"
	)
	"73" = @(
		"..WWWW..",
		".....W..",
		"..WWWW..",
		"....W...",
		"..WWWW..",
		".....W..",
		"....W...",
		"........"
	)
	"74" = @(
		"..WWWW..",
		".....W..",
		"..WWWW..",
		"....W...",
		"..WWWW..",
		".....W..",
		"..WWW...",
		"........"
	)
	"75" = @(
		"........",
		"..W.W...",
		".W.W.W..",
		"W.W.W.W.",
		"........",
		"........",
		"........",
		"........"
	)
	"76" = @(
		"........",
		"...W.W..",
		"..W.W.W.",
		".W.W.W.W",
		"........",
		"........",
		"........",
		"........"
	)
	"77" = @(
		"........",
		"..WWWW..",
		".W....W.",
		".W....W.",
		"..WWWW..",
		"........",
		"........",
		"........"
	)
	"78" = @(
		"........",
		"..WWWW..",
		".W....W.",
		".W....W.",
		"..WWWW..",
		"........",
		"........",
		"........"
	)
	"79" = @(
		"..WWW...",
		".W...W..",
		"W.W..W..",
		"W.W..W..",
		"W.W..W..",
		".W...W..",
		"..W.....",
		"........"
	)
	"7A" = @(
		"....WWW.",
		"...W....",
		"..W.....",
		".W......",
		"..W.....",
		"...W....",
		"....WWW.",
		"........"
	)
	"7B" = @(
		".WWW....",
		"....W...",
		".....W..",
		"......W.",
		".....W..",
		"....W...",
		".WWW....",
		"........"
	)
	"80" = @(
		"..WWW...",
		".W...W..",
		"W.....W.",
		"W.....W.",
		"W..W..W.",
		".W...W..",
		"..WWW...",
		"........"
	)
	"81" = @(
		".WWWWW..",
		"W.....W.",
		"W.....W.",
		"W.....W.",
		"W.....W.",
		"W.....W.",
		".WWWWW..",
		"........"
	)
	"82" = @(
		"..WWW...",
		".W...W..",
		"W.W.W.W.",
		"W..W..W.",
		"W.W.W.W.",
		".W...W..",
		"..WWW...",
		"........"
	)
	"83" = @(
		"..WWW...",
		".W...W..",
		"W.....W.",
		"W.....W.",
		"W.....W.",
		".W...W..",
		"..WWW...",
		"........"
	)
	"84" = @(
		"...W....",
		"..W.W...",
		".W...W..",
		".W...W..",
		"WWWWWWW.",
		"........",
		"........",
		"........"
	)
	"85" = @(
		"..WWW...",
		".W...W..",
		"W.....W.",
		"W..W..W.",
		"W.....W.",
		".W...W..",
		"..WWW...",
		"........"
	)
	"86" = @(
		"..WW....",
		"...W....",
		"..W.....",
		".WWWW...",
		"...W....",
		"..W.....",
		".WW.....",
		"........"
	)
	"87" = @(
		".W...W..",
		"WW.W.WW.",
		"WWWWWWW.",
		".WWWWW..",
		"..WWW...",
		"...W....",
		"........",
		"........"
	)
	"88" = @(
		"W...W...",
		"W...W...",
		"...W....",
		"..WWW...",
		".W...W..",
		".W...W..",
		"..WWW...",
		"........"
	)
	"89" = @(
		".WWWWW..",
		"W.....W.",
		"W.WWW.W.",
		"W.W.W.W.",
		"W.WWW.W.",
		"W.....W.",
		".WWWWW..",
		"........"
	)
	"8A" = @(
		"WWWW....",
		"..W.....",
		"WWWW....",
		"..W.....",
		"WWWW....",
		"...W....",
		"WWWW....",
		"........"
	)
	"8B" = @(
		"W....W..",
		".W..W...",
		"..WW....",
		"...W....",
		"..WW....",
		".W..W...",
		"W....W..",
		"........"
	)
	"8C" = @(
		".WW.WW..",
		".WW.WW..",
		"...W....",
		"..W.....",
		"........",
		"........",
		"........",
		"........"
	)
	"8D" = @(
		"..W.W...",
		"..W.W...",
		"WWWWWWW.",
		"..W.W...",
		"WWWWWWW.",
		"..W.W...",
		"..W.W...",
		"........"
	)
	"8E" = @(
		"..WWW...",
		".W...W..",
		".W.W....",
		"..WW....",
		".W..W...",
		"W...W.W.",
		".WWW.W..",
		"........"
	)
	"8F" = @(
		"...W....",
		"...W....",
		"...W....",
		"...W....",
		"WWWWWWW.",
		"........",
		"........",
		"........"
	)
	"90" = @(
		"WWWWWWW.",
		"..WWW...",
		"WWWWWWW.",
		"..WWW...",
		"WWWWWWW.",
		"........",
		"........",
		"........"
	)
	"91" = @(
		"WWWWWWW.",
		"W.......",
		"W.......",
		"W.......",
		"W.......",
		"........",
		"........",
		"........"
	)
	"92" = @(
		"..WWW...",
		".W..W...",
		"....W...",
		"..WWW...",
		".W..W...",
		".W..W...",
		"..WWW...",
		"........"
	)
	"93" = @(
		"..WWW...",
		".W...W..",
		"....W...",
		"..WWW...",
		"...W....",
		".W...W..",
		"..WWW...",
		"........"
	)

	# Crowns
	"24" = @(
		"W.W.W...",
		"W.W.W...",
		"WWWWWW..",
		".WWWW...",
		".WWWW...",
		"WWWWWW..",
		"........",
		"........"
	)
	"25" = @(
		"W..W..W.",
		".W.W.W..",
		"WWWWW...",
		".WWW....",
		".WWW....",
		"WWWWW...",
		"........",
		"........"
	)
	"26" = @(
		"...W....",
		"..WWW...",
		"...W....",
		"WWWWW...",
		"WWWWW...",
		"WWWWW...",
		"........",
		"........"
	)
	"27" = @(
		"W.W.W...",
		".WWW....",
		".WWW....",
		"WWWWW...",
		"WWWWW...",
		"........",
		"........",
		"........"
	)

	# Crescent (left) ☾
	"2A" = @(
		"..WWWW..",
		".WWW....",
		"WWW.....",
		"WWW.....",
		"WWW.....",
		".WWW....",
		"..WWWW..",
		"........"
	)

	# Sun with rays ☼
	"2C" = @(
		"W..W..W.",
		".W.W.W..",
		"..WWW...",
		"WWWWWWW.",
		"..WWW...",
		".W.W.W..",
		"W..W..W.",
		"........"
	)

	# 4-point stars
	"38" = @(
		"...W....",
		"...W....",
		"..WWW...",
		"WWWWWWW.",
		"..WWW...",
		"...W....",
		"...W....",
		"........"
	)
	"39" = @(
		"...W....",
		"...W....",
		"..W.W...",
		"WW...WW.",
		"..W.W...",
		"...W....",
		"...W....",
		"........"
	)

	# X marks
	"3C" = @(
		"WW....WW",
		".WW..WW.",
		"..WWWW..",
		"...WW...",
		"..WWWW..",
		".WW..WW.",
		"WW....WW",
		"........"
	)
	"3D" = @(
		"W......W",
		".W....W.",
		"..W..W..",
		"...WW...",
		"..W..W..",
		".W....W.",
		"W......W",
		"........"
	)

	# Radiation / Biohazard (approx)
	"48" = @(
		"...WW...",
		"..W..W..",
		".W.WW.W.",
		".WW..WW.",
		".W.WW.W.",
		"..W..W..",
		"...WW...",
		"........"
	)
	"49" = @(
		"...WW...",
		"..WWWW..",
		".WW..WW.",
		"WWW..WWW",
		".WW..WW.",
		"..WWWW..",
		"...WW...",
		"........"
	)

	# === Next batch manual fallbacks (E394..E3B1) ===
	"9C" = @(
		"..WWWW..",
		".W....W.",
		"W......W",
		"W......W",
		"W......W",
		"W......W",
		".W....W.",
		"..WWWW.."
	)
	"A6" = @(
		".WWWW...",
		".W...W..",
		".W...W..",
		".WWWW...",
		".W......",
		".W......",
		".W......",
		"........"
	)
	"A7" = @(
		".WWWW...",
		"..WW....",
		"..WW....",
		"..WW....",
		"..WW....",
		"..WW....",
		".WWWW...",
		"........"
	)
	"A8" = @(
		".WWWW...",
		".W...W..",
		".W...W..",
		".WWWW...",
		".W.W....",
		".W..W...",
		".W...W..",
		"........"
	)
	"A9" = @(
		"W...W...",
		"WW..W...",
		"W.W.W...",
		"W..WW...",
		"W...W...",
		"W...W...",
		"........",
		"........"
	)
	"AC" = @(
		"..WWWW..",
		".W....W.",
		"W......W",
		"........",
		"........",
		"........",
		"........",
		"........"
	)
	"AD" = @(
		"........",
		"........",
		"........",
		"........",
		"........",
		"W......W",
		".W....W.",
		"..WWWW.."
	)
	"AE" = @(
		"..WWWW..",
		".W......",
		"W.......",
		"W.......",
		"W.......",
		"W.......",
		"W.......",
		"........"
	)
	"AF" = @(
		"..WWWW..",
		"......W.",
		".......W",
		".......W",
		".......W",
		".......W",
		".......W",
		"........"
	)
	"B0" = @(
		"........",
		".......W",
		".......W",
		".......W",
		".......W",
		".......W",
		"......W.",
		"..WWWW.."
	)
	"B1" = @(
		"........",
		"W.......",
		"W.......",
		"W.......",
		"W.......",
		"W.......",
		".W......",
		"..WWWW.."
	)
}

# Create a clean 256x256 sheet
$dest = New-Object System.Drawing.Bitmap 256, 256, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($dest)
$g.Clear([System.Drawing.Color]::Transparent)
$g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

$loaded = @{} # imgPath -> Bitmap
$imported = 0
$missing = @()
$manualDrawn = 0

$fixedCells = @(
	# cellLo -> token (these are drawn into specific E3xx cells)
	[PSCustomObject]@{ Lo = "2E"; Token = "☀"; ForceManual = $true },
	[PSCustomObject]@{ Lo = "2F"; Token = "☃"; ForceManual = $true },
	[PSCustomObject]@{ Lo = "34"; Token = "☏"; ForceManual = $true },
	[PSCustomObject]@{ Lo = "35"; Token = "¢"; ForceManual = $true },
	[PSCustomObject]@{ Lo = "7D"; Token = "∠"; ForceManual = $true },
	[PSCustomObject]@{ Lo = "7E"; Token = "∨"; ForceManual = $true },
	[PSCustomObject]@{ Lo = "7F"; Token = "∩"; ForceManual = $true }
)

$fixedMissing = @()

try {
	$transparentBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
	foreach ($t in $targets) {
		$token = [string]$t.Token
		$hex = [string]$t.Hex
		if ([string]::IsNullOrEmpty($token) -or [string]::IsNullOrEmpty($hex)) { continue }

		$cp = [char]::ConvertToUtf32($token, 0)
		if (-not $javaIndex.ContainsKey($cp)) {
			$missing += [PSCustomObject]@{ token = $token; codePoint = ("{0:X4}" -f $cp); pua = $hex }
			continue
		}

		$info = $javaIndex[$cp]
		$imgPath = [string]$info.ImagePath
		if (-not $loaded.ContainsKey($imgPath)) {
			$loaded[$imgPath] = Get-PngImage $imgPath
		}
		$srcBmp = $loaded[$imgPath]

		$tileW = [int]$info.TileW
		$tileH = [int]$info.TileH
		$srcX = [int]$info.Col * $tileW
		$srcY = [int]$info.Row * $tileH
		$srcRect = New-Object System.Drawing.Rectangle($srcX, $srcY, $tileW, $tileH)

		$dstLo = [Convert]::ToInt32($hex.Substring(2), 16)
		$dstCol = [int]($dstLo -band 0x0F)
		$dstRow = [int](($dstLo -shr 4) -band 0x0F)
		$baseX = [int]($dstCol * 16)
		$baseY = [int]($dstRow * 16)

		# Scale to a smaller target box (default 8x8) so glyphs don't look oversized in Bedrock.
		$scale = if ($tileW -eq 8 -and $tileH -eq 8) { 1 } else { [Math]::Min($TARGET_BOX / $tileW, $TARGET_BOX / $tileH) }
		$dstW = [int][Math]::Round($tileW * $scale)
		$dstH = [int][Math]::Round($tileH * $scale)
		if ($dstW -gt $TARGET_BOX) { $dstW = $TARGET_BOX }
		if ($dstH -gt $TARGET_BOX) { $dstH = $TARGET_BOX }
		if ($dstW -lt 1) { $dstW = 1 }
		if ($dstH -lt 1) { $dstH = 1 }

		$offX = [int][Math]::Floor((16 - $dstW) / 2)
		$offY = [int][Math]::Max(0, [Math]::Floor((16 - $dstH) / 2) - 1)
		$dstRect = New-Object System.Drawing.Rectangle([int]($baseX + $offX), [int]($baseY + $offY), [int]$dstW, [int]$dstH)

		$g.DrawImage($srcBmp, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
		$imported++
	}

	# Ensure certain legacy cells are always populated.
	foreach ($fx in $fixedCells) {
		$lo = ([string]$fx.Lo).ToUpper()
		$token = [string]$fx.Token
		$cp = TokenToCodePoint $token
		if ($cp -eq $null) { continue }

		$rc = CellLoToRowCol $lo
		$baseX = [int]($rc.Col * 16)
		$baseY = [int]($rc.Row * 16)
		# Clear the cell first (idempotent even if already empty)
		$g.FillRectangle($transparentBrush, $baseX, $baseY, 16, 16)

		$forceManual = $false
		try {
			if ($fx.PSObject.Properties.Name -contains "ForceManual") { $forceManual = [bool]$fx.ForceManual }
		} catch {
			$forceManual = $false
		}

		if ($forceManual) {
			if ($manual.ContainsKey($lo)) {
				Draw-Manual8x8Centered -bmp $dest -cellCol $rc.Col -cellRow $rc.Row -pattern $manual[$lo]
				$manualDrawn++
				continue
			}

			$fixedMissing += [PSCustomObject]@{ token = $token; codePoint = ("{0:X4}" -f $cp); pua = ("E3" + $lo) }
			continue
		}

		if (-not $javaIndex.ContainsKey($cp)) {
			$fixedMissing += [PSCustomObject]@{ token = $token; codePoint = ("{0:X4}" -f $cp); pua = ("E3" + $lo) }
			continue
		}

		$info = $javaIndex[$cp]
		$imgPath = [string]$info.ImagePath
		if (-not $loaded.ContainsKey($imgPath)) {
			$loaded[$imgPath] = Get-PngImage $imgPath
		}
		$srcBmp = $loaded[$imgPath]

		$tileW = [int]$info.TileW
		$tileH = [int]$info.TileH
		$srcX = [int]$info.Col * $tileW
		$srcY = [int]$info.Row * $tileH
		$srcRect = New-Object System.Drawing.Rectangle($srcX, $srcY, $tileW, $tileH)

		$scale = if ($tileW -eq 8 -and $tileH -eq 8) { 1 } else { [Math]::Min($TARGET_BOX / $tileW, $TARGET_BOX / $tileH) }
		$dstW = [int][Math]::Round($tileW * $scale)
		$dstH = [int][Math]::Round($tileH * $scale)
		if ($dstW -gt $TARGET_BOX) { $dstW = $TARGET_BOX }
		if ($dstH -gt $TARGET_BOX) { $dstH = $TARGET_BOX }
		if ($dstW -lt 1) { $dstW = 1 }
		if ($dstH -lt 1) { $dstH = 1 }

		$offX = [int][Math]::Floor((16 - $dstW) / 2)
		$offY = [int][Math]::Max(0, [Math]::Floor((16 - $dstH) / 2) - 1)
		$dstRect = New-Object System.Drawing.Rectangle([int]($baseX + $offX), [int]($baseY + $offY), [int]$dstW, [int]$dstH)

		$g.DrawImage($srcBmp, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
		$imported++
	}
} finally {
	if ($transparentBrush) { $transparentBrush.Dispose() }
	$g.Dispose()
	foreach ($bmp in $loaded.Values) { $bmp.Dispose() }
}

# Fill missing cells with manual fallbacks (only if that cell is defined).
foreach ($m in $missing) {
	$hex = [string]$m.pua
	if (-not $hex.StartsWith("E3")) { continue }
	$lo = $hex.Substring(2, 2).ToUpper()
	if (-not $manual.ContainsKey($lo)) { continue }
	$dstLo = [Convert]::ToInt32($lo, 16)
	$dstCol = [int]($dstLo -band 0x0F)
	$dstRow = [int](($dstLo -shr 4) -band 0x0F)
	Draw-Manual8x8Centered -bmp $dest -cellCol $dstCol -cellRow $dstRow -pattern $manual[$lo]
	$manualDrawn++
}

# Fill missing fixed cells with manual fallbacks.
foreach ($m in $fixedMissing) {
	$hex = [string]$m.pua
	if (-not $hex.StartsWith("E3")) { continue }
	$lo = $hex.Substring(2, 2).ToUpper()
	if (-not $manual.ContainsKey($lo)) { continue }
	$rc = CellLoToRowCol $lo
	Draw-Manual8x8Centered -bmp $dest -cellCol $rc.Col -cellRow $rc.Row -pattern $manual[$lo]
	$manualDrawn++
}

# Integrity: ensure fixed cells are available (either imported or manual).
$unfilledFixed = @()
foreach ($m in $fixedMissing) {
	$hex = [string]$m.pua
	$lo = $hex.Substring(2, 2).ToUpper()
	if (-not $manual.ContainsKey($lo)) { $unfilledFixed += $m }
}
if ($unfilledFixed.Count -gt 0) {
	$sample = ($unfilledFixed | Select-Object -First 10 | ForEach-Object { "$($_.token)->$($_.pua)" }) -join ", "
	throw "Unfilled fixed glyphs (no manual fallback): $($unfilledFixed.Count). Sample: $sample"
}

# Integrity: ensure every missing target has a manual fallback (otherwise the cell would remain blank).
$unfilled = @()
foreach ($m in $missing) {
	$hex = [string]$m.pua
	if (-not $hex.StartsWith("E3")) { continue }
	$lo = $hex.Substring(2, 2).ToUpper()
	if (-not $manual.ContainsKey($lo)) {
		$unfilled += $m
	}
}
if ($unfilled.Count -gt 0) {
	$sample = ($unfilled | Select-Object -First 10 | ForEach-Object { "$($_.token)->$($_.pua)" }) -join ", "
	throw "Unfilled missing glyphs (no manual fallback): $($unfilled.Count). Sample: $sample"
}

# Quantize to white-only
Quantize-WhiteOnly -bmp $dest

# Save atomically
$tmp = "$OutGlyphPath.tmp.png"
$dest.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png)
$dest.Dispose()
Move-Item -LiteralPath $tmp -Destination $OutGlyphPath -Force

$reportPath = "c:\Users\anthe\Desktop\Desarrollo\tools\custom-emojis\render-report.json"
[PSCustomObject]@{
	generatedAt = (Get-Date).ToString("o")
	examplesDir = $ExamplesDir
	javaFontJson = $JavaFontJson
	outGlyph = $OutGlyphPath
	importedCount = $imported
	manualDrawnCount = $manualDrawn
	missingCount = $missing.Count
	missing = $missing
} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $reportPath -Encoding UTF8

Write-Host "Imported: $imported"
Write-Host "Missing:  $($missing.Count)"
Write-Host "Wrote: $OutGlyphPath"
Write-Host "Report: $reportPath"
