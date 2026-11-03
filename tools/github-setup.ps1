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
            $msg = (($out | Out-String) -split "`r?`n" | Where-Object { $_ } | Select-Object -First 1)
            # An existing label or milestone is the expected outcome of a second run, not a failure.
            if ($msg -match 'already (exists|been taken)|Validation Failed') { ('SKIP ' + $Label + ' -- ' + $msg) }
            else { ('FAIL ' + $Label + ' -- ' + $msg); $script:Failures += $Label }
        }
    } catch { ('FAIL ' + $Label + ' -- ' + $_.Exception.Message); $script:Failures += $Label }
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
foreach ($name in $labels.Keys) {
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
foreach ($m in $milestones) {
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
Invoke-Gh @('api','-X', 'PATCH', "repos/$Repo", '-F', 'squash_merge=true', '-F', 'merge_commit=true',
            '-F', 'rebase_merge=false', '-F', 'delete_branch_on_merge=true') 'repo merge settings'

# --- Read the truth back ------------------------------------------------------
# Everything above prints a claim made by the script. This section asks GitHub instead.
# The first real run of this script printed 35 successes and created nothing, because the
# splat in Invoke-Gh silently ran a bare `gh`; only a read-back can tell those two apart.
if ($DryRun) { "`nDRY  verify -- nothing to read back"; return }
Start-Sleep -Seconds 2
$haveLabels = @(((gh api "repos/$Repo/labels?per_page=100" 2>&1 | Out-String) | ConvertFrom-Json | ForEach-Object { $_.name }))
$haveMs = @(((gh api "repos/$Repo/milestones?state=all" 2>&1 | Out-String) | ConvertFrom-Json | ForEach-Object { $_.title }))
$flags = ((gh api "repos/$Repo" 2>&1 | Out-String) | ConvertFrom-Json)
$missLabels = @($labels.Keys | Where-Object { $haveLabels -notcontains $_ })
$missMs = @($milestones | Where-Object { $haveMs -notcontains $_ })
"`nRead back from ${Repo}:"
"  labels missing:    $(@($missLabels).Count) of $($labels.Count) expected$(if ($missLabels) { ' -- ' + ($missLabels -join ', ') })"
"  milestones missing: $(@($missMs).Count) of $($milestones.Count) expected$(if ($missMs) { ' -- ' + ($missMs -join ', ') })"
"  merge settings:    squash=$($flags.allow_squash_merge) merge=$($flags.allow_merge_commit) rebase=$($flags.allow_rebase_merge) deleteOnMerge=$($flags.delete_branch_on_merge)"
if ($Failures.Count -or $missLabels.Count -or $missMs.Count) {
    "`nSETUP INCOMPLETE"
    if ($Failures.Count) { "  refused: " + ($Failures -join '; ') }
    "`nThe repository cannot be treated as configured until this prints SETUP VERIFIED."
    exit 1
}
"`nSETUP VERIFIED against the live repository."
