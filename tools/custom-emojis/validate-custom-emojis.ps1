param(
	[string]$MappingE3Path = "c:\Users\anthe\Desktop\Desarrollo\RP\font\mapping.atomic-essential.json",
	[string]$MappingE4Path = "c:\Users\anthe\Desktop\Desarrollo\RP\font\mapping.atomic-e4.json",
	[string]$ShortcodesJsPath = "c:\Users\anthe\Desktop\Desarrollo\Atomic BP\scripts\features\custom-emojis\shortcodes.js",
	[string]$GeneratedPackPath = "c:\Users\anthe\Desktop\Desarrollo\Atomic BP\scripts\features\custom-emojis\packs\atomicEssential.js"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function LoadJson([string]$path) {
	if (!(Test-Path -LiteralPath $path)) { throw "Missing: $path" }
	return (Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json)
}

$e3 = LoadJson $MappingE3Path
$e4 = LoadJson $MappingE4Path

if (-not $e3.customMap) { throw "E3 missing customMap" }
if (-not $e4.customMap) { throw "E4 missing customMap" }

$e3Tokens = @($e3.customMap.PSObject.Properties | ForEach-Object { [string]$_.Name })
$e4Tokens = @($e4.customMap.PSObject.Properties | ForEach-Object { [string]$_.Name })

# Duplicates between E3 and E4
$e3Set = New-Object System.Collections.Generic.HashSet[string]
foreach ($t in $e3Tokens) { $e3Set.Add($t) | Out-Null }
$dups = @()
foreach ($t in $e4Tokens) { if ($e3Set.Contains($t)) { $dups += $t } }

# Parse shortcodes.js pairs: [":code:", "SYMBOL"]
if (!(Test-Path -LiteralPath $ShortcodesJsPath)) { throw "Missing: $ShortcodesJsPath" }
$scText = Get-Content -LiteralPath $ShortcodesJsPath -Raw -Encoding UTF8
$pairRx = [regex]'\[\s*"(?<code>[^\"]+)"\s*,\s*"(?<sym>[^\"]+)"\s*\]'
$scPairs = @()
foreach ($m in $pairRx.Matches($scText)) {
	$scPairs += [pscustomobject]@{ code=$m.Groups['code'].Value; symbol=$m.Groups['sym'].Value }
}

# Build set of tokens that should be supported by replacement (E3+E4 + vanilla overrides in generated pack).
$packText = Get-Content -LiteralPath $GeneratedPackPath -Raw -Encoding UTF8
$tokRx = [regex]'\[\s*"(?<tok>[^\"]+)"\s*,\s*cp\("(?<hex>[0-9A-Fa-f]{3,4})"\)\s*\]'
$packTokens = New-Object System.Collections.Generic.HashSet[string]
foreach ($m in $tokRx.Matches($packText)) {
	$packTokens.Add($m.Groups['tok'].Value) | Out-Null
}

# Ensure RP mapping tokens are actually present in the generated pack.
$expectedTokens = @($e3Tokens + $e4Tokens | Sort-Object -Unique)
$missingInPack = @()
foreach ($t in $expectedTokens) {
	if (-not $packTokens.Contains([string]$t)) {
		$missingInPack += [string]$t
	}
}

$badShortcodeKeys = @()
$missingShortcodeSymbols = @()
foreach ($p in $scPairs) {
	if (-not $p.code.StartsWith(':') -or -not $p.code.EndsWith(':')) {
		$badShortcodeKeys += $p.code
	}
	if (-not $packTokens.Contains($p.symbol)) {
		$missingShortcodeSymbols += $p.symbol
	}
}

[pscustomobject]@{
	e3Count = $e3Tokens.Count
	e4Count = $e4Tokens.Count
	dupE3E4Count = $dups.Count
	dupE3E4 = ($dups | Sort-Object -Unique)
	shortcodesCount = $scPairs.Count
	badShortcodeKeysCount = $badShortcodeKeys.Count
	badShortcodeKeys = ($badShortcodeKeys | Sort-Object -Unique)
	missingShortcodeSymbolsCount = $missingShortcodeSymbols.Count
	missingShortcodeSymbols = ($missingShortcodeSymbols | Sort-Object -Unique)
	missingMappingTokensInPackCount = $missingInPack.Count
	missingMappingTokensInPack = ($missingInPack | Sort-Object -Unique)
} | Format-List | Out-String
