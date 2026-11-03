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

function Invoke-Gh {
    param([string[]]$Args, [string]$Label)
    if ($DryRun) { "DRY  $Label"; return }
    try {
        $out = & gh @Args 2>&1
        if ($LASTEXITCODE -ne 0) { "SKIP $Label -- $((($out | Out-String) -split "`n")[0])" }
        else { "OK   $Label" }
    } catch { "FAIL $Label -- $($_.Exception.Message)" }
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
foreach ($m in 'M0 Skeleton and contracts',
               'M1 Headless planner, correctness first',
               'M2 The daily loop, manual-first',
               'M3 Reviews that change the future',
               'M4 Evidence enrichment (import)',
               'M5 Autoregulation and calibration',
               'M6 Multi-tenant hardening and launch') {
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
        $json | & gh api -X PUT "repos/$Repo/branches/main/protection" --input -
        if ($LASTEXITCODE -eq 0) { 'OK   branch protection main' }
        else { 'SKIP branch protection -- gh api failed (needs admin on the repo)' }
    } catch { "FAIL branch protection -- $($_.Exception.Message)" }
}

# Which merge styles the repository allows: squash for leaves, merge commit for spine -> main,
# no rebase (a rebased spine that is already reviewed elsewhere is a re-review).
Invoke-Gh @('api','-X', 'PATCH', "repos/$Repo", '-F', 'squash_merge=true', '-F', 'merge_commit=true',
            '-F', 'rebase_merge=false', '-F', 'delete_branch_on_merge=true') 'repo merge settings'

"`nNext: create the repository if it does not exist yet:"
"  gh repo create <owner>/training-planner --private --source . --remote origin --push"
"Then re-run this script without -DryRun."
