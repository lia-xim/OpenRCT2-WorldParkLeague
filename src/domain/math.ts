export function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

export function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return sum(values) / values.length;
}

export function meanRevert(
  current: number,
  target: number,
  pull: number,
  shock: number,
  min: number,
  max: number
): number {
  return clamp(current + (target - current) * pull + shock, min, max);
}

export function logarithmicScale(value: number, pivot: number): number {
  if (value <= 0 || pivot <= 1) {
    return 0;
  }
  return clamp(Math.log1p(value) / Math.log1p(pivot), 0, 1.35);
}

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
