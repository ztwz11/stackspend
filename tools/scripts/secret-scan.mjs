import { readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".sql",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

const SECRET_PATTERNS = [
  {
    name: "OpenAI-style API key",
    pattern: /(?:^|[^A-Za-z0-9])sk-[A-Za-z0-9_-]{8,}/g,
  },
  {
    name: "Slack token",
    pattern: /xox[baprs]-[A-Za-z0-9-]{8,}/g,
  },
  {
    name: "Slack webhook URL",
    pattern: /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+/g,
  },
  {
    name: "AWS access key id",
    pattern: /AKIA[0-9A-Z]{16}/g,
  },
  {
    name: "Google API key",
    pattern: /AIza[0-9A-Za-z_-]{35}/g,
  },
];

const SAFE_EXAMPLE_PATTERN = /fake|fixture|synthetic|example|do-not-use|dummy|test/i;
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const gitSafeDirectory = repoRoot.replaceAll("\\", "/");
const files = listFiles();
const findings = [];

for (const file of files) {
  if (!TEXT_EXTENSIONS.has(extname(file).toLowerCase())) {
    continue;
  }

  const text = readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";

    for (const secretPattern of SECRET_PATTERNS) {
      for (const match of line.matchAll(secretPattern.pattern)) {
        const value = match[0].trim();

        if (SAFE_EXAMPLE_PATTERN.test(line) || SAFE_EXAMPLE_PATTERN.test(value)) {
          continue;
        }

        findings.push({
          file,
          line: index + 1,
          name: secretPattern.name,
          preview: redactSecret(value),
        });
      }
    }
  }
}

if (findings.length > 0) {
  console.error("Potential committed secrets found:");

  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} ${finding.name}: ${finding.preview}`);
  }

  process.exit(1);
}

console.log(`Secret scan passed (${files.length} files checked).`);

function listFiles() {
  const result = spawnSync("git", [
    "-c",
    `safe.directory=${gitSafeDirectory}`,
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
  ], {
    encoding: "utf8",
    cwd: repoRoot,
  });

  if (result.status !== 0) {
    console.error(result.stderr.trim() || "git ls-files failed");
    process.exit(result.status ?? 1);
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((file) => !file.includes("/node_modules/"))
    .filter((file) => !file.includes("/dist/"))
    .filter((file) => !file.includes("/.next/"));
}

function redactSecret(value) {
  if (value.length <= 10) {
    return "[redacted]";
  }

  return `${value.slice(0, 4)}...[redacted]...${value.slice(-4)}`;
}
