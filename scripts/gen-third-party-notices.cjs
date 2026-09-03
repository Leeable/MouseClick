const { execSync } = require("child_process");
const fs = require("fs");

function groupNpm() {
  const out = execSync("npx --yes license-checker --production --json", {
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  });
  const data = JSON.parse(out);
  const by = {};
  for (const [name, info] of Object.entries(data)) {
    if (name.startsWith("mouse-click@")) continue;
    const lic = (info.licenses || "UNKNOWN").toString();
    (by[lic] || (by[lic] = [])).push(name);
  }
  for (const k of Object.keys(by)) by[k].sort();
  return by;
}

function groupCargo() {
  const out = execSync("cargo license --json", {
    cwd: "src-tauri",
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  });
  const arr = JSON.parse(out);
  const by = {};
  for (const p of arr) {
    if (p.name === "mouse-click") continue;
    const lic = (p.license || "UNKNOWN").toString();
    (by[lic] || (by[lic] = [])).push(`${p.name}@${p.version}`);
  }
  for (const k of Object.keys(by)) by[k].sort();
  return by;
}

function section(title, by) {
  let md = `### ${title}\n\n`;
  const keys = Object.keys(by).sort((a, b) => a.localeCompare(b));
  for (const lic of keys) {
    md += `#### ${lic}\n\n`;
    for (const pkg of by[lic]) md += `- ${pkg}\n`;
    md += "\n";
  }
  return md;
}

const npm = groupNpm();
const cargo = groupCargo();

const md = `# Third-Party Notices

This file lists open-source components used by **MouseClick**, and the licenses under which they are distributed.

MouseClick itself is licensed under the [MIT License](LICENSE).

> Generated for production npm dependencies and the \`src-tauri\` Cargo dependency tree. License identifiers follow SPDX where available.

## Frontend (npm)

Direct dependencies include React, MUI, Emotion, and Tauri JavaScript APIs/plugins. The full production dependency tree licenses are:

${section("npm packages by license", npm)}## Rust (Cargo)

Direct dependencies include Tauri 2, Tauri plugins, serde, parking_lot, once_cell, and the Windows crate. The full Cargo dependency tree licenses are:

${section("crates by license", cargo)}## Notes

- Dual-licensed crates (e.g. \`Apache-2.0 OR MIT\`) may be used under either license at your option, subject to their terms.
- For the authoritative license text of each package, see the package source repository or the copies shipped in \`node_modules\` / Cargo registry sources.
- This notice is provided for convenience and does not replace the original license terms of each component.
`;

fs.writeFileSync("THIRD_PARTY_NOTICES.md", md);
console.log(
  "npm:",
  Object.keys(npm).length,
  "groups,",
  Object.values(npm).reduce((a, b) => a + b.length, 0),
  "packages",
);
console.log(
  "cargo:",
  Object.keys(cargo).length,
  "groups,",
  Object.values(cargo).reduce((a, b) => a + b.length, 0),
  "crates",
);
console.log("wrote", fs.statSync("THIRD_PARTY_NOTICES.md").size, "bytes");
