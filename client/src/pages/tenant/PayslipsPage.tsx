import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Download, FileText, Search, DollarSign, Send } from "lucide-react";

interface Payslip {
  id: string;
  grossSalary: string;
  totalDeductions: string;
  netSalary: string;
  paymentStatus: string;
  paymentDate: string | null;
  periodStart: string;
  employee: { id: string; employeeNumber: string; firstName: string; lastName: string; department?: { name: string } | null };
}

interface EmployeeOption {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
}

export default function PayslipsPage() {
  const { user, hasPermission } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const currency = user?.tenant?.currency ?? "USD";
  const [search, setSearch] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOption | null>(null);
  const [month, setMonth] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["payslips"],
    queryFn: async () => {
      const res = await api.get("/payroll/payslips/list", { params: { limit: 200 } });
      return res.data.data as Payslip[];
    },
  });

  const markPaidSingle = useMutation({
    mutationFn: (id: string) => api.post(`/payroll/payslips/${id}/mark-paid`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["payslips"] });
      qc.invalidateQueries({ queryKey: ["salaries-overview"] });
      qc.invalidateQueries({ queryKey: ["payroll-runs"] });
      const emailSent = res.data.data?.emailSent;
      toast({
        title: "Salary Paid",
        description: emailSent
          ? "Payment marked and payslip emailed to employee."
          : "Payment marked. (Email skipped or SMTP not configured).",
        variant: "success",
      });
    },
    onError: (err) => toast({ title: "Failed", description: errorMessage(err), variant: "destructive" }),
  });

  const emailSingle = useMutation({
    mutationFn: (id: string) => api.post(`/payroll/payslips/${id}/email`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payslips"] });
      toast({ title: "Payslip Emailed", description: "Payslip PDF and portal login credentials sent to employee.", variant: "success" });
    },
    onError: (err) => toast({ title: "Failed to email", description: errorMessage(err), variant: "destructive" }),
  });

  const markAllPaid = useMutation({
    mutationFn: () => api.post(`/payroll/payslips/mark-all-paid`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["payslips"] });
      qc.invalidateQueries({ queryKey: ["payroll-runs"] });
      qc.invalidateQueries({ queryKey: ["salaries-overview"] });
      toast({
        title: "All Payslips Paid & Emailed",
        description: `Marked ${res.data.data?.paidCount ?? 0} payslips as paid and dispatched emails to all employees.`,
        variant: "success",
      });
    },
    onError: (err) => toast({ title: "Bulk action failed", description: errorMessage(err), variant: "destructive" }),
  });

  const searchEmployee = useMutation({
    mutationFn: async () => {
      const res = await api.get("/employees", { params: { search, limit: 5 } });
      return res.data.data as EmployeeOption[];
    },
    onSuccess: (employees) => {
      if (employees.length === 0) {
        setEmployeeId("");
        setSelectedEmployee(null);
        toast({ title: "Employee not found", description: "No employee matches this ID or name.", variant: "destructive" });
        return;
      }
      setEmployeeId(employees[0].id);
      setSelectedEmployee(employees[0]);
    },
    onError: (err) => toast({ title: "Search failed", description: errorMessage(err), variant: "destructive" }),
  });

  const filtered = (data ?? []).filter((p) => {
    if (employeeId && p.employee.id !== employeeId) return false;
    if (month && p.periodStart.slice(0, 7) !== month) return false;
    return true;
  });

  const downloadCsv = () => {
    const headers = ["Employee Number", "Employee Name", "Department", "Period", "Gross", "Deductions", "Net", "Status"];
    const rows = filtered.map((p) => [
      p.employee.employeeNumber,
      `${p.employee.firstName} ${p.employee.lastName}`,
      p.employee.department?.name ?? "",
      formatDate(p.periodStart),
      p.grossSalary,
      p.totalDeductions,
      p.netSalary,
      p.paymentStatus,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "payslips.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = async (id: string, employeeNumber: string) => {
    try {
      const res = await api.get(`/payroll/payslips/${id}/pdf`, { responseType: "blob" });
      const blob = res.data as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payslip-${employeeNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({ title: "Download failed", description: errorMessage(err, "Unable to download payslip PDF."), variant: "destructive" });
    }
  };

  return (
    <div>
      <PageHeader
        title="Payslips"
        description="View, pay, and email employee payslips"
        actions={
          hasPermission("payroll.mark_paid") ? (
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm"
              onClick={() => {
                if (window.confirm("Are you sure you want to mark ALL unpaid payslips as PAID and email every employee?")) {
                  markAllPaid.mutate();
                }
              }}
              disabled={markAllPaid.isPending}
            >
              <DollarSign className="h-4 w-4" />
              {markAllPaid.isPending ? "Processing..." : "Mark All Paid & Email All"}
            </Button>
          ) : undefined
        }
      />

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>Employee ID or name</Label>
            <div className="flex gap-2">
              <Input placeholder="Search employee" value={search} onChange={(e) => { setSearch(e.target.value); setEmployeeId(""); setSelectedEmployee(null); }} />
              <Button type="button" size="sm" variant="outline" onClick={() => searchEmployee.mutate()} disabled={!search || searchEmployee.isPending}>
                <Search className="h-4 w-4" /> Search
              </Button>
              {selectedEmployee && (
                <Button type="button" size="sm" variant="ghost" onClick={() => { setSearch(""); setEmployeeId(""); setSelectedEmployee(null); }}>
                  Clear
                </Button>
              )}
            </div>
            {selectedEmployee && (
              <p className="text-xs text-emerald-600">
                {selectedEmployee.firstName} {selectedEmployee.lastName} ({selectedEmployee.employeeNumber})
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Month</Label>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />
          </div>
          <div className="flex items-end">
            <Button type="button" size="sm" variant="outline" onClick={downloadCsv} disabled={filtered.length === 0}>
              <Download className="h-4 w-4" /> CSV
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            <FileText className="mx-auto mb-3 h-10 w-10 opacity-50" />
            <p className="font-medium">No payslips found</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Gross</TableHead>
                <TableHead>Deductions</TableHead>
                <TableHead>Net</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <p className="font-medium">{p.employee.firstName} {p.employee.lastName}</p>
                    <p className="text-xs text-muted-foreground">{p.employee.employeeNumber}</p>
                  </TableCell>
                  <TableCell>{p.employee.department?.name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(p.periodStart)}</TableCell>
                  <TableCell>{formatCurrency(p.grossSalary, currency)}</TableCell>
                  <TableCell className="text-red-600">-{formatCurrency(p.totalDeductions, currency)}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(p.netSalary, currency)}</TableCell>
                  <TableCell><Badge variant={statusVariant(p.paymentStatus)}>{p.paymentStatus.toLowerCase()}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {p.paymentStatus !== "PAID" && hasPermission("payroll.mark_paid") && (
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 px-2.5 text-xs gap-1"
                          onClick={() => markPaidSingle.mutate(p.id)}
                          disabled={markPaidSingle.isPending}
                          title="Mark this employee paid and send them payslip email with portal access"
                        >
                          <DollarSign className="h-3.5 w-3.5" /> Mark Paid & Email
                        </Button>
                      )}
                      {p.paymentStatus === "PAID" && hasPermission("payroll.mark_paid") && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2.5 text-xs gap-1 text-slate-700 hover:bg-slate-100"
                          onClick={() => emailSingle.mutate(p.id)}
                          disabled={emailSingle.isPending}
                          title="Email payslip PDF & portal login to this employee"
                        >
                          <Send className="h-3 w-3" /> Email
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => downloadPdf(p.id, p.employee.employeeNumber)}
                        title="Download PDF"
                      >
                        <Download className="h-3.5 w-3.5" /> PDF
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
