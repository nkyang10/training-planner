$ErrorActionPreference = 'Stop'
$root = 'C:\Users\MY\Desktop\Development\training-planner'
$heur = Join-Path $root 'knowledge\heuristics'

# 1. Collect every backlink of the form heuristics/<file>.yaml#<anchor> in md files.
$mdFiles = Get-ChildItem -Path (Join-Path $root 'knowledge'),(Join-Path $root 'docs') -Recurse -Filter *.md
$links = @{}
foreach ($f in $mdFiles) {
  $txt = Get-Content -Raw -LiteralPath $f.FullName
  foreach ($m in [regex]::Matches($txt, 'heuristics/([a-z0-9-]+\.yaml)#([A-Za-z0-9_-]+)')) {
    $key = $m.Groups[1].Value + '#' + $m.Groups[2].Value
    if (-not $links.ContainsKey($key)) { $links[$key] = New-Object System.Collections.Generic.List[string] }
    $links[$key].Add($f.FullName.Substring($root.Length + 1))
  }
}

# 2. Check each anchor is declared in the target yaml.
$missing = @()
$absentFile = @()
$cache = @{}
foreach ($key in ($links.Keys | Sort-Object)) {
  $parts = $key -split '#'
  $yp = Join-Path $heur $parts[0]
  if (-not (Test-Path -LiteralPath $yp)) { $absentFile += "$key  <- " + ($links[$key] -join ', '); continue }
  if (-not $cache.ContainsKey($yp)) { $cache[$yp] = (Get-Content -Raw -LiteralPath $yp) }
  $y = $cache[$yp]
  $a = $parts[1]
  $declared = [regex]::IsMatch($y, ('(?m)^\s{2}' + [regex]::Escape($a) + ':')) -or [regex]::IsMatch($y, ('(?m)^\s*- id: ' + [regex]::Escape($a) + '\s*$')) -or $y.Contains("'" + $a + "'")
  if (-not $declared) { $missing += ($key + '  <- ' + (($links[$key] | Select-Object -First 2) -join ', ')) }}

# 3. sources: ids must exist in bibliography.md
$bib = Get-Content -Raw -LiteralPath (Join-Path $root 'knowledge\sources\bibliography.md')
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

# 4. dead markdown links
$dead = @()
foreach ($f in $mdFiles) {
  $dir = $f.DirectoryName
  $txt = Get-Content -Raw -LiteralPath $f.FullName
  foreach ($m in [regex]::Matches($txt, '\]\(([^)#][^)]*)\)')) {
    $u = $m.Groups[1].Value
    if ($u -match '^https?:' -or $u -match '^mailto:') { continue }
    $p = $u -split '#' | Select-Object -First 1
    if ($p -eq '') { continue }
    $full = Join-Path $dir $p
    if (-not (Test-Path -LiteralPath $full)) { $dead += ($f.FullName.Substring($root.Length+1) + ' -> ' + $u) }
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
"TOTAL BACKLINKS: $($links.Count)"
