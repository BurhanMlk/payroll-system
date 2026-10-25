import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  employeeApi,
  getEmployeeToken,
  setEmployeeToken,
  getEmployeeAccounts,
  getEmployeeCredentials,
  clearEmployeeSession,
  InstitutionAccount,
} from "@/lib/employeeApi";
import { errorMessage } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate, initials } from "@/lib/utils";
import { Download, LogOut, FileText, CalendarDays, CalendarClock, Banknote, CreditCard, User, Briefcase, Landmark, Building2 } from "lucide-react";

type SectionKey = "profile" | "payslips" | "attendance" | "leave" | "loans";

const SECTIONS: { key: SectionKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "profile", label: "Personal details", icon: User },
  { key: "payslips", label: "Payslips", icon: FileText },
  { key: "attendance", label: "Attendance", icon: CalendarDays },
  { key: "leave", label: "Leave requests", icon: CalendarClock },
  { key: "loans", label: "Loans & advances", icon: CreditCard },
];

interface Payslip {
  id: string;
  periodStart: string;
  periodEnd: string;
  grossSalary: string;
  totalDeductions: string;
  netSalary: string;
  paymentStatus: string;
  paymentDate: string | null;
}

interface LeaveRequest {
  id: string;
  startDate: string;
  endDate: string;
  days: string;
  reason: string | null;
  status: string;
  leaveType: { name: string; isPaid: boolean };
}

interface Attendance {
  id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
}

interface SelfProfile {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  fatherName: string | null;
  nationalId: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  employmentType: string;
  status: string;
  joiningDate: string | null;
  basicSalary: string;
  salaryType: string;
  paymentMethod: string;
  bankName: string | null;
  accountTitle: string | null;
  accountNumber: string | null;
  department: { name: string } | null;
  designation: { name: string } | null;
  branch: { name: string } | null;
  tenant: { name: string; currency: string };
  payslips: Payslip[];
  loans: { id: string; loanNumber: string; loanAmount: string; remainingBalance: string; status: string }[];
  advances: { id: string; amount: string; remaining: string; issueDate: string; status: string }[];
  leaveRequests: LeaveRequest[];
  attendance: Attendance[];
}

