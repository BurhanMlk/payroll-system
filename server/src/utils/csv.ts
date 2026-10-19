import { stringify } from "csv-stringify/sync";

export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  return stringify([headers, ...rows.map((r) => r.map((c) => c ?? ""))]);
}
