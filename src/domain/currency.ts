const OPENRCT2_MONEY_SCALE = 10;

export function normalizeGameMoney(value: number): number {
  return Math.round(value / OPENRCT2_MONEY_SCALE);
}

export function denormalizeGameMoney(value: number): number {
  return Math.round(value * OPENRCT2_MONEY_SCALE);
}

export function formatMoney(value: number): string {
  const pluginContext = getPluginContext();
  if (pluginContext?.formatString) {
    return pluginContext.formatString("{CURRENCY2DP}", denormalizeGameMoney(value));
  }
  return fallbackFormatMoney(value);
}

export function formatSignedMoney(value: number): string {
  return formatMoney(value);
}

export function formatCompactMoney(value: number): string {
  return formatMoney(value);
}

function getPluginContext(): { formatString?: (fmt: string, ...args: any[]) => string } | undefined {
  return (globalThis as { context?: { formatString?: (fmt: string, ...args: any[]) => string } }).context;
}

function fallbackFormatMoney(value: number): string {
  const prefix = value < 0 ? "-" : "";
  return `${prefix}$${Math.round(Math.abs(value)).toLocaleString("en-US")}`;
}
