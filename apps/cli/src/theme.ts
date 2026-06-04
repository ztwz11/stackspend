export interface Theme {
  readonly colorEnabled: boolean;
  brand(text: string): string;
  heading(text: string): string;
  command(text: string): string;
  muted(text: string): string;
  warning(text: string): string;
}

interface ThemeOptions {
  env: Record<string, string | undefined>;
  stdoutIsTTY: boolean;
}

export function createTheme(options: ThemeOptions): Theme {
  const colorEnabled = shouldUseColor(options);

  return {
    colorEnabled,
    brand: style(colorEnabled, "1;36"),
    heading: style(colorEnabled, "1;37"),
    command: style(colorEnabled, "32"),
    muted: style(colorEnabled, "90"),
    warning: style(colorEnabled, "33"),
  };
}

export function shouldUseColor(options: ThemeOptions): boolean {
  if (hasEnvValue(options.env.NO_COLOR)) {
    return false;
  }

  const forcedColor = parseForceColor(options.env.FORCE_COLOR);

  if (forcedColor !== undefined) {
    return forcedColor;
  }

  if (options.env.TERM?.toLowerCase() === "dumb") {
    return false;
  }

  return options.stdoutIsTTY;
}

function style(colorEnabled: boolean, code: string): (text: string) => string {
  return (text) => {
    if (!colorEnabled) {
      return text;
    }

    return `\x1b[${code}m${text}\x1b[0m`;
  };
}

function hasEnvValue(value: string | undefined): boolean {
  return value !== undefined && value.length > 0;
}

function parseForceColor(value: string | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized.length === 0) {
    return true;
  }

  if (normalized === "0" || normalized === "false" || normalized === "no") {
    return false;
  }

  return true;
}
