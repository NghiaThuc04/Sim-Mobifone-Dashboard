export const NON_NEGATIVE_DECIMAL_PATTERN = '^(0|[1-9][0-9]{0,34})(\\.[0-9]{1,30})?$';
const scale = 10n ** 30n;
export function decimalUnits(value: string): bigint | null {
  if (!new RegExp(NON_NEGATIVE_DECIMAL_PATTERN).test(value)) return null;
  const [integer, fraction = ''] = value.split('.');
  return BigInt(integer) * scale + BigInt(fraction.padEnd(30, '0'));
}
export function sumDecimalStrings(values: readonly string[]): string | null {
  let total = 0n;
  for (const value of values) { const units = decimalUnits(value); if (units === null) return null; total += units; }
  return decimalStringFromUnits(total);
}
export function decimalStringFromUnits(units: bigint): string {
  const absolute = units < 0n ? -units : units;
  const fraction = (absolute % scale).toString().padStart(30, '0').replace(/0+$/, '');
  return (units < 0n ? '-' : '') + (absolute / scale).toString() + (fraction ? '.' + fraction : '');
}
