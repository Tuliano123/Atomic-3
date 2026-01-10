param(
	[string]$BeforeReport,
	[string]$AfterReport
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($BeforeReport) -or !(Test-Path -LiteralPath $BeforeReport)) {
	throw "BeforeReport not found: $BeforeReport"
}
if ([string]::IsNullOrWhiteSpace($AfterReport) -or !(Test-Path -LiteralPath $AfterReport)) {
	throw "AfterReport not found: $AfterReport"
}

$b = Get-Content -LiteralPath $BeforeReport -Raw -Encoding UTF8 | ConvertFrom-Json
$a = Get-Content -LiteralPath $AfterReport -Raw -Encoding UTF8 | ConvertFrom-Json

function ToSet($arr) {
	$s = New-Object System.Collections.Generic.HashSet[string]
	foreach ($x in @($arr)) { [void]$s.Add(([string]$x).ToUpper()) }
	return $s
}

$bBlank = ToSet $b.blankCells
$bUnshaded = ToSet $b.unshadedCells
$bShaded = ToSet $b.shadedCells
$aBlank = ToSet $a.blankCells
$aUnshaded = ToSet $a.unshadedCells
$aShaded = ToSet $a.shadedCells

$all = New-Object System.Collections.Generic.HashSet[string]
foreach ($x in @($bBlank) + @($bUnshaded) + @($bShaded) + @($aBlank) + @($aUnshaded) + @($aShaded)) { [void]$all.Add($x) }

function Category($lo, $blank, $unshaded, $shaded) {
	if ($blank.Contains($lo)) { return 'blank' }
	if ($shaded.Contains($lo)) { return 'shaded' }
	if ($unshaded.Contains($lo)) { return 'unshaded' }
	return 'unknown'
}

$changes = @()
foreach ($lo in @($all) | Sort-Object) {
	$from = Category $lo $bBlank $bUnshaded $bShaded
	$to = Category $lo $aBlank $aUnshaded $aShaded
	if ($from -ne $to) {
		$changes += [PSCustomObject]@{ cellLo = $lo; from = $from; to = $to }
	}
}

Write-Host ("Changed cells: {0}" -f @($changes).Count)
if (@($changes).Count -gt 0) {
	$changes | Sort-Object cellLo | Format-Table -AutoSize | Out-String | Write-Host
}
