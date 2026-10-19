export interface User {
  id: string;
  email: string;
  fullName: string;
  tenantId: string | null;
  scope: "PLATFORM" | "TENANT";
  roles: string[];
  permissions: string[];
  tenant?: { id: string; name: string; slug: string; status: string; currency: string } | null;
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
