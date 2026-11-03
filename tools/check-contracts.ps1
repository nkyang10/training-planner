# Contract shape audit for schemas/json/*.schema.json.
#
# Why this exists: schemas/README.md states rules in prose ("every field is documented", "units are
# explicit"), and prose rules rot. Two of the five contracts had already drifted into a second naming
# convention, which is precisely the divergence the README warns about -- two teams reading the same
# shape differently. This script turns the enforceable half of those rules into a build gate.
#
# What it checks (hard failures):
#   - the file parses as strict UTF-8 JSON;
#   - root metadata: $schema (draft 2020-12), $id pointing at this file, title, description,
#     type: object, additionalProperties: false;
#   - property names are camelCase and enum values are kebab-case, because these are wire contracts
#     consumed by TypeScript while SQL columns stay snake_case. The mapping is codegen's job, not
#     each caller's, and a value copied from another namespace must declare itself as such;
#   - every property is documented (a description, or a $ref that inherits one), up to a ratchet
#     budget that may go down and must never go up. Properties named inside if/then/else are
#     conditions on fields documented at their declaration, so they are casing-checked but not
#     required to repeat a description that would only drift from the original.
#
# What it deliberately does not check: whether a description is *true*. That is a reviewer's job,
# and a fake description that satisfies a script is the failure mode to watch for here.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$schemaDir = Join-Path $root 'schemas\json'

# Ratchet: undocumented properties inherited from the pre-gate contracts (116 of 226 on 2026-11-03).
# Lower it as they are documented; raising it is a deliberate act that should show up in a diff
# review. New files are expected to arrive documented -- events.schema.json did -- so the practical
# budget for new work is zero.
$UndocumentedBudget = 116

$CasePattern = '^[a-z][A-Za-z0-9]*$'
$IdBase = 'https://training-planner.local/schemas/json/'

$script:Cases = @()
$script:Enums = @()
$script:Meta = @()
$script:Ids = @()
$script:Undoc = @()
$script:Parses = @()
$script:PropCount = 0
$filesChecked = 0

function Walk-Node {
    param($Node, [string]$Path, [string]$File, [bool]$Predicate = $false)

    if ($Node -isnot [Management.Automation.PSCustomObject]) { return }

    # 0. enum values: wire values are kebab-case. An underscore means either a snake_case leak or an
    #    identifier copied from another namespace (a heuristic anchor, a metric id). The second case
    #    is legal but has to declare itself, so the exception is visible in the contract itself.
    $enumSlot = $Node.PSObject.Properties['enum']
    if ($null -ne $enumSlot) {
        $verbatim = ($null -ne $Node.PSObject.Properties['x-verbatim-enum-values']) -and ($Node.'x-verbatim-enum-values' -eq $true)
        $values = @()
        if ($enumSlot.Value -is [Object[]]) { $values = $enumSlot.Value } else { $values = @($enumSlot.Value) }
        foreach ($v in $values) {
            if (($v -is [string]) -and ($v -match '_') -and (-not $verbatim)) {
                $script:Enums += "$File  $Path/enum = $v  (kebab-case, or declare x-verbatim-enum-values)"
            }
        }
    }

    # 1. properties: the map keys are real field names, so they are real contract surface. Inside an
    #    if/then/else the same keys appear again as *conditions* on fields declared elsewhere; asking
    #    for a second description there produces a paragraph that only drifts from the first. Casing is
    #    still enforced, and additionalProperties: false at the root is what keeps this exemption from
    #    becoming a hole through which an undocumented field could hide.
    $props = $Node.PSObject.Properties['properties']
    if ($null -ne $props -and $props.Value -is [Management.Automation.PSCustomObject]) {
        foreach ($child in $props.Value.PSObject.Properties) {
            $childPath = "$Path/$($child.Name)"
            if ($child.Name -notmatch $CasePattern) {
                $script:Cases += "$File  $childPath  (property names are camelCase; SQL keeps snake_case)"
            }
            if (-not $Predicate) {
                $script:PropCount++
                $documented = $false
                if ($child.Value -is [Management.Automation.PSCustomObject]) {
                    $d = $child.Value.PSObject.Properties['description']
                    if ($null -ne $d -and "$($d.Value)".Trim().Length -gt 0) { $documented = $true }
                    if (-not $documented -and $null -ne $child.Value.PSObject.Properties['$ref']) { $documented = $true }
                }
                if (-not $documented) { $script:Undoc += "$File  $childPath" }
            }
            Walk-Node -Node $child.Value -Path $childPath -File $File -Predicate $Predicate
        }
    }

    # 2. Named definitions: recurse, and keep their names underscore-free too.
    foreach ($kw in '$defs', 'definitions') {
        $defs = $Node.PSObject.Properties[$kw]
        if ($null -ne $defs -and $defs.Value -is [Management.Automation.PSCustomObject]) {
            foreach ($child in $defs.Value.PSObject.Properties) {
                if ($child.Name -match '_') {
                    $script:Cases += "$File  $Path/${kw}/$($child.Name)  (definition name contains an underscore)"
                }
                Walk-Node -Node $child.Value -Path "$Path/$kw/$($child.Name)" -File $File
            }
        }
    }

    # 3. Subschema slots that hold one schema, or a tuple of schemas. if/then/else introduce the
    #    predicate context described in section 1; everything below them inherits it.
    foreach ($kw in 'items', 'additionalItems', 'contains', 'if', 'then', 'else', 'not', 'propertyNames', 'additionalProperties') {
        $slot = $Node.PSObject.Properties[$kw]
        if ($null -eq $slot) { continue }
        $pred = $Predicate
        if ('if', 'then', 'else' -contains $kw) { $pred = $true }
        if ($slot.Value -is [Management.Automation.PSCustomObject]) {
            Walk-Node -Node $slot.Value -Path "$Path/$kw" -File $File -Predicate $pred
        } elseif ($slot.Value -is [Object[]]) {
            for ($i = 0; $i -lt $slot.Value.Count; $i++) {
                Walk-Node -Node $slot.Value[$i] -Path "$Path/$kw[$i]" -File $File -Predicate $pred
            }
        }
    }

    # 4. Combinators and tuples.
    foreach ($kw in 'allOf', 'anyOf', 'oneOf', 'prefixItems') {
        $slot = $Node.PSObject.Properties[$kw]
        if ($null -eq $slot -or $slot.Value -isnot [Object[]]) { continue }
        for ($i = 0; $i -lt $slot.Value.Count; $i++) {
            Walk-Node -Node $slot.Value[$i] -Path "$Path/$kw[$i]" -File $File
        }
    }

    # 5. patternProperties: keys are regular expressions, so no casing rule -- but the value schemas
    #    are still walked, otherwise a payload map becomes an undocumented hole.
    $pp = $Node.PSObject.Properties['patternProperties']
    if ($null -ne $pp -and $pp.Value -is [Management.Automation.PSCustomObject]) {
        foreach ($child in $pp.Value.PSObject.Properties) {
            Walk-Node -Node $child.Value -Path "$Path/patternProperties/$($child.Name)" -File $File
        }
    }
}

