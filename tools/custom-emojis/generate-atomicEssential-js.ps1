param(
	[string]$MappingE3Path = "c:\Users\anthe\Desktop\Desarrollo\RP\font\mapping.atomic-essential.json",
	[string]$MappingE4Path = "c:\Users\anthe\Desktop\Desarrollo\RP\font\mapping.atomic-e4.json",
	[string]$OutJsPath = "c:\Users\anthe\Desktop\Desarrollo\Atomic BP\scripts\features\custom-emojis\packs\atomicEssential.js"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (!(Test-Path -LiteralPath $MappingE3Path)) { throw "MappingE3 not found: $MappingE3Path" }
if (!(Test-Path -LiteralPath $MappingE4Path)) { throw "MappingE4 not found: $MappingE4Path" }

$e3 = Get-Content -LiteralPath $MappingE3Path -Raw -Encoding UTF8 | ConvertFrom-Json
$e4 = Get-Content -LiteralPath $MappingE4Path -Raw -Encoding UTF8 | ConvertFrom-Json

if (-not $e3.customMap) { throw "E3 mapping missing customMap" }
if (-not $e4.customMap) { throw "E4 mapping missing customMap" }

function ToIntHex([string]$hex) { [Convert]::ToInt32($hex, 16) }

# Vanilla emoji overrides: these should NOT use custom glyph sheets.
# We map them directly to Bedrock's built-in emoji PUA.
# IMPORTANT: build keys from codepoints to avoid encoding issues on Windows PowerShell.
$vanillaOverrides = [ordered]@{
	([string]([char]0x2605)) = "E107" # ★ solid_star
	([string]([char]0x2606)) = "E106" # ☆ hollow_star
	([string]([char]0x2764)) = "E10C" # ❤ heart
}

$items = @()

function HasToken($map, [string]$tok) {
	if (-not $map) { return $false }
	# customMap is a PSCustomObject; its keys are Properties.
	return @($map.PSObject.Properties.Name) -contains $tok
}

# 1) Add vanilla overrides only when the token is NOT present in mappings.
# This allows the RP mapping to intentionally override these symbols without us fighting it.
foreach ($k in $vanillaOverrides.Keys) {
	$tok = [string]$k
	$presentInE3 = HasToken $e3.customMap $tok
	$presentInE4 = HasToken $e4.customMap $tok
	if ($presentInE3 -or $presentInE4) { continue }
	$items += [PSCustomObject]@{ token=$tok; pua=([string]$vanillaOverrides[$k]).ToUpper() }
}

# 2) Add E3 mappings
$seenTokens = New-Object System.Collections.Generic.HashSet[string]
foreach ($p in $e3.customMap.PSObject.Properties) {
	$tok = [string]$p.Name
	$items += [PSCustomObject]@{ token=$tok; pua=([string]$p.Value).ToUpper() }
	$seenTokens.Add($tok) | Out-Null
}

# 3) Add E4 mappings only if token not already in E3
foreach ($p in $e4.customMap.PSObject.Properties) {
	$tok = [string]$p.Name
	if ($seenTokens.Contains($tok)) { continue }
	$items += [PSCustomObject]@{ token=$tok; pua=([string]$p.Value).ToUpper() }
}

# Sort by PUA then token for stability.
$items = $items | Sort-Object -Property @{Expression={ ToIntHex $_.pua }}, @{Expression={ $_.token }}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("// Auto-generado desde RP/font/mapping.atomic-essential.json + mapping.atomic-e4.json")
$lines.Add("// NO edites este archivo a mano; regenera con tools/custom-emojis/generate-atomicEssential-js.ps1")
$lines.Add("")
$lines.Add("function cp(hex) {")
$lines.Add("`treturn String.fromCodePoint(parseInt(hex, 16));")
$lines.Add("}")
$lines.Add("")
$lines.Add("export const atomicEssentialMap = new Map([")

foreach ($it in $items) {
	$tok = $it.token.Replace("\\", "\\\\").Replace('"', '\\"')
	$hex = $it.pua
	$lines.Add("`t[" + '"' + $tok + '"' + ", cp(" + '"' + $hex + '"' + ")],")
}

$lines.Add("]);")
$txt = ($lines -join "`r`n") + "`r`n"

$dir = Split-Path -Parent $OutJsPath
if (!(Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }

Set-Content -LiteralPath $OutJsPath -Value $txt -Encoding UTF8
Write-Host "WROTE: $OutJsPath"
Write-Host ("entries={0}" -f @($items).Count)
