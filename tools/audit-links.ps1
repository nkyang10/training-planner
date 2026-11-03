$ErrorActionPreference = 'Stop'
# Repo root derived from where this script lives, never hardcoded: the audit has to run on a
# Linux runner, in a clone, and in a CI checkout, not only on the machine that wrote it.
$root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path -LiteralPath (Join-Path $root 'knowledge'))) { throw "knowledge/ not found above $PSScriptRoot" }
$heur = Join-Path $root 'knowledge/heuristics'

# 1. Collect every citation of a heuristic anchor, from every file that can hold one.
#
# Two spellings mean the same thing and both are checked:
#   heuristics/<file>.yaml#<anchor>   the documented form, anywhere
#   <file>.yaml#<anchor>              the same citation without the folder prefix
# The prefixed form is matched exactly as it always was, with no lookbehind, because prose writes it
# as `../heuristics/x.yaml#y` and a lookbehind would stop seeing that. The bare form needs one, so
# `heuristics/x.yaml` is not counted twice and a name inside a longer token is not a citation.
#
# Widened 2026-11-04 (R5). Until then the corpus was Markdown only, so a citation inside a JSON
# contract, a SQL comment or a heuristic's own `rationale:`/`when:`/`note:` was never opened - and two
# of the citations it could not see were dead (items 15 and 18 of
# docs/engineering/contract-vocabulary.md). What this still cannot see: Markdown heading anchors
# (`file.md#section`), and whether the sentence around a live citation is true.
$mdFiles = @(Get-ChildItem -Path (Join-Path $root 'knowledge'),(Join-Path $root 'docs') -Recurse -Filter *.md) + @(Get-ChildItem -Path $root -Filter *.md -File)
$corpusFiles = @($mdFiles) +
  @(Get-ChildItem -Path (Join-Path $root 'knowledge') -Recurse -Filter *.yaml -File) +
  @(Get-ChildItem -Path (Join-Path $root 'schemas') -Recurse -File | Where-Object { $_.Extension -in '.json','.sql' })
$rxPrefixed = 'heuristics/([a-z0-9-]+\.yaml)#([A-Za-z0-9_-]+)'
$rxBare = '(?<![A-Za-z0-9_./-])([a-z0-9-]+\.yaml)#([A-Za-z0-9_-]+)'
$links = @{}
foreach ($f in $corpusFiles) {
  $txt = Get-Content -Raw -LiteralPath $f.FullName
  $src = ($f.FullName.Substring($root.Length + 1) -replace '\\','/')
  $found = @([regex]::Matches($txt, $rxPrefixed)) + @([regex]::Matches($txt, $rxBare))
  foreach ($m in $found) {
    $key = $m.Groups[1].Value + '#' + $m.Groups[2].Value
    if (-not $links.ContainsKey($key)) { $links[$key] = New-Object System.Collections.Generic.List[string] }
    if (-not $links[$key].Contains($src)) { $links[$key].Add($src) }
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
  $a = [regex]::Escape($parts[1])
  # A citation may point at an indented key (a knob, a nested map), a top-level key (`rules:`,
  # `catalogue:` at column 0), a rule id, or a quoted string used as a value. Missing the top-level
  # form reported four live `#rules` citations as dead before 2026-11-04.
  $declared = [regex]::IsMatch($y, ('(?m)^\s+' + $a + ':')) -or
              [regex]::IsMatch($y, ('(?m)^' + $a + ':')) -or
              [regex]::IsMatch($y, ('(?m)^\s*- id: ' + $a + '\s*$')) -or
              $y.Contains("'" + $parts[1] + "'")
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

# A corpus file that is untracked, or swallowed by .gitignore, is invisible on this machine and
# every clone. `data/` in .gitignore hid docs/data/ that way: seven documents linked it and the
# audit still printed zero, because the files were right there on disk.
$ignored = @()
if ($gitOk) {
  # Two questions, two calls: `-o` lists a file that was never added, `-o -i` lists one that
  # .gitignore swallows (with `-i`, git reports only ignored paths, so one call cannot answer both).
  $cand = @(& git -C $root ls-files '-o' --exclude-standard -- docs knowledge schemas 2>$null) +
          @(& git -C $root ls-files '-o' '-i' --exclude-standard -- docs knowledge schemas 2>$null)
  $ignored = @($cand | Where-Object { $_ -match '\.(md|ya?ml|json|sql)$' -and $_ -notmatch '(^|/)scratch/' } | Select-Object -Unique)
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
"UNCOMMITTED CORPUS FILES: $($ignored.Count)"
$ignored
if ($ignored) { '(written here but absent from a fresh clone: git add them, or fix .gitignore if a pattern is wrong)' }
""
"TOTAL BACKLINKS: $($links.Count)"
