import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const args = parseArgs(process.argv.slice(2));
const platform = args.platform ?? "all";
const failures = [];

if (platform !== "all" && platform !== "windows" && platform !== "macos") {
  console.error("--platform must be one of: all, windows, macos");
  process.exit(1);
}

if (platform === "all" || platform === "windows") {
  await checkWindowsSigning({
    certificateFile: resolve(args.windowsCertificateFile ?? ".tmp/codesign/windows-certificate.base64.txt"),
  });
}

if (platform === "all" || platform === "macos") {
  await checkMacSigning();
}

if (failures.length > 0) {
  console.error("Signing readiness failed.");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Signing readiness passed for requested platform(s).");

async function checkWindowsSigning({ certificateFile }) {
  const certificateFromEnv = envValue("WINDOWS_CERTIFICATE");
  const hasCertificateEnv = certificateFromEnv.length > 0;
  const hasCertificateFile = existsSync(certificateFile);
  const certificatePayloads = [];

  if (hasCertificateEnv) {
    const bytes = validateBase64(certificateFromEnv, "WINDOWS_CERTIFICATE");
    if (bytes !== null) {
      certificatePayloads.push({
        bytes,
        label: "WINDOWS_CERTIFICATE",
        value: certificateFromEnv,
      });
    }
  }

  if (hasCertificateFile) {
    const certificateFromFile = await readFile(certificateFile, "utf8");
    const bytes = validateBase64(certificateFromFile, certificateFile);
    console.log(`Found encoded Windows signing certificate file: ${certificateFile}`);
    if (bytes !== null) {
      certificatePayloads.push({
        bytes,
        label: certificateFile,
        value: certificateFromFile,
      });
    }
  }

  const certificatePassword = envValue("WINDOWS_CERTIFICATE_PASSWORD");
  if ((hasCertificateEnv || hasCertificateFile) && certificatePassword.length === 0) {
    failures.push("Windows signing env is missing: WINDOWS_CERTIFICATE_PASSWORD");
  }

  if (certificatePassword.length > 0) {
    for (const payload of certificatePayloads) {
      await validateWindowsCertificatePayload(payload, certificatePassword);
    }
  }

  if (process.platform !== "win32") {
    console.log("Skipping local Windows certificate store scan on non-Windows host.");
  } else {
    try {
      const { stdout } = await execFileAsync("powershell.exe", [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        [
          "$certs = @(Get-ChildItem Cert:\\CurrentUser\\My -CodeSigningCert)",
          "if ($certs.Count -eq 0) { exit 2 }",
          "$certs | ForEach-Object { Write-Output ($_.Thumbprint + '|' + $_.Subject + '|' + $_.NotAfter.ToString('o')) }",
        ].join("; "),
      ], {
        windowsHide: true,
        timeout: 30_000,
      });

      console.log("Local Windows code-signing certificates:");
      for (const line of stdout.trim().split(/\r?\n/).filter(Boolean)) {
        const [thumbprint, subject, notAfter] = line.split("|");
        console.log(`- ${thumbprint} ${subject} expires ${notAfter}`);
      }
    } catch (error) {
      const code = isRecord(error) && typeof error.code === "number" ? error.code : 1;
      if (code !== 2) {
        failures.push(`Could not inspect local Windows code-signing certificates: ${error.message}`);
      }
    }
  }

  if (!hasCertificateEnv && !hasCertificateFile) {
    failures.push([
      "No encoded Windows signing certificate input was found.",
      "Set WINDOWS_CERTIFICATE or generate .tmp/codesign/windows-certificate.base64.txt for the GitHub release workflow.",
    ].join(" "));
  }
}

async function validateWindowsCertificatePayload(payload, certificatePassword) {
  if (process.platform !== "win32") {
    await validateWindowsCertificatePayloadWithOpenSsl(payload, certificatePassword);
    return;
  }

  try {
    const { stdout } = await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      [
        "$ErrorActionPreference = 'Stop'",
        "$encoded = ($env:MONEYSIREN_WINDOWS_CERTIFICATE_BASE64 -replace '\\s', '')",
        "$bytes = [Convert]::FromBase64String($encoded)",
        "$flags = [System.Security.Cryptography.X509Certificates.X509KeyStorageFlags]::EphemeralKeySet",
        "$cert = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($bytes, $env:WINDOWS_CERTIFICATE_PASSWORD, $flags)",
        "if (-not $cert.HasPrivateKey) { throw 'certificate has no private key' }",
        "$ekuOids = @($cert.EnhancedKeyUsageList | ForEach-Object { $_.ObjectId.Value })",
        "if ($ekuOids.Count -gt 0 -and -not ($ekuOids -contains '1.3.6.1.5.5.7.3.3')) { throw 'certificate does not include the Code Signing EKU' }",
        "Write-Output ($cert.Thumbprint + '|' + $cert.Subject + '|' + $cert.NotAfter.ToString('o'))",
      ].join("; "),
    ], {
      env: {
        ...process.env,
        MONEYSIREN_WINDOWS_CERTIFICATE_BASE64: payload.value,
        WINDOWS_CERTIFICATE_PASSWORD: certificatePassword,
      },
      windowsHide: true,
      timeout: 30_000,
    });

    const [thumbprint, subject, notAfter] = stdout.trim().split("|");
    console.log(`Validated Windows signing certificate ${thumbprint} ${subject} expires ${notAfter}`);
  } catch (error) {
    failures.push(`Could not validate Windows signing certificate ${payload.label}: ${errorDetail(error)}`);
  }
}

