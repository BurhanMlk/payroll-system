import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { studentApi, clearStudentSession, getStudentToken } from "@/lib/studentApi";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import Logo from "@/components/Logo";
import {
  GraduationCap,
  CreditCard,
  CalendarCheck,
  User,
  LogOut,
  Receipt,
  AlertCircle,
  TrendingUp,
  CheckCircle2,
  Clock,
  Phone,
  Home,
  School,
} from "lucide-react";

interface StudentPortalData {
  student: {
    id: string;
    rollNumber: string;
    fullName: string;
    fatherName: string;
    nationalId: string;
    className: string;
    section: string | null;
    monthlyFee: number;
    phone: string | null;
    email: string | null;
    address: string | null;
    gender: string | null;
    dateOfBirth: string | null;
    tenant: {
      id: string;
      name: string;
      currency: string;
      address: string | null;
      phone: string | null;
    };
    branch: {
      name: string;
      code: string;
    } | null;
  };
  stats: {
    totalExpected: number;
    totalPaid: number;
    totalDue: number;
    totalAttendanceDays: number;
    presentCount: number;
    absentCount: number;
    leaveCount: number;
    attendancePercentage: number;
  };
}

export default function StudentPortalDashboard() {
  const [tab, setTab] = useState<"fees" | "attendance" | "profile">("fees");
  const navigate = useNavigate();

  const token = getStudentToken();
  if (!token) {
    navigate("/student");
  }

  const { data, isLoading } = useQuery({
    queryKey: ["student-portal-me"],
    queryFn: async () => {
      const res = await studentApi.get("/me");
      return res.data.data as StudentPortalData;
    },
  });

  const { data: feesList, isLoading: feesLoading } = useQuery({
    queryKey: ["student-portal-fees"],
    queryFn: async () => {
      const res = await studentApi.get("/fees");
      return res.data.data as {
        id: string;
        month: string;
        feeAmount: number;
        paidAmount: number;
        dueAmount: number;
        status: string;
        paymentMethod: string | null;
        paidAt: string | null;
        receiptNumber: string | null;
        notes: string | null;
      }[];
    },
  });

  const { data: attendanceList, isLoading: attLoading } = useQuery({
    queryKey: ["student-portal-attendance"],
    queryFn: async () => {
      const res = await studentApi.get("/attendance");
      return res.data.data as {
        id: string;
        date: string;
        status: string;
        remarks: string | null;
      }[];
    },
  });

  const handleLogout = () => {
    clearStudentSession();
    navigate("/student");
  };

  if (isLoading || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>
    );
  }

  const { student, stats } = data;
  const currency = student.tenant.currency || "PKR";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12">
      {/* Top Navigation */}
      <header className="border-b bg-white sticky top-0 z-30 shadow-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">{student.tenant.name}</p>
              <p className="text-xs text-muted-foreground">Student Self-Service Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-xs font-bold text-slate-800">{student.fullName}</p>
              <p className="text-[11px] text-muted-foreground">
                {student.rollNumber} · {student.className} {student.section && `(${student.section})`}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-xs text-slate-600 gap-1.5">
              <LogOut className="h-3.5 w-3.5" /> Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-6xl px-4 sm:px-6 pt-6">
        {/* Student Banner */}
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-indigo-700 via-indigo-600 to-blue-600 p-6 text-white shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium uppercase tracking-wider text-indigo-100">
                {student.className} {student.section && `· Section ${student.section}`}
              </span>
              <h1 className="mt-2 text-2xl font-extrabold">{student.fullName}</h1>
              <p className="text-sm text-indigo-100 mt-0.5">
                Father: {student.fatherName} · B-Form: {student.nationalId} · Roll No: {student.rollNumber}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xs text-indigo-200">Monthly Tuition Fee</p>
              <p className="text-2xl font-extrabold">{formatCurrency(student.monthlyFee, currency)}</p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-6 flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setTab("fees")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
              tab === "fees"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                : "text-slate-600 hover:bg-slate-200/60"
            }`}
          >
            <CreditCard className="h-4 w-4" /> Fee Records & Receipts
          </button>
          <button
            onClick={() => setTab("attendance")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
              tab === "attendance"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                : "text-slate-600 hover:bg-slate-200/60"
            }`}
          >
            <CalendarCheck className="h-4 w-4" /> Attendance ({stats.attendancePercentage}%)
          </button>
          <button
            onClick={() => setTab("profile")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
              tab === "profile"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                : "text-slate-600 hover:bg-slate-200/60"
            }`}
          >
            <User className="h-4 w-4" /> Profile Details
          </button>
        </div>

        {/* Tab 1: Fees */}
        {tab === "fees" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Card className="p-4 bg-white shadow-sm border-slate-200">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Total Fees Billed</p>
                <p className="mt-1 text-2xl font-extrabold text-slate-800">
                  {formatCurrency(stats.totalExpected, currency)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Sum of all monthly fees</p>
              </Card>

              <Card className="p-4 bg-emerald-50/40 border-emerald-100 shadow-sm">
                <p className="text-xs font-semibold text-emerald-800 uppercase">Total Paid</p>
                <p className="mt-1 text-2xl font-extrabold text-emerald-700">
                  {formatCurrency(stats.totalPaid, currency)}
                </p>
                <p className="text-[11px] text-emerald-700/80 mt-0.5">Fees cleared to date</p>
              </Card>

              <Card className="p-4 bg-red-50/40 border-red-100 shadow-sm">
                <p className="text-xs font-semibold text-red-800 uppercase">Outstanding Dues</p>
                <p className="mt-1 text-2xl font-extrabold text-red-700">
                  {formatCurrency(stats.totalDue, currency)}
                </p>
                <p className="text-[11px] text-red-700/80 mt-0.5">Pending balance</p>
              </Card>
            </div>

            <Card className="overflow-hidden">
              <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">Monthly Fee Slips & History</h3>
                <span className="text-xs text-muted-foreground">Updated in real-time by school account</span>
              </div>
              {feesLoading ? (
                <div className="p-4 space-y-2">
                  <Skeleton className="h-8" />
                  <Skeleton className="h-8" />
                </div>
              ) : (feesList?.length ?? 0) === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No monthly fee records generated yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead>Fee Amount</TableHead>
                      <TableHead>Paid Amount</TableHead>
                      <TableHead>Due Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Receipt No</TableHead>
                      <TableHead>Payment Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {feesList?.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-semibold text-slate-800">{f.month}</TableCell>
                        <TableCell>{formatCurrency(f.feeAmount, currency)}</TableCell>
                        <TableCell className="text-emerald-700 font-semibold">{formatCurrency(f.paidAmount, currency)}</TableCell>
                        <TableCell className="text-red-600 font-bold">{formatCurrency(f.dueAmount, currency)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              f.status === "PAID"
                                ? "success"
                                : f.status === "PARTIAL"
                                ? "warning"
                                : "destructive"
                            }
                          >
                            {f.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{f.receiptNumber || "—"}</TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {f.paidAt ? new Date(f.paidAt).toLocaleDateString() : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </div>
        )}

        {/* Tab 2: Attendance */}
        {tab === "attendance" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card className="p-4 bg-white shadow-sm">
                <p className="text-xs text-muted-foreground">Total Recorded Days</p>
                <p className="mt-1 text-2xl font-bold">{stats.totalAttendanceDays}</p>
              </Card>
              <Card className="p-4 bg-emerald-50/50 border-emerald-100 shadow-sm">
                <p className="text-xs text-emerald-800">Days Present</p>
                <p className="mt-1 text-2xl font-bold text-emerald-700">{stats.presentCount}</p>
              </Card>
              <Card className="p-4 bg-red-50/50 border-red-100 shadow-sm">
                <p className="text-xs text-red-800">Days Absent</p>
                <p className="mt-1 text-2xl font-bold text-red-700">{stats.absentCount}</p>
              </Card>
              <Card className="p-4 bg-amber-50/50 border-amber-100 shadow-sm">
                <p className="text-xs text-amber-800">Approved Leaves</p>
                <p className="mt-1 text-2xl font-bold text-amber-700">{stats.leaveCount}</p>
              </Card>
            </div>

            <Card className="overflow-hidden">
              <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">Daily Attendance Logs</h3>
                <Badge variant="outline" className="text-xs">
                  {stats.attendancePercentage}% Overall Attendance
                </Badge>
              </div>
              {attLoading ? (
                <div className="p-4 space-y-2">
                  <Skeleton className="h-8" />
                  <Skeleton className="h-8" />
                </div>
              ) : (attendanceList?.length ?? 0) === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No attendance records logged yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceList?.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">
                          {new Date(a.date).toLocaleDateString(undefined, {
                            weekday: "short",
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              a.status === "PRESENT"
                                ? "success"
                                : a.status === "ABSENT"
                                ? "destructive"
                                : a.status === "LATE"
                                ? "warning"
                                : "outline"
                            }
                          >
                            {a.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">{a.remarks || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </div>
        )}

        {/* Tab 3: Profile */}
        {tab === "profile" && (
          <Card className="p-6">
            <h3 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b">
              Student Information & Enrollment
            </h3>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Full Name</p>
                <p className="font-semibold text-slate-900">{student.fullName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Father / Guardian Name</p>
                <p className="font-semibold text-slate-900">{student.fatherName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">B-Form / CNIC</p>
                <p className="font-mono font-medium text-slate-900">{student.nationalId}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Roll Number</p>
                <p className="font-mono font-semibold text-indigo-700">{student.rollNumber}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Enrolled Class</p>
                <p className="font-semibold text-slate-900">
                  {student.className} {student.section && `· Section ${student.section}`}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Contact Phone</p>
                <p className="font-medium text-slate-900">{student.phone || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Residential Address</p>
                <p className="font-medium text-slate-900">{student.address || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Branch / Campus</p>
                <p className="font-medium text-slate-900">{student.branch?.name || "Main Campus"}</p>
              </div>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}

