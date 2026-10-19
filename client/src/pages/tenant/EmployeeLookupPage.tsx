import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, errorMessage } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, formatDate, initials } from "@/lib/utils";
import {
  Search,
  User,
  Briefcase,
  Landmark,
  Banknote,
  FileText,
  CreditCard,
  CalendarDays,
  SearchX,
} from "lucide-react";

function formatCnic(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 13);
  const parts = [digits.slice(0, 5), digits.slice(5, 12), digits.slice(12, 13)];
  return parts.filter(Boolean).join("-");
}

interface PortalSalaryStructure {
  id: string;
  basicSalary: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  template?: { name: string } | null;
  components?: unknown;
}

interface PortalPayslip {
  id: string;
  periodStart: string;
  periodEnd: string;
  grossSalary: string;
  totalDeductions: string;
  netSalary: string;
  paymentStatus: string;
  paymentDate?: string | null;
  createdAt: string;
}

interface PortalLoan {
  id: string;
  loanNumber: string;
  loanAmount: string;
  approvedAmount: string;
  issueDate: string;
  installmentAmount: string;
  remainingBalance: string;
  status: string;
}

interface PortalAdvance {
  id: string;
  amount: string;
  remaining: string;
  issueDate: string;
  installmentAmount: string;
  status: string;
}

interface PortalLeaveRequest {
  id: string;
  startDate: string;
  endDate: string;
  days: string;
  reason?: string | null;
  status: string;
  leaveType: { name: string; isPaid: boolean };
}

interface PortalAttendance {
  id: string;
  date: string;
  checkIn?: string | null;
  checkOut?: string | null;
  workHours?: string | null;
  status: string;
}

interface PortalEmployee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  fatherName?: string | null;
  nationalId?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  phone?: string | null;
  alternatePhone?: string | null;
  email?: string | null;
  address?: string | null;
  emergencyContact?: string | null;
  employmentType: string;
  status: string;
  joiningDate?: string | null;
  confirmationDate?: string | null;
  contractStart?: string | null;
  contractEnd?: string | null;
  bankName?: string | null;
  accountTitle?: string | null;
  accountNumber?: string | null;
  bankBranchName?: string | null;
  basicSalary: string;
  salaryType: string;
  paymentMethod: string;
  branch?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
  designation?: { id: string; name: string } | null;
  user?: { id: string; email: string; fullName: string; status: string } | null;
  salaryStructures: PortalSalaryStructure[];
  payslips: PortalPayslip[];
  loans: PortalLoan[];
  advances: PortalAdvance[];
  leaveRequests: PortalLeaveRequest[];
  attendance: PortalAttendance[];
}

export default function EmployeeLookupPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const currency = user?.tenant?.currency ?? "USD";

  const [input, setInput] = useState("");
  const [submittedCnic, setSubmittedCnic] = useState("");

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["employee-portal", submittedCnic],
    enabled: Boolean(submittedCnic),
    queryFn: async () => {
      const res = await api.get(`/employees/by-cnic/${encodeURIComponent(submittedCnic)}`);
      return res.data.data as PortalEmployee;
    },
    retry: false,
  });

  const submit = () => {
    const digits = input.replace(/\D/g, "");
    if (digits.length !== 13) {
      toast({ title: "Invalid CNIC", description: "CNIC must be 13 digits (e.g. 12345-1234567-1).", variant: "destructive" });
      return;
    }
    setSubmittedCnic(formatCnic(digits));
  };

  const employee = data;

  return (
    <div>
      <PageHeader
        title="Employee Lookup"
        description="Enter an employee's CNIC to view their complete record — from personal details to payroll"
      />

      <Card className="mb-6 p-4">
        <Label className="mb-2 block text-sm font-medium">CNIC Number</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="12345-1234567-1"
              maxLength={15}
              value={input}
              onChange={(e) => setInput(formatCnic(e.target.value))}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>
          <Button onClick={submit} disabled={isLoading}>
            <Search className="h-4 w-4" /> {isLoading ? "Searching…" : "Search"}
          </Button>
        </div>
      </Card>

      {!submittedCnic ? (
        <EmptyState />
      ) : isLoading ? (
        <LoadingState />
      ) : isError ? (
        <NotFoundState message={errorMessage(error)} onRetry={refetch} />
      ) : employee ? (
        <EmployeeProfile employee={employee} currency={currency} />
      ) : null}
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="flex flex-col items-center justify-center py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
        <User className="h-7 w-7 text-primary" />
      </div>
      <p className="mt-4 text-lg font-semibold">Search an employee by CNIC</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Enter the 13-digit CNIC above to pull up the employee's information, employment, payroll history, payslips, loans, leave and attendance.
      </p>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-14 w-14 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    </div>
  );
}

function NotFoundState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="flex flex-col items-center justify-center py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
        <SearchX className="h-7 w-7 text-destructive" />
      </div>
      <p className="mt-4 text-lg font-semibold">No employee found</p>
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
        Try again
      </Button>
    </Card>
  );
}

