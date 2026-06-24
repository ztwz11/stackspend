import { mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");
const lockRoot = resolve(repoRoot, ".moneysiren", "build-locks");
const lockDir = resolve(lockRoot, "cli-dist.lock");
const staleLockMs = 10 * 60 * 1000;
const retryDelayMs = 100;

export function acquireCliBuildLock(options = {}) {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const startedAt = Date.now();

  mkdirSync(lockRoot, { recursive: true });

  while (true) {
    try {
      mkdirSync(lockDir);
      writeFileSync(resolve(lockDir, "owner.txt"), `${process.pid}\n${new Date().toISOString()}\n`, "utf8");
      return {
        release() {
          rmSync(lockDir, {
            force: true,
            recursive: true,
          });
        },
      };
    } catch (error) {
      if (!isAlreadyExistsError(error)) {
        throw error;
      }

      removeStaleLockIfNeeded();

      if (Date.now() - startedAt > timeoutMs) {
        throw new Error(`Timed out waiting for CLI build lock at ${lockDir}.`);
      }

      sleepSync(retryDelayMs);
    }
  }
}

function removeStaleLockIfNeeded() {
  try {
    const stats = statSync(lockDir);

    if (Date.now() - stats.mtimeMs > staleLockMs) {
      rmSync(lockDir, {
        force: true,
        recursive: true,
      });
    }
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
  }
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function isAlreadyExistsError(error) {
  return error instanceof Error && "code" in error && error.code === "EEXIST";
}

function isNotFoundError(error) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
