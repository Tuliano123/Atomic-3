param(
	[string]$AnalyzeReportPath,
	[string]$AtomicE3MappingPath = "c:\Users\anthe\Desktop\Desarrollo\RP\font\mapping.atomic-essential.json",
	[string]$AtomicE4MappingPath = "c:\Users\anthe\Desktop\Desarrollo\RP\font\mapping.atomic-e4.json",
	[string]$AtomicEssentialJsPath = "c:\Users\anthe\Desktop\Desarrollo\Atomic BP\scripts\features\custom-emojis\packs\atomicEssential.js",
	[switch]$Apply
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($AnalyzeReportPath) -or !(Test-Path -LiteralPath $AnalyzeReportPath)) {
	throw "AnalyzeReportPath not found: $AnalyzeReportPath"
}
if (!(Test-Path -LiteralPath $AtomicE3MappingPath)) { throw "E3 mapping not found: $AtomicE3MappingPath" }
if (!(Test-Path -LiteralPath $AtomicE4MappingPath)) { throw "E4 mapping not found: $AtomicE4MappingPath" }
if (!(Test-Path -LiteralPath $AtomicEssentialJsPath)) { throw "atomicEssential.js not found: $AtomicEssentialJsPath" }

$report = Get-Content -LiteralPath $AnalyzeReportPath -Raw -Encoding UTF8 | ConvertFrom-Json

function ToSet($arr) {
	$s = New-Object System.Collections.Generic.HashSet[string]
	foreach ($x in @($arr)) { [void]$s.Add(([string]$x).ToUpper()) }
	return $s
}

$blank = ToSet $report.blankCells
$unshaded = ToSet $report.unshadedCells

$e3 = Get-Content -LiteralPath $AtomicE3MappingPath -Raw -Encoding UTF8 | ConvertFrom-Json
$e4 = Get-Content -LiteralPath $AtomicE4MappingPath -Raw -Encoding UTF8 | ConvertFrom-Json

if (-not $e3.customMap) { throw "E3 mapping missing customMap: $AtomicE3MappingPath" }
if (-not $e4.customMap) { throw "E4 mapping missing customMap: $AtomicE4MappingPath" }

# Prepare updated maps
$removed = @()
$moved = @()
$newE3 = [ordered]@{}
$newE4 = [ordered]@{}

# Seed E4 with existing entries
foreach ($p in $e4.customMap.PSObject.Properties) {
	$newE4[$p.Name] = ([string]$p.Value).ToUpper()
}

foreach ($p in $e3.customMap.PSObject.Properties) {
	$token = [string]$p.Name
	$hex = ([string]$p.Value).ToUpper()
	if ($hex -notmatch '^E3[0-9A-F]{2}$') {
		# keep non-E3 entries untouched
		$newE3[$token] = $hex
		continue
	}
	$lo = $hex.Substring(2, 2)
	if ($blank.Contains($lo)) {
		$removed += [PSCustomObject]@{ token = $token; from = $hex; reason = 'blank_cell' }
		continue
	}
	if ($unshaded.Contains($lo)) {
		$to = "E4$lo"
		# Add to E4 map (collision check)
		if ($newE4.Contains($token)) {
			throw "E4 already contains token '$token' (existing=$($newE4[$token]) new=$to)"
		}
		if ($newE4.Values -contains $to) {
			throw "E4 collision: another token already uses $to"
		}
		$newE4[$token] = $to
		$moved += [PSCustomObject]@{ token = $token; from = $hex; to = $to; reason = 'unshaded_move_to_E4' }
		continue
	}
	# shaded (or unknown) stays in E3
	$newE3[$token] = $hex
}

function SortMapByPua([hashtable]$map) {
	$items = foreach ($k in $map.Keys) {
		[PSCustomObject]@{ token = $k; pua = [string]$map[$k] }
	}
	$sorted = $items | Sort-Object -Property @{Expression = { [Convert]::ToInt32($_.pua, 16) } }, @{Expression = { $_.token } }
	$out = [ordered]@{}
	foreach ($it in $sorted) { $out[$it.token] = $it.pua }
	return $out
}

$sortedE3 = SortMapByPua $newE3
$sortedE4 = SortMapByPua $newE4

Write-Host ("Will remove: {0}" -f @($removed).Count)
Write-Host ("Will move to E4: {0}" -f @($moved).Count)

if (-not $Apply) {
	Write-Host "(dry-run) No files written. Use -Apply to write changes."
	return
}

$e3.customMap = $sortedE3
$e4.customMap = $sortedE4

$e3 | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $AtomicE3MappingPath -Encoding UTF8
$e4 | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $AtomicE4MappingPath -Encoding UTF8

# Update atomicEssential.js: switch cp("E3xx") -> cp("E4xx") for moved tokens, and delete removed tokens.
$js = Get-Content -LiteralPath $AtomicEssentialJsPath -Raw -Encoding UTF8

foreach ($r in $removed) {
	# Remove the entry line for ["token", cp("E3xx")], leaving formatting mostly intact.
	$tokEsc = [Regex]::Escape([string]$r.token)
	$hexEsc = [Regex]::Escape([string]$r.from)
	$pattern = "\r?\n\t\[" + '"' + $tokEsc + '"' + ",\s*cp\(" + '"' + $hexEsc + '"' + "\)\],\s*.*"
	$js = [Regex]::Replace($js, $pattern, "", 1)
}

foreach ($m in $moved) {
	$tokEsc = [Regex]::Escape([string]$m.token)
	$fromEsc = [Regex]::Escape([string]$m.from)
	$toHex = [string]$m.to
	$pattern = "(\[" + '"' + $tokEsc + '"' + ",\s*cp\(" + '"' + ")" + $fromEsc + "(" + '"' + "\)\])"
	$replacement = '$1' + $toHex + '$2'
	$js = [Regex]::Replace($js, $pattern, $replacement)
}

Set-Content -LiteralPath $AtomicEssentialJsPath -Value $js -Encoding UTF8

Write-Host "WROTE: $AtomicE3MappingPath"
Write-Host "WROTE: $AtomicE4MappingPath"
Write-Host "WROTE: $AtomicEssentialJsPath"
