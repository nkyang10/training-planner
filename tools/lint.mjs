#!/usr/bin/env node
/**
 * Repository lint. Not a style tool: every rule here is a rule this repository decided to be able to
 * fail on, and three of them are the hard rules from AGENTS.md made mechanical.
 *
 * 1. Purity (AGENTS rule 1). packages/planner-core/src may not read a clock, draw randomness, touch
 *    the filesystem, the network or the environment. Time, seed and knowledge are arguments. This is
 *    the rule whose violation is invisible in a passing test and fatal six months later, when a plan
 *    has to be explained and cannot be reproduced.
 * 2. No `any` in package sources. An `any` is a hole through which a vocabulary disagreement (the
 *    class of bug this repository spent a week removing) walks back in.
 * 3. No console output from library code. Logging belongs in the CLI and the worker.
 * 4. Line endings. The repository is LF; only *.ps1 and *.bat are CRLF (see .gitattributes). A file
 *    that arrives CRLF makes every later diff lie.
 *
 * Exit 1 with one line per problem. No dependencies on purpose: a lint tool that cannot run on a clean
 * checkout is not a gate.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = process.cwd();
const problems = [];

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry === ".git") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
};

const rel = (file) => relative(root, file).split(sep).join("/");

const PURITY = [
  [/\bDate\.now\s*\(/, "Date.now()"],
  [/\bnew Date\s*\(/, "new Date()"],
  [/\bMath\.random\s*\(/, "Math.random()"],
  [/\bprocess\.(env|argv|hrtime|cwd)\b/, "process state"],
  [/\bfetch\s*\(/, "fetch()"],
  [/from\s+["']node:(fs|path|crypto|http|https|net|os|child_process)["']/, "node core I/O import"],
  [/\brequire\s*\(/, "require()"],
];

const scan = (files, rules, message) => {
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const [pattern, label] of rules) {
      const lines = text.split("\n");
      lines.forEach((line, index) => {
        if (pattern.test(line)) problems.push(`${rel(file)}:${index + 1}: ${message}: ${label}`);
      });
    }
  }
};

const packageSources = walk(join(root, "packages")).filter((file) => file.endsWith(".ts") && rel(file).includes("/src/"));
// Apps are not pure - the API reads a socket - but they are held to the same `any` and console rules as packages.
const appSources = walk(join(root, "apps")).filter((file) => file.endsWith(".ts") && rel(file).includes("/src/"));
const allSources = [...packageSources, ...appSources];
const plannerSources = packageSources.filter((file) => rel(file).startsWith("packages/planner-core/src/"));
// The policy evaluator is pure for the same reason the planner is: a comment printed six months from now
// has to be reproducible from the entry, the plan and the knowledge hash, and a clock read inside the
// evaluator would make every stored decision unexplainable.
const policySources = packageSources.filter((file) => rel(file).startsWith("packages/policy/src/"));
// The narrator must be deterministic for the same reason: the same fact object has to produce the same
// comment on the server, in a test and in a replay six months later.
const narratorSources = packageSources.filter((file) => rel(file).startsWith("packages/narrator/src/"));
// The write path must be replayable: the same draft must produce the same rows and ids on any machine.
const entriesSources = packageSources.filter((file) => rel(file).startsWith("packages/entries/src/"));
const reviewSources = packageSources.filter((file) => rel(file).startsWith("packages/review/src/"));

scan(
  [...plannerSources, ...policySources, ...narratorSources, ...entriesSources, ...reviewSources],
  PURITY,
  "engine purity (AGENTS rule 1)",
);

const anyRule = [[/\b:\s*any\b/, "`: any`"], [/\bas\s+any\b/, "`as any`"], [/<any>/, "`<any>`"]];
scan(allSources, anyRule, "no any in package and app sources");

const consoleRule = [[/\bconsole\.(log|debug|info)\s*\(/, "console output"]];
scan(
  allSources.filter((file) => !rel(file).startsWith("packages/cli/") && !rel(file).startsWith("apps/api/src/index.ts")),
  consoleRule,
  "library code must not log",
);

const textFiles = [
  ...walk(join(root, "packages")),
  ...walk(join(root, "tools")),
  ...walk(join(root, "eval")),
  ...walk(join(root, "docs")),
  ...walk(join(root, "knowledge")),
].filter((file) => /\.(ts|json|md|ya?ml|mjs|sql)$/.test(file));
for (const file of textFiles) {
  if (readFileSync(file, "utf8").includes("\r\n")) problems.push(`${rel(file)}: CRLF line ending (the repository is LF)`);
}

if (problems.length > 0) {
  for (const problem of problems) console.error(`  ${problem}`);
  console.error(`LINT: ${problems.length} problems`);
  process.exit(1);
}
console.log(
  `LINT: OK - ${packageSources.length} package sources, ${appSources.length} app sources, ${textFiles.length} text files, engine purity holds`,
);
