export const SUPPORTED_DISPLAY_CURRENCIES = [
  "USD",
  "KRW",
  "JPY",
  "EUR",
  "GBP",
  "CAD",
  "AUD",
  "CNY",
  "HKD",
  "SGD",
] as const;

export type SupportedDisplayCurrency = (typeof SUPPORTED_DISPLAY_CURRENCIES)[number];

export interface ExchangeRateResult {
  sourceCurrency: string;
  requestedCurrency: string;
  displayCurrency: string;
  rate: number;
  rateDate: string | null;
  fetchedAt: string;
  source: "identity" | "frankfurter";
  status: "identity" | "live" | "unavailable";
  message?: string;
}

export interface ReadExchangeRateOptions {
  sourceCurrency: string;
  requestedCurrency: string;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

interface FrankfurterRatePayload {
  date?: unknown;
  base?: unknown;
  quote?: unknown;
  rate?: unknown;
}

const DEFAULT_RATE_SOURCE_URL = "https://api.frankfurter.dev/v2/rates";
const RATE_SOURCE_URL_ENV_KEY = "MONEYSIREN_EXCHANGE_RATE_URL";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; result: ExchangeRateResult }>();

export async function readExchangeRate(options: ReadExchangeRateOptions): Promise<ExchangeRateResult> {
  const now = options.now?.() ?? new Date();
  const fetchedAt = now.toISOString();
  const sourceCurrency = normalizeCurrency(options.sourceCurrency) ?? "USD";
  const requestedCurrency = normalizeCurrency(options.requestedCurrency) ?? sourceCurrency;

  if (sourceCurrency === requestedCurrency) {
    return {
      sourceCurrency,
      requestedCurrency,
      displayCurrency: sourceCurrency,
      rate: 1,
      rateDate: fetchedAt.slice(0, 10),
      fetchedAt,
      source: "identity",
      status: "identity",
    };
  }

  const cacheKey = `${sourceCurrency}:${requestedCurrency}`;
  const cached = cache.get(cacheKey);

  if (cached !== undefined && cached.expiresAt > now.getTime()) {
    return cached.result;
  }

  try {
    const endpoint = new URL(options.env?.[RATE_SOURCE_URL_ENV_KEY] ?? DEFAULT_RATE_SOURCE_URL);
    endpoint.searchParams.set("base", sourceCurrency);
    endpoint.searchParams.set("quotes", requestedCurrency);

    const response = await (options.fetchImpl ?? fetch)(endpoint, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json() as unknown;
    const rate = parseFrankfurterRate(payload, sourceCurrency, requestedCurrency);

    if (rate === null) {
      throw new Error("Exchange rate payload did not include the requested pair.");
    }

    const result: ExchangeRateResult = {
      sourceCurrency,
      requestedCurrency,
      displayCurrency: requestedCurrency,
      rate: rate.rate,
      rateDate: rate.date,
      fetchedAt,
      source: "frankfurter",
      status: "live",
    };

    cache.set(cacheKey, {
      expiresAt: now.getTime() + CACHE_TTL_MS,
      result,
    });

    return result;
  } catch (caught) {
    return {
      sourceCurrency,
      requestedCurrency,
      displayCurrency: sourceCurrency,
      rate: 1,
      rateDate: null,
      fetchedAt,
      source: "frankfurter",
      status: "unavailable",
      message: caught instanceof Error ? caught.message.slice(0, 160) : "Exchange rate unavailable.",
    };
  }
}

function parseFrankfurterRate(
  payload: unknown,
  sourceCurrency: string,
  requestedCurrency: string,
): { date: string | null; rate: number } | null {
  const rows = Array.isArray(payload) ? payload : [payload];

  for (const row of rows) {
    if (!isRecord(row)) {
      continue;
    }

    const parsed = row as FrankfurterRatePayload;
    const base = normalizeCurrency(parsed.base);
    const quote = normalizeCurrency(parsed.quote);
    const rate = typeof parsed.rate === "number" && Number.isFinite(parsed.rate) ? parsed.rate : null;

    if (base === sourceCurrency && quote === requestedCurrency && rate !== null && rate > 0) {
      return {
        date: typeof parsed.date === "string" ? parsed.date : null,
        rate,
      };
    }
  }

  return null;
}

function normalizeCurrency(value: string | undefined): string | null;
function normalizeCurrency(value: unknown): string | null;
function normalizeCurrency(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase();

  return /^[A-Z]{3}$/.test(normalized) ? normalized : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
