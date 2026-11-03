$ErrorActionPreference = 'Stop'
# Two vocabularies are declared in more than one place, and until this script existed nothing
# compared the declarations: the equality was a sentence in a comment, and a sentence in a comment
# is not a check. It lives in tools/ and not in schemas/ on purpose - a ruler kept inside the thing
# it measures agrees with itself.
#
# CHANGE KINDS - three declarations of one list, compared pairwise:
#   schemas/json/plan-diff.schema.json
#     x-subtractive-change-kinds                              (subtractive six, declared once)
#     $defs.change.properties.kind.enum                       (all twelve)
#     $defs.change.allOf[0].then.properties.kind.enum         (subtractive six, enforced by if/then)
#   schemas/sql/schema.sql
#     plan_diff_changes.change_kind CHECK                     (all twelve)
#     constraint changes_are_subtractive_or_not_safety        (subtractive six)
#
# TIERS - one list, four declarations, compared pairwise:
#   knowledge/heuristics/*.yaml                               severity: values (131 lines today)
#   schemas/sql/schema.sql  reviews.severity CHECK            (a review's tier)
#   schemas/sql/schema.sql  safety_events.tier CHECK          (the stop's tier)
#   schemas/json/plan-version.schema.json $defs.appliedRule.properties.severity.enum
# and one subset that is deliberate: a safety-origin rule may be constraint or hard-stop, never
# advisory, because a safety rule that only advises is not a safety rule.
#
# THE DAY ENTRY - three axes, one declaration each, compared against its column CHECK:
#   outcome / sessionTaken / outcomeDetail in schemas/json/day-entry.schema.json
#   day_entries.outcome / session_taken / outcome_detail CHECKs in schemas/sql/schema.sql
# The null in the wire's two nullable enums is not a value a column can hold, so it is stripped
# before comparing: nullability lives in `required`, not in the value set.
#
# Reading the SQL text rather than the live catalog is a deliberate split of duties: the `ddl` job
# proves schema.sql loads and that the constraints exist, this script proves the files say the same
# thing, and neither claim pretends to be the other. If a constraint is renamed, this script fails
# loudly rather than silently comparing nothing - a gate that cannot tell "equal" from "not found"
# is not a gate.

$root = Split-Path -Parent $PSScriptRoot
$diffJson = Join-Path $root 'schemas/json/plan-diff.schema.json'
$versionJson = Join-Path $root 'schemas/json/plan-version.schema.json'
$dayJson = Join-Path $root 'schemas/json/day-entry.schema.json'
$sqlPath = Join-Path $root 'schemas/sql/schema.sql'
$heurDir = Join-Path $root 'knowledge/heuristics'
foreach ($p in @($diffJson, $versionJson, $dayJson, $sqlPath, $heurDir)) {
  if (-not (Test-Path -LiteralPath $p)) { throw "not found: $p (run this from a checkout of the repository)" }
}

$diff = Get-Content -Raw -LiteralPath $diffJson | ConvertFrom-Json
$version = Get-Content -Raw -LiteralPath $versionJson | ConvertFrom-Json
$day = Get-Content -Raw -LiteralPath $dayJson | ConvertFrom-Json
$sql = Get-Content -Raw -LiteralPath $sqlPath

function Get-QuotedList {
  param([string]$Text, [string]$Pattern, [string]$Label)
  $m = [regex]::Match($Text, $Pattern)
  if (-not $m.Success) {
    throw "could not find $Label in schemas/sql/schema.sql - renamed or reworded? Fix this script's pattern in the same commit that moves it."
  }
  @([regex]::Matches($m.Groups['list'].Value, "'([^']+)'") | ForEach-Object { $_.Groups[1].Value })
}

function Compare-Sets {
  param([string[]]$A, [string[]]$B)
  $onlyA = @($A | Where-Object { $B -notcontains $_ })
  $onlyB = @($B | Where-Object { $A -notcontains $_ })
  [pscustomobject]@{
    Ok    = ($onlyA.Count -eq 0 -and $onlyB.Count -eq 0)
    OnlyA = $onlyA
    OnlyB = $onlyB
    Count = $A.Count
  }
}

function Test-Subset {
  param([string[]]$Sub, [string[]]$Super)
  $extra = @($Sub | Where-Object { $Super -notcontains $_ })
  [pscustomobject]@{
    Ok    = ($extra.Count -eq 0)
    OnlyA = $extra
    OnlyB = @()
    Count = $Sub.Count
  }
}

# ---------------------------------------------------------------- change kinds
$wireAll = @($diff.'$defs'.change.properties.kind.enum)
$wireSub = @($diff.'$defs'.change.allOf[0].then.properties.kind.enum)
$declaredSub = @($diff.'x-subtractive-change-kinds')
$ddlAll = @(Get-QuotedList -Text $sql -Label 'the plan_diff_changes.change_kind CHECK' `
    -Pattern "change_kind\s+text\s+not\s+null\s+check\s*\(\s*change_kind\s+in\s*\((?<list>[^)]*)\)")
$ddlSub = @(Get-QuotedList -Text $sql -Label 'constraint changes_are_subtractive_or_not_safety' `
    -Pattern "constraint\s+changes_are_subtractive_or_not_safety\s+check\s*\(\s*not\s+is_safety\s+or\s+change_kind\s+in\s*\((?<list>[^)]*)\)")

