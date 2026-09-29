export function units(value) {
  if (!/^\d+(\.\d{1,18})?$/.test(String(value).trim()))
    throw new Error(
      "Enter a positive ETH amount with up to 18 decimal places.",
    );
  const [whole, decimal = ""] = String(value).trim().split(".");
  const amount = BigInt(whole) * 10n ** 18n + BigInt(decimal.padEnd(18, "0"));
  if (amount <= 0n || amount >= 2n ** 256n)
    throw new Error("Enter a positive ETH amount within the supported limit.");
  return amount;
}
export function fromUnits(amount) {
  const n = BigInt(amount),
    fraction = (n % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "");
  return `${n / 10n ** 18n}${fraction ? `.${fraction}` : ""}`;
}
