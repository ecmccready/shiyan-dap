/**
 * Operator tool: read the founder repo through the already-authenticated GitHub CLI (`gh api`, scoped reads only)
 * and write an immutable reference snapshot. No token is read, printed or stored by this script.
 * Run: npx tsx scripts/snapshot-founder-reference.ts [ref]   (writes fixtures/references/shiyan-dap-<commit>.json)
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { buildReferenceSnapshot, type GitHubFetch } from "../src/core/github-reference";

export const ghCliFetch: GitHubFetch = async (path) => {
  if (!path.startsWith("/repos/ecmccready/shiyan-dap/")) throw new Error("Refusing path outside the founder repo");
  return JSON.parse(execFileSync("gh", ["api", "-X", "GET", path], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
};

if (process.argv[1]?.endsWith("snapshot-founder-reference.ts")) {
  buildReferenceSnapshot("founder", "ecmccready/shiyan-dap", process.argv[2] || "main", ghCliFetch).then((s) => {
    const text = JSON.stringify(s, null, 2) + "\n";
    const out = `fixtures/references/shiyan-dap-${s.commit_sha.slice(0, 12)}.json`;
    writeFileSync(out, text, { flag: "wx" });
    console.log(JSON.stringify({ out, commit: s.commit_sha, files: s.files.length, commits: s.commits.length,
      contracts: s.contracts.map((c) => c.path), evidence: s.evidence.length, excluded: s.excluded_paths,
      sha256: createHash("sha256").update(text).digest("hex") }));
  });
}
