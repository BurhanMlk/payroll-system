import { Prisma } from "@prisma/client";

export const decimal = (n: Prisma.Decimal | number | string | null | undefined): Prisma.Decimal =>
  n instanceof Prisma.Decimal ? n : new Prisma.Decimal(n ?? 0);

export function round2(n: Prisma.Decimal): Prisma.Decimal {
  return n.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

export function money(n: Prisma.Decimal | number): number {
  return round2(decimal(n)).toNumber();
}

export function fmtMoney(n: Prisma.Decimal | number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(money(n));
}
