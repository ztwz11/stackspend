import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const maxCertificateBytes = 10 * 1024 * 1024;
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const allowedOutputRoot = resolve(repoRoot, ".tmp/codesign");
const args = parseArgs(process.argv.slice(2));

if (args.pfx === undefined) {
  console.error("Usage: node tools/scripts/encode-windows-certificate.mjs <certificate.pfx> [base64-output-under-.tmp/codesign.txt]");
  process.exit(1);
}

const certificatePath = resolve(args.pfx);
const outputPath = resolve(repoRoot, args.out ?? ".tmp/codesign/windows-certificate.base64.txt");
const extension = extname(certificatePath).toLowerCase();

if (extension !== ".pfx" && extension !== ".p12") {
  console.error("Windows signing certificates must be supplied as a .pfx or .p12 file.");
  process.exit(1);
}

if (!isSubPath(outputPath, allowedOutputRoot)) {
  console.error(`Encoded certificate output must stay under ${allowedOutputRoot}`);
  process.exit(1);
}

const certificateBytes = await readFile(certificatePath);
if (certificateBytes.length === 0) {
  console.error(`Certificate file is empty: ${certificatePath}`);
  process.exit(1);
}

if (certificateBytes.length > maxCertificateBytes) {
  console.error(`Certificate file is too large for the release secret helper: ${certificatePath}`);
  process.exit(1);
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${certificateBytes.toString("base64")}\n`, { mode: 0o600 });

console.log(`Wrote base64-encoded Windows signing certificate to ${outputPath}`);
console.log("Set GitHub repository secret WINDOWS_CERTIFICATE to this file content.");
console.log("Set GitHub repository secret WINDOWS_CERTIFICATE_PASSWORD to the PFX/P12 password.");
console.log("Do not commit this output file. The default .tmp/codesign path is ignored.");

function parseArgs(values) {
  const parsed = {};

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];

    if (value === "--pfx") {
      parsed.pfx = values[++index];
    } else if (value === "--out") {
      parsed.out = values[++index];
    } else if (!value.startsWith("--") && parsed.pfx === undefined) {
      parsed.pfx = value;
    } else if (!value.startsWith("--") && parsed.out === undefined) {
      parsed.out = value;
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }

  return parsed;
}

function isSubPath(child, parent) {
  const path = relative(parent, child);
  return path.length > 0 && !path.startsWith("..") && !isAbsolute(path);
}