# ---------------------------------------------------------------------- tiers
$knowledgeTiers = @(
  Get-ChildItem -LiteralPath $heurDir -Filter *.yaml -File |
    ForEach-Object { Get-Content -LiteralPath $_.FullName } |
    ForEach-Object { if ($_ -match '^\s*severity:\s*(\S+)\s*$') { $Matches[1] } } |
    Sort-Object -Unique
)
$ddlReviewTiers = @(Get-QuotedList -Text $sql -Label 'the reviews.severity CHECK' `
    -Pattern "severity\s+text\s+not\s+null\s+check\s*\(\s*severity\s+in\s*\((?<list>[^)]*)\)")
$ddlEventTiers = @(Get-QuotedList -Text $sql -Label 'the safety_events.tier CHECK' `
    -Pattern "tier\s+text\s+not\s+null\s+check\s*\(\s*tier\s+in\s*\((?<list>[^)]*)\)")
$wireTiers = @($version.'$defs'.appliedRule.properties.severity.enum)
$wireSafetyTiers = @($version.'$defs'.appliedRule.allOf[0].then.properties.severity.enum)

# ---------------------------------------------------------------- the day entry
$wireOutcome = @($day.properties.outcome.enum)
$wireTaken = @($day.properties.sessionTaken.enum | Where-Object { $null -ne $_ })
$wireDetail = @($day.properties.outcomeDetail.enum | Where-Object { $null -ne $_ })
$ddlOutcome = @(Get-QuotedList -Text $sql -Label 'the day_entries.outcome CHECK' `
    -Pattern "outcome\s+text\s+not\s+null\s+check\s*\(\s*outcome\s+in\s*\((?<list>[^)]*)\)")
$ddlTaken = @(Get-QuotedList -Text $sql -Label 'the day_entries.session_taken CHECK' `
    -Pattern "session_taken\s+text\s+check\s*\(\s*session_taken\s+in\s*\((?<list>[^)]*)\)")
$ddlDetail = @(Get-QuotedList -Text $sql -Label 'the day_entries.outcome_detail CHECK' `
    -Pattern "outcome_detail\s+text\s+check\s*\(\s*outcome_detail\s+in\s*\((?<list>[^)]*)\)")

"CHANGE KINDS: wire $($wireAll.Count), ddl $($ddlAll.Count), subtractive declared $($declaredSub.Count)"
"TIERS: knowledge $($knowledgeTiers.Count) values ($($knowledgeTiers -join ', '))"
"DAY ENTRY: outcome $($wireOutcome.Count), sessionTaken $($wireTaken.Count), outcomeDetail $($wireDetail.Count)"
''

$checks = @(
  [pscustomobject]@{ Name = 'change kinds: DDL change_kind CHECK == wire kind enum'; A = $ddlAll; B = $wireAll; Kind = 'eq' },
  [pscustomobject]@{ Name = 'change kinds: x-subtractive-change-kinds == wire if/then enum'; A = $declaredSub; B = $wireSub; Kind = 'eq' },
  [pscustomobject]@{ Name = 'change kinds: x-subtractive-change-kinds == DDL subtractive CHECK'; A = $declaredSub; B = $ddlSub; Kind = 'eq' },
  [pscustomobject]@{ Name = 'tiers: knowledge severity values == DDL reviews.severity CHECK'; A = $knowledgeTiers; B = $ddlReviewTiers; Kind = 'eq' },
  [pscustomobject]@{ Name = 'tiers: knowledge severity values == DDL safety_events.tier CHECK'; A = $knowledgeTiers; B = $ddlEventTiers; Kind = 'eq' },
  [pscustomobject]@{ Name = 'tiers: knowledge severity values == wire appliedRule severity enum'; A = $knowledgeTiers; B = $wireTiers; Kind = 'eq' },
  [pscustomobject]@{ Name = 'tiers: safety-origin then enum is a subset (never advisory)'; A = $wireSafetyTiers; B = $wireTiers; Kind = 'subset' },
  [pscustomobject]@{ Name = 'day entry: wire outcome enum == DDL outcome CHECK'; A = $wireOutcome; B = $ddlOutcome; Kind = 'eq' },
  [pscustomobject]@{ Name = 'day entry: wire sessionTaken enum == DDL session_taken CHECK'; A = $wireTaken; B = $ddlTaken; Kind = 'eq' },
  [pscustomobject]@{ Name = 'day entry: wire outcomeDetail enum == DDL outcome_detail CHECK'; A = $wireDetail; B = $ddlDetail; Kind = 'eq' }
)

$ok = $true
foreach ($c in $checks) {
  $r = if ($c.Kind -eq 'subset') { Test-Subset -Sub $c.A -Super $c.B } else { Compare-Sets -A $c.A -B $c.B }
  if ($r.Ok) {
    "  OK   $($c.Name) ($($r.Count) values)"
  }
  else {
    $ok = $false
    "  FAIL $($c.Name)"
    if ($r.OnlyA.Count) { "         only in the left list:  $($r.OnlyA -join ', ')" }
    if ($r.OnlyB.Count) { "         only in the right list: $($r.OnlyB -join ', ')" }
  }
}
''
if ($ok) {
  "RESULT: OK - $($checks.Count) comparisons, one change-kind vocabulary, one tier vocabulary, one day-entry set"
  exit 0
}
'RESULT: MISMATCH - the declarations disagree; fix the disagreement, not this script'
exit 1