async function validateWindowsCertificatePayloadWithOpenSsl(payload, certificatePassword) {
  const codesignDir = resolve(".tmp/codesign");
  await mkdir(codesignDir, { recursive: true });
  const tempDir = await mkdtemp(resolve(codesignDir, "readiness-"));
  const certificatePath = resolve(tempDir, "windows-certificate.pfx");

  try {
    await writeFile(certificatePath, payload.bytes, { mode: 0o600 });
    const commonOptions = {
      env: {
        ...process.env,
        WINDOWS_CERTIFICATE_PASSWORD: certificatePassword,
      },
      timeout: 30_000,
    };

    const certificateResult = await execFileAsync("openssl", [
      "pkcs12",
      "-in",
      certificatePath,
      "-clcerts",
      "-nokeys",
      "-passin",
      "env:WINDOWS_CERTIFICATE_PASSWORD",
    ], commonOptions);
    const certificatePemPath = resolve(tempDir, "windows-certificate.pem");
    await writeFile(certificatePemPath, certificateResult.stdout, { mode: 0o600 });

    const infoResult = await execFileAsync("openssl", [
      "pkcs12",
      "-in",
      certificatePath,
      "-info",
      "-noout",
      "-passin",
      "env:WINDOWS_CERTIFICATE_PASSWORD",
    ], commonOptions);
    if (!/(Keybag|Shrouded Keybag)/i.test(`${infoResult.stdout}\n${infoResult.stderr}`)) {
      failures.push(`Could not validate Windows signing certificate ${payload.label}: certificate bundle has no private key bag.`);
      return;
    }

    const ekuResult = await execFileAsync("openssl", [
      "x509",
      "-in",
      certificatePemPath,
      "-noout",
      "-ext",
      "extendedKeyUsage",
      "-subject",
      "-enddate",
      "-fingerprint",
      "-sha1",
    ], commonOptions);
    if (/Extended Key Usage:/i.test(ekuResult.stdout) && !/Code Signing/i.test(ekuResult.stdout)) {
      failures.push(`Could not validate Windows signing certificate ${payload.label}: certificate does not include the Code Signing EKU.`);
      return;
    }

    console.log(`Validated Windows signing certificate payload with OpenSSL: ${payload.label}`);
  } catch (error) {
    failures.push(`Could not validate Windows signing certificate ${payload.label}: ${errorDetail(error)}`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function checkMacSigning() {
  checkRequiredEnv([
    "APPLE_CERTIFICATE",
    "APPLE_CERTIFICATE_PASSWORD",
    "KEYCHAIN_PASSWORD",
    "APPLE_ID",
    "APPLE_PASSWORD",
    "APPLE_TEAM_ID",
  ], "macOS signing");

  if (process.platform !== "darwin") {
    console.log("Skipping local Apple code-signing identity scan on non-macOS host.");
    return;
  }

  try {
    const { stdout } = await execFileAsync("security", ["find-identity", "-v", "-p", "codesigning"], {
      timeout: 30_000,
    });
    const identities = stdout.split(/\r?\n/).filter((line) => /\) [A-Fa-f0-9]+ "/.test(line));
    if (identities.length === 0) {
      failures.push("No local Apple code-signing identity was found.");
      return;
    }

    console.log("Local Apple code-signing identities:");
    for (const identity of identities) {
      console.log(`- ${identity.trim()}`);
    }
  } catch (error) {
    failures.push(`Could not inspect local Apple code-signing identities: ${error.message}`);
  }
}

function checkRequiredEnv(names, label) {
  const missing = names.filter((name) => (process.env[name] ?? "").trim().length === 0);
  if (missing.length > 0) {
    failures.push(`${label} env is missing: ${missing.join(", ")}`);
  }
}

function envValue(name) {
  return (process.env[name] ?? "").trim();
}

function validateBase64(value, label) {
  const normalized = value.replaceAll(/\s/g, "");
  if (normalized.length === 0) {
    failures.push(`${label} is empty.`);
    return null;
  }

  try {
    const decoded = Buffer.from(normalized, "base64");
    if (decoded.length === 0 || decoded.toString("base64").replaceAll("=", "") !== normalized.replaceAll("=", "")) {
      failures.push(`${label} is not valid base64 certificate data.`);
      return null;
    }
    return decoded;
  } catch {
    failures.push(`${label} is not valid base64 certificate data.`);
    return null;
  }
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--platform") {
      parsed.platform = values[++index];
    } else if (value === "--windows-certificate-file") {
      parsed.windowsCertificateFile = values[++index];
    } else if (["all", "windows", "macos"].includes(value)) {
      parsed.platform = value;
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  return parsed;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorDetail(error) {
  if (isRecord(error) && typeof error.stderr === "string" && error.stderr.trim().length > 0) {
    return error.stderr.trim().split(/\r?\n/)[0];
  }

  return error instanceof Error ? error.message : String(error);
}