if (-not (Test-Path -LiteralPath $schemaDir)) {
    "SCHEMA FILES CHECKED: 0"
    "PARSE FAILURES: 1"
    "check-contracts: $schemaDir does not exist"
    "RESULT: FAIL"
    exit 1
}

foreach ($file in (Get-ChildItem -LiteralPath $schemaDir -Filter '*.json' -File | Sort-Object Name)) {
    $filesChecked++
    $rel = 'schemas/json/' + $file.Name

    $text = $null
    try {
        $strict = New-Object System.Text.UTF8Encoding($false, $true)
        $text = $strict.GetString([System.IO.File]::ReadAllBytes($file.FullName))
    } catch {
        $script:Parses += "$rel  not valid UTF-8: $($_.Exception.Message)"
        continue
    }

    $doc = $null
    try {
        $doc = $text | ConvertFrom-Json
    } catch {
        $script:Parses += "$rel  does not parse: $($_.Exception.Message)"
        continue
    }

    # Root metadata: a contract that cannot say who it is cannot be resolved by another contract.
    $missing = @()
    if ("$($doc.'$schema')" -ne 'https://json-schema.org/draft/2020-12/schema') { $missing += '$schema must be draft 2020-12' }
    if ("$($doc.title)".Trim().Length -eq 0) { $missing += 'title' }
    if ("$($doc.description)".Trim().Length -eq 0) { $missing += 'description (what the shape is for, not what its fields are)' }
    if ("$($doc.type)" -ne 'object') { $missing += 'type: object' }
    if ($doc.PSObject.Properties['additionalProperties'] -eq $null -or $doc.additionalProperties -ne $false) {
        $missing += 'additionalProperties: false (an open object silently accepts fields nothing validates)'
    }
    if ($missing.Count -gt 0) { $script:Meta += "$rel  missing " + ($missing -join '; ') }

    $idText = "$($doc.'$id')"
    if ($idText -ne ($IdBase + $file.Name)) {
        $script:Ids += "$rel  `$id is '$idText', expected '$($IdBase)$($file.Name)'"
    }

    Walk-Node -Node $doc -Path '' -File $rel
}

"SCHEMA FILES CHECKED: $filesChecked"
"PROPERTIES CHECKED: $($script:PropCount)"
"PARSE FAILURES: $($script:Parses.Count)"
"MISSING METADATA: $($script:Meta.Count)"
"BAD ID PATHS: $($script:Ids.Count)"
"SNAKE_CASE PROPERTIES: $($script:Cases.Count)"
"SNAKE_CASE ENUM VALUES: $($script:Enums.Count)"
"UNDOCUMENTED PROPERTIES: $($script:Undoc.Count)"
"UNDOCUMENTED BUDGET: $UndocumentedBudget"

foreach ($group in @($script:Parses, $script:Meta, $script:Ids, $script:Cases, $script:Enums)) {
    foreach ($line in $group) { "  ! $line" }
}
if ($script:Undoc.Count -gt 0) {
    "  - undocumented (ratchet, not yet a failure):"
    foreach ($line in $script:Undoc) { "      $line" }
}

$fail = 0
if ($script:Parses.Count -gt 0) { $fail = 1 }
if ($script:Meta.Count -gt 0) { $fail = 1 }
if ($script:Ids.Count -gt 0) { $fail = 1 }
if ($script:Cases.Count -gt 0) { $fail = 1 }
if ($script:Enums.Count -gt 0) { $fail = 1 }
if ($script:Undoc.Count -gt $UndocumentedBudget) {
    $fail = 1
    "  ! undocumented properties grew past the budget: document the new field, do not raise the budget"
}

if ($fail -eq 0) { 'RESULT: OK' ; exit 0 }
'RESULT: FAIL'
exit 1
