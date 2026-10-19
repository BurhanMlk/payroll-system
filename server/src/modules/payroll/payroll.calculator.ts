/**
 * Pure payroll calculation engine.
 * No database or framework dependencies — fully unit-testable.
 * Every computed line item carries a human-readable trace explaining
 * exactly how the number was derived.
 */

export type ComponentType = "EARNING" | "DEDUCTION";
export type CalculationKind = "FIXED" | "PERCENTAGE" | "FORMULA";

export interface SalaryComponentInput {
  name: string;
  type: ComponentType;
  calculation: CalculationKind;
  value: number; // fixed amount or percentage
  formula?: string; // supported tokens: BASIC, GROSS
  taxable?: boolean;
}

export interface AttendanceSummary {
  presentDays: number;
  absentDays: number;
  lateMinutes: number;
  overtimeHours: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  workingDays: number;
}

export interface TaxSlab {
  min: number;
  max: number | null; // null = no upper bound
  rate: number; // percentage
  fixedAmount?: number;
}

export interface TaxConfig {
  enabled: boolean;
  mode: "FIXED" | "PERCENTAGE" | "SLAB" | "NONE";
  fixedAmount?: number;
  percentage?: number; // percent of taxable income
  slabs?: TaxSlab[];
  exemption?: number;
  taxableComponentKeys?: string[]; // which earnings are taxable; empty = all
}

export interface PayrollCalculationInput {
  basicSalary: number;
  components: SalaryComponentInput[];
  attendance: AttendanceSummary;
  overtimeRatePerHour: number;
  hourlyRate: number; // basicSalary / workingDays / 8, computed by caller or here
  loanInstallment: number;
  advanceDeduction: number;
  taxConfig: TaxConfig;
  absentDeductionPerDay?: number; // if omitted, uses daily rate
  lateDeductionPerMinute?: number;
  currency: string;
}

export interface CalcLineItem {
  name: string;
  type: ComponentType;
  amount: number;
  trace: string;
}

