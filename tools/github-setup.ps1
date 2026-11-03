# Creates labels, milestones and `main` branch protection on the GitHub remote.
# Idempotent: existing labels and milestones are skipped, protection is PUT (replace).
#
#   pwsh -File tools/github-setup.ps1 -DryRun
#   pwsh -File tools/github-setup.ps1
#
# Needs: gh authenticated (`gh auth login`) and `git remote add origin` done.

[CmdletBinding()]
param(
    [string]$Repo,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$Failures = @()   # labels/milestones/protection that the API actually refused, counted at the end

function Invoke-Gh {
    # Splatted through $GhArgs, never $Args: `param([string[]]$Args)` binds fine as `$Args` but
    # `@Args` splats the automatic (empty) $args, so every call became a bare `gh` that printed
    # its own help and exited 0. The script then reported 26 labels and 7 milestones created,
    # and none of them existed. A tool that prints OK while doing nothing is worse than one that
    # fails: it convinced us the repository was configured. See Verify-Remote at the end.
    param([string[]]$GhArgs, [string]$Label)
    if ($DryRun) { "DRY  $Label"; return }
    try {
        $out = & gh @GhArgs 2>&1
        if ($LASTEXITCODE -eq 0) { ('OK   ' + $Label) }
        else {
            # gh's first line is `gh: Validation Failed (HTTP 422)`; the reason -- "already exists" --
            # is on the lines under it. Reading only the first line turned every idempotent re-run
            # into 33 false failures while the read-back said the objects were present.
            $msg = (($out | Out-String) -split "`r?`n" | Where-Object { $_.Trim() } | Select-Object -First 3) -join ' / '
            # An existing label or milestone is the expected outcome of a second run, not a failure.
            if ($msg -match 'already (exists|been taken)') { ('SKIP ' + $Label) }
            else { ('FAIL ' + $Label + ' -- ' + $msg); $script:Failures += $Label }
        }
    } catch { ('FAIL ' + $Label + ' -- ' + $_.Exception.Message); $script:Failures += $Label }
}

# A GET that never throws: a missing object is a null, not an exception, because $ErrorActionPreference
# is Stop here and a 404 on a first run is an expected answer, not a crash.
function Get-Json {
    param([string[]]$ApiArgs)
    try {
        $out = & gh @ApiArgs 2>&1
        if ($LASTEXITCODE -ne 0) { return $null }
        return (($out | Out-String) | ConvertFrom-Json)
    } catch { return $null }
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw 'GitHub CLI (gh) not found. Install it and run: gh auth login'
}

if (-not $Repo) {
    $url = $null
    try { $url = (& git remote get-url origin 2>&1 | Out-String).Trim() } catch { $url = $null }
    if (-not $url -or $url -match 'No such remote') {
        throw 'No origin remote yet. Either: gh repo create <owner>/training-planner --source . --remote origin --push --private   or pass -Repo <owner>/training-planner'
    }
    if ($url -match '[:/]([^/]+)/([^/]+?)(\.git)?$') { $Repo = "$($Matches[1])/$($Matches[2])" }
    else { throw "Cannot parse remote url: $url" }
}
"repo: $Repo"

# --- Point the issue-template links at the real owner ------------------------
$cfgPath = Join-Path (Get-Location) '.github/ISSUE_TEMPLATE/config.yml'
if (Test-Path $cfgPath) {
    $owner = ($Repo -split '/')[0]
    $raw = [System.IO.File]::ReadAllText($cfgPath)
    if ($raw -match 'github\.com/OWNER/') {
        $new = $raw -replace 'github\.com/OWNER/', "github.com/$owner/"
        if ($owner -eq 'OWNER') { 'SKIP issue-template links -- pass the real -Repo <owner>/training-planner' }
        elseif ($DryRun) { "DRY  rewrite OWNER -> $owner in .github/ISSUE_TEMPLATE/config.yml" }
        else {
            [System.IO.File]::WriteAllText($cfgPath, $new, (New-Object System.Text.UTF8Encoding($false)))
            'OK   issue-template links now point at the real owner'
        }
    } else { 'OK   issue-template links already owner-specific' }
}

# --- Labels -----------------------------------------------------------------
$labels = [ordered]@{
    'area/client'             = '0e8a16'
    'area/api'                = '0e8a16'
    'area/worker'             = '0e8a16'
    'area/planner-core'       = '1d76db'
    'area/data'               = '5319e7'
    'area/knowledge'          = 'b60200'
    'area/eval'               = 'fbca04'
    'area/infra'              = 'c2e0c6'
    'area/docs'               = 'c2e0c6'
    'type/feature'            = 'a2eeef'
    'type/bug'                = 'd73a4a'
    'type/research'           = 'd4c5f9'
    'risk/safety'             = 'b60200'
    'needs-research'          = 'fef2c0'
    'blocked-on-knowledge'    = 'e9969a'
    'good-first-issue'        = '7057ff'
    'finding/F1'              = '5319e7'
    'finding/F2'              = '5319e7'
    'finding/F3'              = '5319e7'
    'finding/F4'              = '5319e7'
    'finding/F5'              = '5319e7'
    'finding/F6'              = '5319e7'
    'finding/F7'              = '5319e7'
    'finding/F8'              = '5319e7'
    'finding/F9'              = '5319e7'
    'finding/F10'             = '5319e7'
}
# Ask what is already there before creating anything. POSTing into a duplicate returns
# `gh: Validation Failed (HTTP 422)` with the reason (`name already exists`) buried in the body,
# so a second run used to report 26 failures for work that was already done.
$existingLabels = @(@(Get-Json @('api', "repos/$Repo/labels?per_page=100")).name)
foreach ($name in $labels.Keys) {
    if ($existingLabels -contains $name) { "SKIP label $name -- already on the repository"; continue }
    Invoke-Gh @('api','-X', 'POST', "repos/$Repo/labels", '-f', "name=$name", '-f', "color=$($labels[$name])") "label $name"
}

# --- Milestones (titles mirror docs/roadmap/milestones.md) -------------------
$milestones = @('M0 Skeleton and contracts',
               'M1 Headless planner, correctness first',
               'M2 The daily loop, manual-first',
               'M3 Reviews that change the future',
               'M4 Evidence enrichment (import)',
               'M5 Autoregulation and calibration',
               'M6 Multi-tenant hardening and launch')
$existingMs = @(@(Get-Json @('api', "repos/$Repo/milestones?state=all")).title)
foreach ($m in $milestones) {
    if ($existingMs -contains $m) { "SKIP milestone $m -- already on the repository"; continue }
    Invoke-Gh @('api','-X', 'POST', "repos/$Repo/milestones", '-f', "title=$m", '-f', 'state=open') "milestone $m"
}

# --- Branch protection on main ---------------------------------------------
# Squash for leaves, merge commit allowed so spine -> main stays bisectable.
# required_status_checks lists the gate that exists today; 'app' joins at M1.
$protection = [ordered]@{
    required_status_checks = @{
        strict = $true
        contexts = @('knowledge')
    }
    # Off while one person holds every seat: with it on, a solo owner cannot approve their own PR
    # and starts bypassing protections by hand. Flip to $true when a second maintainer appears.
    enforce_admins = $false
    required_pull_request_reviews = @{
        required_approving_review_count = 1
        dismiss_stale_reviews = $true
        require_codeowner_reviews = $true
        require_last_push_approval = $true
    }
    restrictions = $null
    required_linear_history = $false
    allow_force_pushes = $false
    allow_deletions = $false
    block_creations = $true
    required_conversation_resolution = $true
}
$json = $protection | ConvertTo-Json -Depth 6
if ($DryRun) {
    'DRY  branch protection main'
    $json
} else {
    try {
        $out = $json | & gh api -X PUT "repos/$Repo/branches/main/protection" --input - 2>&1
        if ($LASTEXITCODE -eq 0) { 'OK   branch protection main' }
        else {
            'FAIL branch protection -- branch protection needs the token to hold Administration: write.'
            '     Grant it at https://github.com/settings/personal-access-tokens (Repository permissions'
            '     -> Administration -> Read and write), re-run this script, or set the same values under'
            '     Settings -> Branches -> Add branch protection rule. Leaving this unset means a squashed'
            '     leaf can be pushed straight to main, which is the one thing the branch model forbids.'
            $Failures += 'branch protection main'
        }
    } catch { "FAIL branch protection -- $($_.Exception.Message)"; $Failures += 'branch protection main' }
}

# Which merge styles the repository allows: squash for leaves, merge commit for spine -> main,
# no rebase (a rebased spine that is already reviewed elsewhere is a re-review).
# The field names are the API's own. `rebase_merge=false` is not a field: PATCH answered 200 and
# ignored it, and the read-back is what proved the setting had not changed.
Invoke-Gh @('api','-X', 'PATCH', "repos/$Repo",
            '-F', 'allow_squash_merge=true', '-F', 'allow_merge_commit=true',
            '-F', 'allow_rebase_merge=false', '-F', 'delete_branch_on_merge=true') 'repo merge settings'

# What the repository says it is. The wiki is off on purpose: a second copy of the design docs
# drifts, and every document here is citable by path and reviewable in a PR.
Invoke-Gh @('api','-X', 'PATCH', "repos/$Repo",
            '-F', 'description=Evidence-based daily running plans: a deterministic planner, a knowledge base as code, and reviews that only change the future.',
            '-F', 'has_wiki=false') 'repo description and wiki'

$wantTopics = @('running','endurance','training-plan','evidence-based','knowledge-as-code')
# The endpoint replaces the whole list, and its key is `names`, not `topics`: a body that says
# `topics` is refused with `"names" wasn't supplied.` (HTTP 422) rather than quietly ignored.
$topicsJson = (@{ names = $wantTopics } | ConvertTo-Json -Compress)
if ($DryRun) { 'DRY  repo topics' }
else {
    try {
        $out = $topicsJson | & gh api -X PUT "repos/$Repo/topics" --input - 2>&1
        if ($LASTEXITCODE -eq 0) { 'OK   repo topics' }
        else {
            $tmsg = (($out | Out-String) -split "`r?`n" | Where-Object { $_.Trim() } | Select-Object -First 3) -join ' / '
            ('FAIL repo topics -- ' + $tmsg); $Failures += 'repo topics'
        }
    } catch { ('FAIL repo topics -- ' + $_.Exception.Message); $Failures += 'repo topics' }
}

# --- Read the truth back ------------------------------------------------------
# Everything above prints a claim made by the script. This section asks GitHub instead.
# Two reasons it must be a poll and not one read:
#   1. The first real run printed 35 successes and created nothing (the bare-`gh` splat bug).
#      Only a read-back can tell a claim from a fact.
#   2. Repository settings are eventually consistent. Setting allow_rebase_merge=false and reading
#      once came back True; three seconds later the same read said False. A single read can
#      therefore produce a false alarm, which trains people to ignore the tool.
if ($DryRun) { "`nDRY  verify -- nothing to read back"; return }

function Get-RepoState {
    [pscustomobject]@{
        Labels = @(@(Get-Json @('api', "repos/$Repo/labels?per_page=100")) | ForEach-Object { $_.name })
        Ms     = @(@(Get-Json @('api', "repos/$Repo/milestones?state=all")) | ForEach-Object { $_.title })
        Topics = @(@(Get-Json @('api', "repos/$Repo/topics")).names)
        Flags  = (Get-Json @('api', "repos/$Repo"))
        Prot   = (Get-Json @('api', "repos/$Repo/branches/main/protection"))
    }
}

$wantMerge = [ordered]@{ allow_squash_merge = $true; allow_merge_commit = $true; allow_rebase_merge = $false; delete_branch_on_merge = $true }
$deadline = (Get-Date).AddSeconds(60)
$waited = 0
while ($true) {
    $st = Get-RepoState
    $missLabels = @($labels.Keys | Where-Object { $st.Labels -notcontains $_ })
    $missMs     = @($milestones | Where-Object { $st.Ms -notcontains $_ })
    $missTopics = @($wantTopics | Where-Object { $st.Topics -notcontains $_ })
    $badMerge   = @($wantMerge.Keys | Where-Object { $null -eq $st.Flags -or [bool]$st.Flags.$_ -ne $wantMerge[$_] })
    $protOk     = [bool]($st.Prot -and $st.Prot.required_status_checks.strict -eq $true -and
                          (@($st.Prot.required_status_checks.contexts) -contains 'knowledge') -and
                          $st.Prot.required_pull_request_reviews.required_approving_review_count -eq 1)
    $wikiOk     = [bool]($st.Flags -and $st.Flags.has_wiki -eq $false)
    if (-not $missLabels.Count -and -not $missMs.Count -and -not $missTopics.Count -and -not $badMerge.Count -and $protOk -and $wikiOk) { break }
    if ((Get-Date) -gt $deadline) { break }
    Start-Sleep -Seconds 3; $waited += 3
}

if ($missLabels.Count) { $Failures += 'labels (read-back)' }
if ($missMs.Count)     { $Failures += 'milestones (read-back)' }
if ($badMerge.Count)   { $Failures += 'merge settings (read-back)' }
if (-not $protOk)      { $Failures += 'branch protection (read-back)' }
if ($missTopics.Count) { $Failures += 'topics (read-back)' }
if (-not $wikiOk)      { $Failures += 'wiki (read-back)' }

"`nRead back from ${Repo} after ${waited}s:"
"  labels missing:    $(@($missLabels).Count) of $($labels.Count) expected$(if ($missLabels) { ' -- ' + ($missLabels -join ', ') })"
"  milestones missing: $(@($missMs).Count) of $($milestones.Count) expected$(if ($missMs) { ' -- ' + ($missMs -join ', ') })"
"  merge settings:    squash=$($st.Flags.allow_squash_merge) merge=$($st.Flags.allow_merge_commit) rebase=$($st.Flags.allow_rebase_merge) deleteOnMerge=$($st.Flags.delete_branch_on_merge)$(if ($badMerge.Count) { '  <-- MISMATCH: ' + ($badMerge -join ', ') } else { '  (as intended)' })"
"  branch protection: $(if ($protOk) { 'knowledge required and up to date, 1 approving review' } else { 'NOT AS DOCUMENTED' })"
"  topics:            $(if ($missTopics.Count) { 'missing ' + ($missTopics -join ', ') } else { $st.Topics -join ', ' })"
"  wiki:              $(if ($wikiOk) { 'disabled' } else { 'still enabled' })"
"  description:       $($st.Flags.description)"

$Failures = @($Failures | Select-Object -Unique)
if ($Failures.Count) {
    "`nSETUP INCOMPLETE"
    "  refused or not yet visible: " + ($Failures -join '; ')
    "`nThe repository cannot be treated as configured until this prints SETUP VERIFIED."
    exit 1
}
"`nSETUP VERIFIED against the live repository."
