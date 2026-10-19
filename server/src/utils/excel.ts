import ExcelJS from "exceljs";

export interface SheetSpec {
  name: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
}

/** Builds an .xlsx workbook from one or more sheets and returns a Buffer. */
export async function buildExcel(sheets: SheetSpec[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "EduPayroll";
  workbook.created = new Date();

  for (const sheet of sheets) {
    const ws = workbook.addWorksheet(sheet.name.slice(0, 31) || "Sheet1");
    ws.columns = sheet.headers.map((h) => ({ header: h, key: h, width: Math.max(12, h.length + 6) }));
    ws.getRow(1).font = { bold: true };
    for (const row of sheet.rows) {
      ws.addRow(row.map((c) => c ?? ""));
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
