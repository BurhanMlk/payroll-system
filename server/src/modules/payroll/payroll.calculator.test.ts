import { describe, it, expect } from "vitest";
import { calculatePayroll, computeTax, PayrollCalculationInput } from "./payroll.calculator";

function baseInput(overrides: Partial<PayrollCalculationInput> = {}): PayrollCalculationInput {
  return {
    basicSalary: 60000,
    components: [
      { name: "House Allowance", type: "EARNING", calculation: "FIXED", value: 10000 },
      { name: "Transport Allowance", type: "EARNING", calculation: "FIXED", value: 5000 },
      { name: "Medical Allowance", type: "EARNING", calculation: "FIXED", value: 3000 },
      { name: "Overtime", type: "EARNING", calculation: "FIXED", value: 2500 },
      { name: "Absence Deduction", type: "DEDUCTION", calculation: "FIXED", value: 4000 },
      { name: "Loan Deduction", type: "DEDUCTION", calculation: "FIXED", value: 4000 },
    ],
    attendance: {
      presentDays: 22,
      absentDays: 0,
      lateMinutes: 0,
      overtimeHours: 0,
      paidLeaveDays: 0,
      unpaidLeaveDays: 0,
      workingDays: 22,
    },
    overtimeRatePerHour: 0,
    hourlyRate: 0,
    loanInstallment: 0,
    advanceDeduction: 0,
    taxConfig: { enabled: false, mode: "NONE" },
    currency: "PKR",
    ...overrides,
  };
}

describe("payroll.calculator", () => {
  it("computes the documented example: gross 80,500, net 72,500", () => {
    const result = calculatePayroll(baseInput());
    expect(result.grossSalary).toBe(80500);
    expect(result.totalDeductions).toBe(8000);
    expect(result.netSalary).toBe(72500);
    expect(result.earnings.map((e) => e.name)).toContain("Basic Salary");
    expect(result.deductions.map((d) => d.name)).toContain("Absence Deduction");
  });

  it("calculates percentage-based allowances on basic salary", () => {
    const result = calculatePayroll(
      baseInput({
        components: [{ name: "House Allowance", type: "EARNING", calculation: "PERCENTAGE", value: 10 }],
      }),
    );
    expect(result.earnings.find((e) => e.name === "House Allowance")?.amount).toBe(6000);
  });

  it("deducts absence using the daily rate", () => {
    const result = calculatePayroll(
      baseInput({
        components: [],
        attendance: { presentDays: 20, absentDays: 2, lateMinutes: 0, overtimeHours: 0, paidLeaveDays: 0, unpaidLeaveDays: 0, workingDays: 22 },
      }),
    );
    const dailyRate = Math.round((60000 / 22) * 100) / 100;
    const absence = result.deductions.find((d) => d.name === "Absence Deduction");
    expect(absence?.amount).toBeCloseTo(2 * dailyRate, 1);
  });

  it("adds loan and advance deductions to net salary", () => {
    const result = calculatePayroll(baseInput({ loanInstallment: 5000, advanceDeduction: 2000 }));
    expect(result.totalDeductions).toBe(8000 + 5000 + 2000);
  });

  it("produces a trace explaining every figure", () => {
    const result = calculatePayroll(baseInput());
    expect(result.trace.length).toBeGreaterThan(0);
    expect(result.earnings.every((e) => e.trace.length > 0)).toBe(true);
    expect(result.deductions.every((d) => d.trace.length > 0)).toBe(true);
  });

  it("never produces a negative net salary silently (surfaced to caller)", () => {
    const result = calculatePayroll(
      baseInput({ components: [{ name: "Penalty", type: "DEDUCTION", calculation: "FIXED", value: 100000 }] }),
    );
    expect(result.netSalary).toBeLessThan(0);
  });
});

describe("computeTax (slab engine)", () => {
  const slabs = [
    { min: 0, max: 50000, rate: 0 },
    { min: 50000, max: 100000, rate: 10 },
    { min: 100000, max: null, rate: 20 },
  ];

  it("applies slab rates progressively", () => {
    const result = computeTax(150000, { enabled: true, mode: "SLAB", slabs });
    // 50,000 * 0% + 50,000 * 10% + 50,000 * 20% = 0 + 5000 + 10000
    expect(result.amount).toBe(15000);
  });

  it("returns zero when disabled", () => {
    const result = computeTax(150000, { enabled: false, mode: "SLAB", slabs });
    expect(result.amount).toBe(0);
  });
});
