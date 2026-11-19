import * as XLSX from "xlsx";

/**
 * Robustly parses any uploaded spreadsheet buffer (.xlsx, .xls, .csv, .tsv)
 * into a 2D string array.
 *
 * Uses SheetJS which supports:
 * - Modern .xlsx OpenXML workbooks
 * - Legacy .xls binary BIFF8 workbooks
 * - CSV, TSV, and plain delimited text
 * - Google Sheets / LibreOffice / WPS / Apple Numbers exports
 *
 * Never throws "Cannot read properties of undefined (reading 'sheets')".
 */
export function parseSpreadsheetBuffer(buffer: Buffer): string[][] {
  try {
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
    if (wb && wb.SheetNames && wb.SheetNames.length > 0) {
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (ws) {
        const rawRows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
          header: 1,
          defval: "",
          raw: false,
          dateNF: "yyyy-mm-dd",
        });

        const rows: string[][] = [];
        for (const row of rawRows) {
          if (!Array.isArray(row)) continue;
          const cleanRow = row.map((cell) => {
            if (cell == null) return "";
            if (cell instanceof Date) {
              const y = cell.getFullYear();
              const m = String(cell.getMonth() + 1).padStart(2, "0");
              const d = String(cell.getDate()).padStart(2, "0");
              return `${y}-${m}-${d}`;
            }
            return String(cell).trim();
          });
          // Skip completely empty rows
          if (cleanRow.some((c) => c.length > 0)) {
            rows.push(cleanRow);
          }
        }

        if (rows.length > 0) {
          return rows;
        }
      }
    }
  } catch {
    // If SheetJS encounters non-standard binary structure, fallback to text/csv parser
  }

  // Fallback: parse as plain text (CSV / TSV / Delimited)
  try {
    const text = buffer.toString("utf-8").replace(/^\uFEFF/, "");
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    return lines.map((line) => {
      const delimiter = line.includes(";") ? ";" : line.includes("\t") ? "\t" : ",";
      return line.split(delimiter).map((c) => c.replace(/^["']|["']$/g, "").trim());
    });
  } catch {
    return [];
  }
}
