export interface User {
  id: string;
  email: string;
  fullName: string;
  tenantId: string | null;
  scope: "PLATFORM" | "TENANT";
  roles: string[];
  permissions: string[];
  tenant?: { id: string; name: string; slug: string; status: string; currency: string; institutionType?: string } | null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  fatherName?: string | null;
  nationalId?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  email?: string | null;
  phone?: string | null;
  alternatePhone?: string | null;
  address?: string | null;
  emergencyContact?: string | null;
  status: string;
  employmentType: string;
  basicSalary: string;
  salaryType?: string | null;
  paymentMethod?: string | null;
  joiningDate?: string | null;
  confirmationDate?: string | null;
  contractStart?: string | null;
  contractEnd?: string | null;
  bankName?: string | null;
  accountTitle?: string | null;
  accountNumber?: string | null;
  bankBranchName?: string | null;
  branch?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
  designation?: { id: string; name: string } | null;
}

export interface PayrollRun {
  id: string;
  name: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  payDate?: string | null;
  totalGross: string;
  totalDeductions: string;
  totalNet: string;
  employeeCount: number;
  createdAt: string;
}

export interface Subscription {
  id: string;
  status: string;
  billingPeriod: string;
  renewalDate: string;
  amount: string;
  currency: string;
  plan: {
    id: string;
    name: string;
    key: string;
    monthlyPrice: string;
    yearlyPrice: string;
    employeeLimit: number;
    branchLimit: number;
    userLimit: number;
    features: { key: string; label: string; enabled: boolean }[];
  };
}

export interface Student {
  id: string;
  rollNumber: string;
  fullName: string;
  fatherName: string;
  nationalId: string;
  className: string;
  section?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  branchId?: string | null;
  branch?: { id: string; name: string } | null;
  monthlyFee: string | number;
  status: string;
  createdAt: string;
}

export interface StudentAttendance {
  id: string;
  studentId: string;
  student?: Student;
  date: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY" | "LEAVE";
  remarks?: string | null;
}

export interface StudentFee {
  id: string;
  studentId: string;
  student: Student;
  month: string;
  feeAmount: string | number;
  paidAmount: string | number;
  dueAmount: string | number;
  status: "PENDING" | "PAID" | "PARTIAL";
  paymentMethod?: string | null;
  paidAt?: string | null;
  receiptNumber?: string | null;
  notes?: string | null;
}

export interface StudentFeeSummary {
  totalStudents: number;
  totalExpectedFee: number;
  totalCollectedFee: number;
  totalPendingDues: number;
}
