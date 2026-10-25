import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { CalendarCheck, UserCheck, Users, Upload, Save } from "lucide-react";

const STATUSES = [
  { label: "Present", value: "PRESENT" },
  { label: "Absent", value: "ABSENT" },
  { label: "Late", value: "LATE" },
  { label: "Half Day", value: "HALF_DAY" },
  { label: "Paid Leave", value: "PAID_LEAVE" },
  { label: "Unpaid Leave", value: "UNPAID_LEAVE" },
  { label: "Work From Home", value: "WORK_FROM_HOME" },
];

const SOURCES = [
  { label: "Manual", value: "MANUAL" },
  { label: "CSV", value: "CSV" },
  { label: "Biometric", value: "BIOMETRIC" },
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function MarkAttendancePage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [date, setDate] = useState(today());
  const [singleSource, setSingleSource] = useState("MANUAL");
  const [bulkSource, setBulkSource] = useState("MANUAL");
  const [status, setStatus] = useState("PRESENT");
  const [employeeId, setEmployeeId] = useState("");
  const [lateMinutes, setLateMinutes] = useState("");
  const [overtimeHours, setOvertimeHours] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [deduction, setDeduction] = useState("500");

  const { data: employees } = useQuery({
    queryKey: ["employees-all"],
    queryFn: async () => (await api.get("/employees", { params: { limit: 100 } })).data.data as { id: string; employeeNumber: string; firstName: string; lastName: string }[],
  });

  const { data: deductionData } = useQuery({
    queryKey: ["deduction-setting"],
    queryFn: async () => (await api.get("/payroll/deduction-setting")).data.data as { amount: number },
  });
  useEffect(() => {
    if (deductionData && typeof deductionData.amount === "number") setDeduction(String(deductionData.amount));
  }, [deductionData]);

  const saveDeduction = useMutation({
    mutationFn: (amount: number) => api.put("/payroll/deduction-setting", { amount }),
    onSuccess: () => toast({ title: "Deduction saved", variant: "success" }),
    onError: (err) => toast({ title: "Failed", description: errorMessage(err), variant: "destructive" }),
  });

  const autoPayslips = useMutation({
    mutationFn: () => api.post("/payroll/auto-payslips", {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payslips"] });
      qc.invalidateQueries({ queryKey: ["salaries-overview"] });
      toast({ title: "Payslips generated", variant: "success" });
    },
    onError: (err) => toast({ title: "Payslip generation failed", description: errorMessage(err), variant: "destructive" }),
  });

  const single = useMutation({
    mutationFn: () =>
      api.post("/attendance", {
        employeeId,
        date,
        status,
        source: singleSource,
        lateMinutes: Number(lateMinutes || 0),
        overtimeHours: Number(overtimeHours || 0),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      toast({ title: "Attendance marked", variant: "success" });
      autoPayslips.mutate();
    },
    onError: (err) => toast({ title: "Failed", description: errorMessage(err), variant: "destructive" }),
  });

  const bulk = useMutation({
    mutationFn: () =>
      api.post("/attendance/bulk", {
        date,
        employeeIds: (employees ?? []).map((e) => e.id),
        status,
        source: bulkSource,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      toast({ title: "Attendance marked for all employees", variant: "success" });
      autoPayslips.mutate();
    },
    onError: (err) => toast({ title: "Failed", description: errorMessage(err), variant: "destructive" }),
  });

  const upload = useMutation({
    mutationFn: (f: File) => {
      const fd = new FormData();
      fd.append("file", f);
      return api.post("/attendance/import", fd, { headers: { "Content-Type": "multipart/form-data" } });
    },
    onSuccess: (res) => {
      const d = res.data.data as { imported: number; payslipsGenerated?: number };
      setFile(null);
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["payslips"] });
      toast({
        title: `Imported ${d.imported} record(s)`,
        description: `Payslips auto-generated: ${d.payslipsGenerated ?? 0}`,
        variant: "success",
      });
    },
    onError: (err) => toast({ title: "Import failed", description: errorMessage(err), variant: "destructive" }),
  });

  return (
    <div>
      <PageHeader title="Mark Attendance" description="Record attendance manually, via CSV, or from biometric devices" />

      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label>Salary deduction per leave day</Label>
            <Input type="number" min={0} className="w-44" value={deduction} onChange={(e) => setDeduction(e.target.value)} placeholder="500" />
          </div>
          <Button onClick={() => saveDeduction.mutate(Number(deduction || 0))} disabled={saveDeduction.isPending}>
            <Save className="h-4 w-4" /> Save Deduction
          </Button>
          <p className="text-xs text-muted-foreground">0 = no deduction.</p>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Single employee */}
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Single Employee</h2>
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Employee</Label>
              <Select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                options={(employees ?? []).map((e) => ({ label: `${e.firstName} ${e.lastName} (${e.employeeNumber})`, value: e.id }))}
                placeholder="Select employee"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Source</Label>
                <Select value={singleSource} onChange={(e) => setSingleSource(e.target.value)} options={SOURCES} />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={status} onChange={(e) => setStatus(e.target.value)} options={STATUSES} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Late (min)</Label>
                  <Input type="number" min={0} value={lateMinutes} onChange={(e) => setLateMinutes(e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-1.5">
                  <Label>Overtime (h)</Label>
                  <Input type="number" min={0} step="0.5" value={overtimeHours} onChange={(e) => setOvertimeHours(e.target.value)} placeholder="0" />
                </div>
              </div>
            </div>
            <Button className="w-full" onClick={() => single.mutate()} disabled={!employeeId || single.isPending}>
              <CalendarCheck className="h-4 w-4" /> Mark Attendance
            </Button>
          </div>
        </Card>

        {/* Bulk mark */}
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Bulk Mark (All Employees)</h2>
          </div>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Source</Label>
                <Select value={bulkSource} onChange={(e) => setBulkSource(e.target.value)} options={SOURCES} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Status for everyone</Label>
                <Select value={status} onChange={(e) => setStatus(e.target.value)} options={STATUSES} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {employees?.length ?? 0} employee(s) will be marked. Holidays and weekends are auto-detected.
            </p>
            <Button className="w-full" variant="secondary" onClick={() => bulk.mutate()} disabled={(employees?.length ?? 0) === 0 || bulk.isPending}>
              <Users className="h-4 w-4" /> Mark All Employees
            </Button>
          </div>
        </Card>
      </div>

      {(singleSource === "CSV" || bulkSource === "CSV") && (
        <Card className="mt-6 p-5">
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Upload CSV / Excel Sheet</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Columns: Employee Number (or CNIC), Date, Status. Import ke baad payslips khud generate ho jayenge.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <Button onClick={() => file && upload.mutate(file)} disabled={!file || upload.isPending}>
              <Upload className="h-4 w-4" /> Upload & Import
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
