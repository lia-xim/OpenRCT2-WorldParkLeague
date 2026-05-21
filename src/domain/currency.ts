const OPENRCT2_MONEY_SCALE = 10;

export function normalizeGameMoney(value: number): number {
  return Math.round(value / OPENRCT2_MONEY_SCALE);
}

export function denormalizeGameMoney(value: number): number {
  return Math.round(value * OPENRCT2_MONEY_SCALE);
}