export interface PayrollCalculationResult {
  basicSalary: number;
  earnings: CalcLineItem[];
  deductions: CalcLineItem[];
  grossSalary: number;
  totalEarnings: number;
  totalDeductions: number;
  taxAmount: number;
  netSalary: number;
  trace: string[];
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function safeFormula(formula: string | undefined, basic: number): number {
  if (!formula) return 0;
  // Whitelist a small expression grammar: numbers, + - * / ( ) and BASIC
  const sanitized = formula.replace(/BASIC/g, String(basic)).replace(/[^0-9+\-*/(). ]/g, "");
  try {
    // eslint-disable-next-line no-new-func
    const result = new Function(`return (${sanitized});`)();
    return typeof result === "number" && isFinite(result) ? result : 0;
  } catch {
    return 0;
  }
}

export function computeTax(income: number, config: TaxConfig): { amount: number; trace: string } {
  if (!config.enabled || config.mode === "NONE") {
    return { amount: 0, trace: "Tax is disabled." };
  }

  if (config.mode === "FIXED") {
    const amount = round2(config.fixedAmount ?? 0);
    return { amount, trace: `Fixed tax of ${amount} applied.` };
  }

  if (config.mode === "PERCENTAGE") {
    const amount = round2((income * (config.percentage ?? 0)) / 100);
    return { amount, trace: `${config.percentage}% of taxable income ${income} = ${amount}.` };
  }

  if (config.mode === "SLAB") {
    const slabs = config.slabs ?? [];
    const exemption = config.exemption ?? 0;
    const taxable = Math.max(0, income - exemption);
    let tax = 0;
    let applied: string | null = null;
    for (const slab of slabs) {
      if (taxable > slab.min) {
        const upper = slab.max ?? Infinity;
        const slabIncome = Math.min(taxable, upper) - slab.min;
        if (slabIncome > 0) {
          const slabTax = round2((slab.fixedAmount ?? 0) + slabIncome * (slab.rate / 100));
          tax = round2(tax + slabTax);
          applied = `slab ${slab.min}-${slab.max ?? "∞"} @ ${slab.rate}%`;
        }
      }
    }
    return {
      amount: tax,
      trace: `Slab tax on taxable income ${taxable} (exemption ${exemption}): ${applied ?? "no slab matched"} = ${tax}.`,
    };
  }

  return { amount: 0, trace: "No tax rule matched." };
}

export function calculatePayroll(input: PayrollCalculationInput): PayrollCalculationResult {
  const trace: string[] = [];
  const earnings: CalcLineItem[] = [];
  const deductions: CalcLineItem[] = [];

  const basic = round2(input.basicSalary);
  const attendance = input.attendance;
  const workingDays = attendance.workingDays > 0 ? attendance.workingDays : 22;
  const dailyRate = round2(basic / workingDays);

  earnings.push({
    name: "Basic Salary",
    type: "EARNING",
    amount: basic,
    trace: `Basic salary as configured: ${basic}.`,
  });

  // Salary components (allowances & static deductions).
  for (const comp of input.components) {
    let amount = 0;
    let reason = "";
    if (comp.calculation === "FIXED") {
      amount = round2(comp.value);
      reason = `Fixed ${comp.name.toLowerCase()} of ${amount}.`;
    } else if (comp.calculation === "PERCENTAGE") {
      amount = round2((basic * comp.value) / 100);
      reason = `${comp.value}% of basic salary ${basic} = ${amount}.`;
    } else if (comp.calculation === "FORMULA") {
      amount = round2(safeFormula(comp.formula, basic));
      reason = `Formula "${comp.formula}" evaluated on basic ${basic} = ${amount}.`;
    }
    const item: CalcLineItem = { name: comp.name, type: comp.type, amount, trace: reason };
    if (comp.type === "EARNING") earnings.push(item);
    else deductions.push(item);
    trace.push(`${comp.name}: ${reason}`);
  }

  // Overtime earnings.
  if (attendance.overtimeHours > 0) {
    const otAmount = round2(attendance.overtimeHours * input.overtimeRatePerHour);
    earnings.push({
      name: "Overtime",
      type: "EARNING",
      amount: otAmount,
      trace: `${attendance.overtimeHours} overtime hours × ${input.overtimeRatePerHour}/hr = ${otAmount}.`,
    });
    trace.push(`Overtime: ${attendance.overtimeHours}h × ${input.overtimeRatePerHour} = ${otAmount}`);
  }

  // Absence deduction.
  if (attendance.absentDays > 0) {
    const perDay = input.absentDeductionPerDay ?? dailyRate;
    const amount = round2(attendance.absentDays * perDay);
    deductions.push({
      name: "Absence Deduction",
      type: "DEDUCTION",
      amount,
      trace: `${attendance.absentDays} absent day(s) × ${perDay}/day = ${amount}.`,
    });
    trace.push(`Absence deduction: ${attendance.absentDays} × ${perDay} = ${amount}`);
  }

  // Late arrival deduction.
  if (attendance.lateMinutes > 0 && (input.lateDeductionPerMinute ?? 0) > 0) {
    const perMin = input.lateDeductionPerMinute!;
    const amount = round2(attendance.lateMinutes * perMin);
    deductions.push({
      name: "Late Arrival Deduction",
      type: "DEDUCTION",
      amount,
      trace: `${attendance.lateMinutes} late minute(s) × ${perMin}/min = ${amount}.`,
    });
    trace.push(`Late deduction: ${attendance.lateMinutes} × ${perMin} = ${amount}`);
  }

  // Loan installment.
  if (input.loanInstallment > 0) {
    deductions.push({
      name: "Loan Installment",
      type: "DEDUCTION",
      amount: round2(input.loanInstallment),
      trace: `Scheduled loan installment of ${round2(input.loanInstallment)}.`,
    });
    trace.push(`Loan installment: ${round2(input.loanInstallment)}`);
  }

  // Salary advance recovery.
  if (input.advanceDeduction > 0) {
    deductions.push({
      name: "Salary Advance",
      type: "DEDUCTION",
      amount: round2(input.advanceDeduction),
      trace: `Salary advance recovery of ${round2(input.advanceDeduction)}.`,
    });
    trace.push(`Advance deduction: ${round2(input.advanceDeduction)}`);
  }

  const grossSalary = round2(earnings.reduce((s, e) => s + e.amount, 0));
  const totalEarnings = grossSalary;

  // Tax computed on taxable income (gross minus non-taxable? applied on gross here,
  // refinable per country via TaxConfig).
  const taxResult = computeTax(grossSalary, input.taxConfig);
  if (taxResult.amount > 0) {
    deductions.push({
      name: "Tax",
      type: "DEDUCTION",
      amount: taxResult.amount,
      trace: taxResult.trace,
    });
  }
  trace.push(`Tax: ${taxResult.trace}`);

  const totalDeductions = round2(deductions.reduce((s, d) => s + d.amount, 0));
  const netSalary = round2(grossSalary - totalDeductions);

  trace.push(`Gross = ${grossSalary}; Total deductions = ${totalDeductions}; Net = ${netSalary}`);

  return {
    basicSalary: basic,
    earnings,
    deductions,
    grossSalary,
    totalEarnings,
    totalDeductions,
    taxAmount: taxResult.amount,
    netSalary,
    trace,
  };
}
