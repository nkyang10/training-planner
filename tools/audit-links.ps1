$ErrorActionPreference = 'Stop'
# Repo root derived from where this script lives, never hardcoded: the audit has to run on a
# Linux runner, in a clone, and in a CI checkout, not only on the machine that wrote it.
$root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path -LiteralPath (Join-Path $root 'knowledge'))) { throw "knowledge/ not found above $PSScriptRoot" }
$heur = Join-Path $root 'knowledge/heuristics'

# 1. Collect every backlink of the form heuristics/<file>.yaml#<anchor> in md files.
$mdFiles = @(Get-ChildItem -Path (Join-Path $root 'knowledge'),(Join-Path $root 'docs') -Recurse -Filter *.md) + @(Get-ChildItem -Path $root -Filter *.md -File)
$links = @{}
foreach ($f in $mdFiles) {
  $txt = Get-Content -Raw -LiteralPath $f.FullName
  foreach ($m in [regex]::Matches($txt, 'heuristics/([a-z0-9-]+\.yaml)#([A-Za-z0-9_-]+)')) {
    $key = $m.Groups[1].Value + '#' + $m.Groups[2].Value
    if (-not $links.ContainsKey($key)) { $links[$key] = New-Object System.Collections.Generic.List[string] }
    $links[$key].Add(($f.FullName.Substring($root.Length + 1) -replace '\\','/'))
  }
}

# 2. Check each anchor is declared in the target yaml.
$missing = @()
$absentFile = @()
$cache = @{}
foreach ($key in ($links.Keys | Sort-Object)) {
  $parts = $key -split '#'
  $yp = Join-Path $heur $parts[0]
  if (-not (Test-Path -LiteralPath $yp)) { $absentFile += ($key + '  <- ' + (($links[$key] | Select-Object -First 2) -join ', ')); continue }
  if (-not $cache.ContainsKey($yp)) { $cache[$yp] = (Get-Content -Raw -LiteralPath $yp) }
  $y = $cache[$yp]
  $a = $parts[1]
  $declared = [regex]::IsMatch($y, ('(?m)^\s{2}' + [regex]::Escape($a) + ':')) -or [regex]::IsMatch($y, ('(?m)^\s*- id: ' + [regex]::Escape($a) + '\s*$')) -or $y.Contains("'" + $a + "'")
  if (-not $declared) { $missing += ($key + '  <- ' + (($links[$key] | Select-Object -First 2) -join ', ')) }
}

# 3. sources: ids must exist in bibliography.md
$bib = Get-Content -Raw -LiteralPath (Join-Path $root 'knowledge/sources/bibliography.md')
$badSrc = @()
foreach ($yp2 in (Get-ChildItem -Path $heur -Filter *.yaml)) {
  $t = Get-Content -Raw -LiteralPath $yp2.FullName
  foreach ($m in [regex]::Matches($t, 'sources:\s*\[([^\]]*)\]')) {
    foreach ($id in ($m.Groups[1].Value -split ',')) {
      $s = $id.Trim()
      if ($s -eq '') { continue }
      if (-not $bib.Contains($s)) { $badSrc += ($yp2.Name + ' -> ' + $s) }
    }
  }
}

# 4. Links, judged against the repository rather than the laptop.
#    A filesystem check alone misses two real failures, both of which shipped on 2026-11-03:
#    a path whose case is wrong (fine on Windows, dead on Linux), and a target nobody committed
#    (an unanchored `data/` in .gitignore swallowed docs/data/ while every local run said 0).
$tracked = @{}
try { $gitFiles = & git -C $root ls-files 2>$null } catch { $gitFiles = $null }
if ($LASTEXITCODE -eq 0 -and $gitFiles) {
  foreach ($t in $gitFiles) { $tracked['PS:' + (($t -replace '\\','/').ToLowerInvariant())] = $t }
}
$gitOk = ($tracked.Count -gt 0)

$dead = @()
$untracked = @()
foreach ($f in $mdFiles) {
  $dir = $f.DirectoryName
  $srcRel = $f.FullName.Substring($root.Length + 1) -replace '\\','/'
  $txt = Get-Content -Raw -LiteralPath $f.FullName
  foreach ($m in [regex]::Matches($txt, '\]\(([^)#][^)]*)\)')) {
    $u = $m.Groups[1].Value
    if ($u -match '^https?:' -or $u -match '^mailto:') { continue }
    $p = (($u -split '#')[0]).TrimEnd('/')
    if ($p -eq '') { continue }
    $full = Join-Path $dir $p
    if (-not (Test-Path -LiteralPath $full)) { $dead += ($srcRel + ' -> ' + $u); continue }
    $claimed = [System.IO.Path]::GetFullPath($full)
    $real = (Get-Item -LiteralPath $full).FullName
    if ($claimed -cne $real) {
      $dead += ($srcRel + ' -> ' + $u + '  (case: the filesystem has ' + ($real.Substring($root.Length + 1) -replace '\\','/') + ')')
      continue
    }
    if ($gitOk) {
      $rel = ($real.Substring($root.Length + 1) -replace '\\','/')
      # A directory target is satisfied when git tracks something inside it (git stores files, not folders).
      $known = if ((Get-Item -LiteralPath $full).PSIsContainer) { @($tracked.Keys | Where-Object { $_.StartsWith('PS:' + ($rel.ToLowerInvariant() + '/')) }).Count -gt 0 } else { $tracked.ContainsKey('PS:' + $rel.ToLowerInvariant()) }
      if (-not $known) { $untracked += ($srcRel + ' -> ' + $u) }
    }
  }
}

"MISSING ANCHORS: $($missing.Count)"
$missing
""
"MISSING YAML FILES: $($absentFile.Count)"
$absentFile
""
"BAD SOURCE IDS: $($badSrc.Count)"
$badSrc
""
"DEAD LINKS: $($dead.Count)"
$dead
""
"UNTRACKED TARGETS: $($untracked.Count)"
$untracked
if (-not $gitOk) { '(not a git checkout: link targets checked on disk only)' }
""
"TOTAL BACKLINKS: $($links.Count)"
