import PDFDocument from "pdfkit";
import { Prisma } from "@prisma/client";

interface PayslipMinimal {
  paymentStatus: string;
  paymentDate: Date | null;
}

interface EmployeeMinimal {
  firstName: string;
  lastName: string;
  employeeNumber: string;
  department?: { name: string } | null;
  designation?: { name: string } | null;
  branch?: { name: string } | null;
}

interface PayrollItemMinimal {
  basicSalary: Prisma.Decimal;
  grossSalary: Prisma.Decimal;
  totalDeductions: Prisma.Decimal;
  netSalary: Prisma.Decimal;
  earnings: { name: string; amount: Prisma.Decimal }[];
  deductions: { name: string; amount: Prisma.Decimal }[];
}

interface PayrollRunMinimal {
  periodStart: Date;
  periodEnd: Date;
}

export interface PayslipPdfData {
  payslip: PayslipMinimal;
  employee: EmployeeMinimal;
  payrollItem: PayrollItemMinimal;
  payrollRun: PayrollRunMinimal;
  institution: { name: string; address?: string | null; logoUrl?: string | null };
}

/** Generates a professional PDF payslip as a Buffer. */
export function buildPayslipPdf(data: PayslipPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const institution = data.institution;
    const emp = data.employee;
    const item = data.payrollItem;

    // Header
    doc.fontSize(20).font("Helvetica-Bold").text(institution.name, { align: "center" });
    if (institution.address) {
      doc.fontSize(9).font("Helvetica").text(institution.address, { align: "center" });
    }
    doc.moveDown(0.5);
    doc.fontSize(14).font("Helvetica-Bold").text("PAYSLIP", { align: "center" });
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();

    // Employee block
    doc.moveDown(0.8);
    const blockTop = doc.y;
    const left = [
      ["Employee", `${emp.firstName} ${emp.lastName}`],
      ["Employee ID", emp.employeeNumber],
      ["Department", emp.department?.name ?? "-"],
      ["Designation", emp.designation?.name ?? "-"],
      ["Branch", emp.branch?.name ?? "-"],
    ];
    const right = [
      ["Payroll Period", `${data.payrollRun.periodStart.toISOString().slice(0, 10)} to ${data.payrollRun.periodEnd.toISOString().slice(0, 10)}`],
      ["Basic Salary", item.basicSalary.toFixed(2)],
      ["Payment Status", data.payslip.paymentStatus],
      ["Payment Date", data.payslip.paymentDate ? data.payslip.paymentDate.toISOString().slice(0, 10) : "-"],
    ];

    const lineHeight = 14;

    // Left column — bold labels, starting from the same top as the right column.
    doc.save();
    let y = blockTop;
    left.forEach(([k, v]) => {
      doc.fontSize(9).font("Helvetica-Bold").text(`${k}:`, 50, y, { continued: true });
      doc.font("Helvetica").text(` ${v}`, { continued: false });
      y += lineHeight;
    });
    doc.restore();

    // Right column — right-aligned.
    doc.save();
    y = blockTop;
    right.forEach(([k, v]) => {
      doc.fontSize(9).font("Helvetica").text(`${k}: ${v}`, 300, y, { width: 245, align: "right" });
      y += lineHeight;
    });
    doc.restore();

    doc.y = blockTop + Math.max(left.length, right.length) * lineHeight;
    doc.moveDown(0.8);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();

    // Earnings & deductions
    doc.moveDown(0.6);
    doc.fontSize(11).font("Helvetica-Bold").text("Earnings", { underline: true });
    doc.moveDown(0.3);
    data.payrollItem.earnings.forEach((e) => {
      doc.fontSize(9).font("Helvetica").text(e.name, 50, doc.y, { continued: true });
      doc.font("Helvetica-Bold").text(e.amount.toFixed(2), { align: "right" });
    });

    doc.moveDown(0.6);
    doc.fontSize(11).font("Helvetica-Bold").text("Deductions", { underline: true });
    doc.moveDown(0.3);
    data.payrollItem.deductions.forEach((d) => {
      doc.fontSize(9).font("Helvetica").text(d.name, 50, doc.y, { continued: true });
      doc.font("Helvetica-Bold").text(`-${d.amount.toFixed(2)}`, { align: "right" });
    });

    // Summary
    doc.moveDown(0.8);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.4);
    doc.fontSize(10).font("Helvetica-Bold").text(`Gross Salary: ${item.grossSalary.toFixed(2)}`, { align: "right" });
    doc.text(`Total Deductions: -${item.totalDeductions.toFixed(2)}`, { align: "right" });
    doc.fontSize(13).font("Helvetica-Bold").text(`Net Salary: ${item.netSalary.toFixed(2)}`, { align: "right" });

    doc.moveDown(1.5);
    doc.fontSize(8).font("Helvetica").fillColor("#777").text(
      "This is a computer-generated payslip and does not require a signature.",
      { align: "center" },
    );

    doc.end();
  });
}
