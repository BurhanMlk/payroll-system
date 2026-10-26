import { useEffect, useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { formatCurrency, formatDate, initials } from "@/lib/utils";
import { Download, LogOut, FileText, CalendarDays, CalendarClock, Banknote, CreditCard, User, Briefcase, Landmark, Building2, Menu, Send } from "lucide-react";

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
  const { toast } = useToast();
  const [data, setData] = useState<SelfProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accounts, setAccounts] = useState<InstitutionAccount[]>([]);
  const [switching, setSwitching] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionKey>("profile");
  const [attendanceMonth, setAttendanceMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ leaveTypeId: "", startDate: "", endDate: "", reason: "" });
  const navigate = useNavigate();

  const monthlyAttendance = useQuery({
    queryKey: ["employee-attendance", attendanceMonth],
    enabled: activeSection === "attendance",
    queryFn: async () => {
      const res = await employeeApi.get("/attendance", { params: { month: attendanceMonth } });
      return res.data.data as Attendance[];
    },
  });

  const leaveTypes = useQuery({
    queryKey: ["employee-leave-types"],
    enabled: activeSection === "leave",
    queryFn: async () => {
      const res = await employeeApi.get("/leaves/types");
      return res.data.data as { id: string; name: string; isPaid: boolean }[];
    },
  });

  const submitLeave = useMutation({
    mutationFn: () => employeeApi.post("/leaves", leaveForm),
    onSuccess: () => {
      setLeaveForm({ leaveTypeId: "", startDate: "", endDate: "", reason: "" });
      loadProfile();
      toast({ title: "Leave request submitted", variant: "success" });
    },
    onError: (err) => toast({ title: "Leave request failed", description: errorMessage(err), variant: "destructive" }),
  });

  const submitLeaveForm = (e: FormEvent) => {
    e.preventDefault();
    if (!leaveForm.leaveTypeId || !leaveForm.startDate || !leaveForm.endDate) {
      toast({ title: "Missing fields", description: "Select leave type, start date and end date.", variant: "destructive" });
      return;
    }
    submitLeave.mutate();
  };

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
    try {
      const res = await employeeApi.get(`/payslips/${id}/pdf`, { responseType: "blob" });
      const blob = res.data as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payslip-${employeeNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(errorMessage(err, "Unable to download payslip PDF."));
    }
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
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950 text-slate-200 lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-slate-800 px-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-sm font-semibold text-white">
            {initials(`${data.firstName} ${data.lastName}`)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{data.firstName} {data.lastName}</p>
            <p className="truncate text-xs text-slate-400">{data.employeeNumber}</p>
          </div>
        </div>

        <EmployeeSectionNav active={activeSection} onChange={setActiveSection} />

        <div className="border-t border-slate-800 p-3">
          {accounts.length > 1 && (
            <div className="mb-2 flex items-center gap-2">
              <Building2 className="h-4 w-4 shrink-0 text-slate-300" />
              <select
                value={data.id}
                disabled={switching}
                onChange={(e) => switchInstitution(e.target.value)}
                className="h-8 w-full min-w-0 rounded-md border border-white/20 bg-slate-800 px-2 text-sm text-white outline-none focus:border-indigo-400 disabled:opacity-50"
              >
                {accounts.map((a) => (
                  <option key={a.employeeId} value={a.employeeId}>
                    {a.tenantName}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="mb-2 flex items-center justify-between gap-2 text-xs text-slate-300">
            <span className="truncate">{data.tenant.name}</span>
            <Badge variant={statusVariant(data.status)}>{data.status.toLowerCase()}</Badge>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start text-white hover:bg-white/10" onClick={logout}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header className="flex h-14 items-center gap-3 border-b bg-white px-4 lg:hidden">
          <button type="button" onClick={() => setMobileNavOpen((v) => !v)} className="rounded-md p-1 hover:bg-accent" aria-label="Menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1 truncate text-sm font-semibold">
            {data.firstName} {data.lastName} · {data.tenant.name}
          </div>
          <Badge variant={statusVariant(data.status)}>{data.status.toLowerCase()}</Badge>
        </header>

        {mobileNavOpen && (
          <div className="border-b bg-white px-4 py-2 lg:hidden">
            <div className="flex gap-1 overflow-x-auto">
              {SECTIONS.map((section) => (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => { setActiveSection(section.key); setMobileNavOpen(false); }}
                  className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    activeSection === section.key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {section.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <main className="flex-1 overflow-x-hidden p-4 lg:p-8">
          {error && (
            <Card className="mb-4 border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </Card>
          )}

          <div className="min-w-0 space-y-6">
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
                <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
                  <p className="text-xs text-muted-foreground">Monthly attendance record</p>
                  <Input
                    type="month"
                    value={attendanceMonth}
                    onChange={(e) => setAttendanceMonth(e.target.value)}
                    className="w-44"
                  />
                </div>
                {monthlyAttendance.isLoading ? (
                  <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
                ) : (
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
                      {(monthlyAttendance.data ?? data.attendance).length === 0 ? (
                        <EmptyRow colSpan={4} text="No attendance records for this month" />
                      ) : (
                        (monthlyAttendance.data ?? data.attendance).map((a) => (
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
                )}
              </SectionTable>
            )}

            {activeSection === "leave" && (
              <div className="space-y-6">
                <SectionTable title="Apply for Leave" icon={<CalendarClock className="h-4 w-4" />}>
                  <form onSubmit={submitLeaveForm} className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-5">
                    <div className="space-y-1.5">
                      <p className="text-sm font-medium">Leave type *</p>
                      <select
                        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                        value={leaveForm.leaveTypeId}
                        onChange={(e) => setLeaveForm({ ...leaveForm, leaveTypeId: e.target.value })}
                      >
                        <option value="">Select type</option>
                        {(leaveTypes.data ?? []).map((t) => (
                          <option key={t.id} value={t.id}>{t.name}{t.isPaid ? " (paid)" : " (unpaid)"}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-sm font-medium">Start date *</p>
                      <Input type="date" value={leaveForm.startDate} onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-sm font-medium">End date *</p>
                      <Input type="date" value={leaveForm.endDate} onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })} />
                    </div>
                    <div className="space-y-1.5 lg:col-span-2">
                      <p className="text-sm font-medium">Reason</p>
                      <Input placeholder="Reason for leave" value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} />
                    </div>
                    <div className="flex items-end lg:col-span-5">
                      <Button type="submit" disabled={submitLeave.isPending}>
                        <Send className="h-4 w-4" /> {submitLeave.isPending ? "Submitting…" : "Submit Leave Request"}
                      </Button>
                    </div>
                  </form>
                </SectionTable>

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
              </div>
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
        </main>
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

function EmployeeSectionNav({ active, onChange }: { active: SectionKey; onChange: (key: SectionKey) => void }) {
  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
      {SECTIONS.map((section) => {
        const Icon = section.icon;
        const isActive = section.key === active;
        return (
          <button
            key={section.key}
            type="button"
            onClick={() => onChange(section.key)}
            aria-current={isActive ? "page" : undefined}
            className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all ${
              isActive
                ? "bg-gradient-to-r from-indigo-500 to-blue-600 text-white shadow-md shadow-indigo-900/40"
                : "text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Icon className="h-4 w-4" />
            <span>{section.label}</span>
          </button>
        );
      })}
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