function EmployeeProfile({ employee, currency }: { employee: PortalEmployee; currency: string }) {
  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-xl font-semibold text-white">
            {initials(`${employee.firstName} ${employee.lastName}`)}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold">
              {employee.firstName} {employee.lastName}
            </h2>
            <p className="text-sm text-muted-foreground">
              {employee.employeeNumber}
              {employee.designation ? ` · ${employee.designation.name}` : ""}
              {employee.department ? ` · ${employee.department.name}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={statusVariant(employee.status)}>{employee.status.toLowerCase()}</Badge>
            <Badge variant="outline">{employee.employmentType.toLowerCase().replace("_", " ")}</Badge>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard title="Personal Information" icon={<User className="h-4 w-4" />}>
          <InfoRow label="CNIC" value={employee.nationalId ?? "—"} />
          <InfoRow label="Father name" value={employee.fatherName ?? "—"} />
          <InfoRow label="Date of birth" value={formatDate(employee.dateOfBirth)} />
          <InfoRow label="Gender" value={employee.gender ? employee.gender.toLowerCase() : "—"} />
          <InfoRow label="Phone" value={employee.phone ?? "—"} />
          <InfoRow label="Email" value={employee.email ?? "—"} />
          <InfoRow label="Address" value={employee.address ?? "—"} />
          <InfoRow label="Emergency contact" value={employee.emergencyContact ?? "—"} />
        </SectionCard>

        <SectionCard title="Employment" icon={<Briefcase className="h-4 w-4" />}>
          <InfoRow label="Employee number" value={employee.employeeNumber} />
          <InfoRow label="Branch" value={employee.branch?.name ?? "—"} />
          <InfoRow label="Department" value={employee.department?.name ?? "—"} />
          <InfoRow label="Designation" value={employee.designation?.name ?? "—"} />
          <InfoRow label="Employment type" value={employee.employmentType.toLowerCase().replace("_", " ")} />
          <InfoRow label="Joining date" value={formatDate(employee.joiningDate)} />
        </SectionCard>

        <SectionCard title="Banking" icon={<Landmark className="h-4 w-4" />}>
          <InfoRow label="Bank name" value={employee.bankName ?? "—"} />
          <InfoRow label="Account title" value={employee.accountTitle ?? "—"} />
          <InfoRow label="Account number" value={employee.accountNumber ?? "—"} />
        </SectionCard>

        <SectionCard title="Payroll" icon={<Banknote className="h-4 w-4" />}>
          <InfoRow label="Basic salary" value={formatCurrency(employee.basicSalary, currency)} />
          <InfoRow label="Salary type" value={employee.salaryType} />
          <InfoRow label="Payment method" value={employee.paymentMethod.replace("_", " ")} />
          {employee.salaryStructures[0] && (
            <InfoRow
              label="Effective from"
              value={formatDate(employee.salaryStructures[0].effectiveFrom)}
            />
          )}
        </SectionCard>
      </div>

      <SectionTable title="Payslips" icon={<FileText className="h-4 w-4" />}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead>Gross</TableHead>
              <TableHead>Deductions</TableHead>
              <TableHead>Net</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employee.payslips.length === 0 ? (
              <EmptyRow colSpan={6} text="No payslips yet" />
            ) : (
              employee.payslips.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-muted-foreground">
                    {formatDate(p.periodStart)} → {formatDate(p.periodEnd)}
                  </TableCell>
                  <TableCell>{formatCurrency(p.grossSalary, currency)}</TableCell>
                  <TableCell className="text-red-600">-{formatCurrency(p.totalDeductions, currency)}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(p.netSalary, currency)}</TableCell>
                  <TableCell><Badge variant={statusVariant(p.paymentStatus)}>{p.paymentStatus.toLowerCase()}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(p.paymentDate)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </SectionTable>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionTable title="Loans" icon={<CreditCard className="h-4 w-4" />}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loan #</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Remaining</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employee.loans.length === 0 ? (
                <EmptyRow colSpan={4} text="No loans" />
              ) : (
                employee.loans.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.loanNumber}</TableCell>
                    <TableCell>{formatCurrency(l.loanAmount, currency)}</TableCell>
                    <TableCell>{formatCurrency(l.remainingBalance, currency)}</TableCell>
                    <TableCell><Badge variant={statusVariant(l.status)}>{l.status.toLowerCase()}</Badge></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </SectionTable>

        <SectionTable title="Advances" icon={<Banknote className="h-4 w-4" />}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Remaining</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employee.advances.length === 0 ? (
                <EmptyRow colSpan={4} text="No advances" />
              ) : (
                employee.advances.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-muted-foreground">{formatDate(a.issueDate)}</TableCell>
                    <TableCell>{formatCurrency(a.amount, currency)}</TableCell>
                    <TableCell>{formatCurrency(a.remaining, currency)}</TableCell>
                    <TableCell><Badge variant={statusVariant(a.status)}>{a.status.toLowerCase()}</Badge></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </SectionTable>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionTable title="Leave Requests" icon={<CalendarDays className="h-4 w-4" />}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employee.leaveRequests.length === 0 ? (
                <EmptyRow colSpan={4} text="No leave requests" />
              ) : (
                employee.leaveRequests.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.leaveType.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(l.startDate)} → {formatDate(l.endDate)}
                    </TableCell>
                    <TableCell>{l.days}</TableCell>
                    <TableCell><Badge variant={statusVariant(l.status)}>{l.status.toLowerCase()}</Badge></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </SectionTable>

        <SectionTable title="Recent Attendance" icon={<CalendarDays className="h-4 w-4" />}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Check in</TableHead>
                <TableHead>Check out</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employee.attendance.length === 0 ? (
                <EmptyRow colSpan={4} text="No attendance records" />
              ) : (
                employee.attendance.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-muted-foreground">{formatDate(a.date)}</TableCell>
                    <TableCell>{a.checkIn ? new Date(a.checkIn).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "—"}</TableCell>
                    <TableCell>{a.checkOut ? new Date(a.checkOut).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "—"}</TableCell>
                    <TableCell><Badge variant={statusVariant(a.status)}>{a.status.toLowerCase().replace("_", " ")}</Badge></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </SectionTable>
      </div>
    </div>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2 border-b pb-2">
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="space-y-2">{children}</div>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function SectionTable({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b px-5 py-3">
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {children}
    </Card>
  );
}

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-8 text-center text-muted-foreground">
        {text}
      </TableCell>
    </TableRow>
  );
}