export default function EmployeePortalDashboard() {
  const [data, setData] = useState<SelfProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accounts, setAccounts] = useState<InstitutionAccount[]>([]);
  const [switching, setSwitching] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionKey>("profile");
  const navigate = useNavigate();

  const loadProfile = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await employeeApi.get("/me");
      setData(res.data.data as SelfProfile);
    } catch {
      clearEmployeeSession();
      navigate("/employee");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!getEmployeeToken()) {
      navigate("/employee");
      return;
    }
    setAccounts(getEmployeeAccounts());
    loadProfile();
  }, [navigate]);

  const logout = () => {
    clearEmployeeSession();
    navigate("/employee");
  };

  const switchInstitution = async (employeeId: string) => {
    const creds = getEmployeeCredentials();
    if (!creds) {
      logout();
      return;
    }
    setSwitching(true);
    setError("");
    try {
      const res = await employeeApi.post("/select", {
        cnic: creds.cnic,
        password: creds.password,
        employeeId,
      });
      setEmployeeToken(res.data.data.accessToken);
      setData(null);
      await loadProfile();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSwitching(false);
    }
  };

  const downloadPdf = async (id: string, employeeNumber: string) => {
    const token = getEmployeeToken();
    const res = await fetch(`/api/v1/employee-portal/payslips/${id}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payslip-${employeeNumber}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen p-6">
        <Skeleton className="mb-6 h-20" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="p-8 text-center">
          <p className="font-semibold">Unable to load your profile.</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <Button className="mt-4" onClick={() => navigate("/employee")}>Back to login</Button>
        </Card>
      </div>
    );
  }

  const currency = data.tenant.currency;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="border-b bg-slate-900 text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-lg font-semibold">
            {initials(`${data.firstName} ${data.lastName}`)}
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">{data.firstName} {data.lastName}</h1>
            <p className="text-xs text-slate-300">
              {data.employeeNumber}
              {data.designation ? ` · ${data.designation.name}` : ""}
              {data.department ? ` · ${data.department.name}` : ""}
            </p>
            {accounts.length > 1 && (
              <div className="mt-2 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-slate-300" />
                <select
                  value={data.id}
                  disabled={switching}
                  onChange={(e) => switchInstitution(e.target.value)}
                  className="h-8 max-w-[220px] rounded-md border border-white/20 bg-slate-800 px-2 text-sm text-white outline-none focus:border-indigo-400 disabled:opacity-50"
                >
                  {accounts.map((a) => (
                    <option key={a.employeeId} value={a.employeeId}>
                      {a.tenantName}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold">{data.tenant.name}</p>
            <Badge variant={statusVariant(data.status)}>{data.status.toLowerCase()}</Badge>
          </div>
          <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={logout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {error && (
          <Card className="mb-4 border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </Card>
        )}

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <EmployeeSectionNav active={activeSection} onChange={setActiveSection} />

          <div className="min-w-0 flex-1 space-y-6">
            {/* Personal details (default view) */}
            {activeSection === "profile" && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <SectionCard title="Personal Information" icon={<User className="h-4 w-4" />}>
            <InfoRow label="CNIC" value={data.nationalId ?? "—"} />
            <InfoRow label="Father name" value={data.fatherName ?? "—"} />
            <InfoRow label="Phone" value={data.phone ?? "—"} />
            <InfoRow label="Email" value={data.email ?? "—"} />
            <InfoRow label="Address" value={data.address ?? "—"} />
          </SectionCard>

          <SectionCard title="Employment" icon={<Briefcase className="h-4 w-4" />}>
            <InfoRow label="Employee number" value={data.employeeNumber} />
            <InfoRow label="Branch" value={data.branch?.name ?? "—"} />
            <InfoRow label="Department" value={data.department?.name ?? "—"} />
            <InfoRow label="Designation" value={data.designation?.name ?? "—"} />
            <InfoRow label="Joining date" value={formatDate(data.joiningDate)} />
            <InfoRow label="Type" value={data.employmentType.toLowerCase().replace("_", " ")} />
          </SectionCard>

          <SectionCard title="Salary & Banking" icon={<Landmark className="h-4 w-4" />}>
            <InfoRow label="Basic salary" value={formatCurrency(data.basicSalary, currency)} />
            <InfoRow label="Salary type" value={data.salaryType} />
            <InfoRow label="Payment method" value={data.paymentMethod.replace("_", " ")} />
            <InfoRow label="Bank" value={data.bankName ?? "—"} />
            <InfoRow label="Account" value={data.accountNumber ?? "—"} />
          </SectionCard>
              </div>
            )}

            {activeSection === "payslips" && (
              <SectionTable title="My Payslips" icon={<FileText className="h-4 w-4" />}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Gross</TableHead>
                <TableHead>Deductions</TableHead>
                <TableHead>Net</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Download</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.payslips.length === 0 ? (
                <EmptyRow colSpan={6} text="No payslips yet" />
              ) : (
                data.payslips.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-muted-foreground">{formatDate(p.periodStart)} → {formatDate(p.periodEnd)}</TableCell>
                    <TableCell>{formatCurrency(p.grossSalary, currency)}</TableCell>
                    <TableCell className="text-red-600">-{formatCurrency(p.totalDeductions, currency)}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(p.netSalary, currency)}</TableCell>
                    <TableCell><Badge variant={statusVariant(p.paymentStatus)}>{p.paymentStatus.toLowerCase()}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => downloadPdf(p.id, data.employeeNumber)}>
                        <Download className="h-4 w-4" /> PDF
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
              </SectionTable>
            )}

            {activeSection === "attendance" && (
              <SectionTable title="My Attendance" icon={<CalendarDays className="h-4 w-4" />}>
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
              {data.attendance.length === 0 ? (
                <EmptyRow colSpan={4} text="No attendance records" />
              ) : (
                data.attendance.map((a) => (
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
            )}

            {activeSection === "leave" && (
              <SectionTable title="My Leave Requests" icon={<CalendarClock className="h-4 w-4" />}>
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
              {data.leaveRequests.length === 0 ? (
                <EmptyRow colSpan={4} text="No leave requests" />
              ) : (
                data.leaveRequests.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.leaveType.name}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(l.startDate)} → {formatDate(l.endDate)}</TableCell>
                    <TableCell>{l.days}</TableCell>
                    <TableCell><Badge variant={statusVariant(l.status)}>{l.status.toLowerCase()}</Badge></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
              </SectionTable>
            )}

            {activeSection === "loans" && (
              <div className="grid gap-4 lg:grid-cols-2">
          <SectionTable title="My Loans" icon={<CreditCard className="h-4 w-4" />}>
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
                {data.loans.length === 0 ? (
                  <EmptyRow colSpan={4} text="No loans" />
                ) : (
                  data.loans.map((l) => (
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

          <SectionTable title="My Advances" icon={<Banknote className="h-4 w-4" />}>
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
                {data.advances.length === 0 ? (
                  <EmptyRow colSpan={4} text="No advances" />
                ) : (
                  data.advances.map((a) => (
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
            )}
          </div>
        </div>
      </main>
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

function EmployeeSectionNav({ active, onChange }: { active: SectionKey; onChange: (key: SectionKey) => void }) {
  return (
    <nav className="lg:w-56 lg:shrink-0">
      <div className="flex gap-1 overflow-x-auto rounded-lg border bg-white p-1 shadow-sm lg:flex-col lg:overflow-visible">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const isActive = section.key === active;
          return (
            <button
              key={section.key}
              type="button"
              onClick={() => onChange(section.key)}
              aria-current={isActive ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors lg:w-full ${
                isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{section.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
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
