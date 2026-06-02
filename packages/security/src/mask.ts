const VISIBLE_PREFIX = 4;
const VISIBLE_SUFFIX = 4;

export function maskSecret(value: string | undefined | null): string {
  if (!value) {
    return "";
  }

  if (value.length <= VISIBLE_PREFIX + VISIBLE_SUFFIX) {
    return "***";
  }

  return `${value.slice(0, VISIBLE_PREFIX)}***${value.slice(-VISIBLE_SUFFIX)}`;
}
