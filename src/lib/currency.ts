// App-wide currency: Pakistani Rupee (PKR).
// Use formatPKR everywhere a money value is shown.

export const CURRENCY_CODE = "PKR";
export const CURRENCY_SYMBOL = "Rs";

export function formatPKR(amount: number): string {
  const value = Number.isFinite(amount) ? amount : 0;
  return `${CURRENCY_SYMBOL} ${value.toLocaleString("en-PK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
