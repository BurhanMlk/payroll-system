import { useState, useEffect, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate } from "@/lib/utils";
import { Pagination } from "./EmployeesPage";
import { Pencil, Trash2, X } from "lucide-react";

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  lateMinutes: number;
  overtimeHours: string;
  employee: { employeeNumber: string; firstName: string; lastName: string };
}

export default function AttendancePage() {
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AttendanceRecord | null>(null);
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/attendance/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["attendance"] });
      toast({ title: "Attendance record deleted", variant: "success" });
    },
    onError: (err) => toast({ title: "Delete failed", description: errorMessage(err), variant: "destructive" }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["attendance", page],
    queryFn: async () => {
      const res = await api.get("/attendance", { params: { page, limit: 20 } });
      return { items: res.data.data as AttendanceRecord[], meta: res.data.meta };
    },
  });

  const { data: summaryData } = useQuery({
    queryKey: ["attendance-summary"],
    queryFn: async () => {
      const res = await api.get("/attendance/summary");
      return res.data.data as { date: string; summary: Record<string, number> };
    },
  });

  const s = summaryData?.summary ?? {};
  const present = s.PRESENT ?? 0;
  const absent = s.ABSENT ?? 0;
  const late = s.LATE ?? 0;
  const leave = (s.PAID_LEAVE ?? 0) + (s.UNPAID_LEAVE ?? 0);
  const halfDay = s.HALF_DAY ?? 0;

  return (
    <div>
      <PageHeader title="Daily Attendance" description="Track employee attendance" />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <SummaryCard label="Present" value={present} className="text-emerald-600" />
        <SummaryCard label="Absent" value={absent} className="text-red-600" />
        <SummaryCard label="Late" value={late} className="text-amber-600" />
        <SummaryCard label="Leave" value={leave} className="text-blue-600" />
        <SummaryCard label="Half Day" value={halfDay} className="text-purple-600" />
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (data?.items.length ?? 0) === 0 ? (
          <div className="py-16 text-center text-muted-foreground">No attendance records found.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Late (min)</TableHead>
                <TableHead>Overtime (h)</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{formatDate(a.date)}</TableCell>
                  <TableCell>
                    <p className="font-medium">{a.employee.firstName} {a.employee.lastName}</p>
                    <p className="text-xs text-muted-foreground">{a.employee.employeeNumber}</p>
                  </TableCell>
                  <TableCell><Badge variant={statusVariant(a.status)}>{a.status.toLowerCase()}</Badge></TableCell>
                  <TableCell>{a.lateMinutes}</TableCell>
                  <TableCell>{a.overtimeHours}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {hasPermission("attendance.manage") && (
                        <Button variant="outline" size="sm" title="Edit" onClick={() => setEditing(a)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {hasPermission("attendance.manage") && (
                        <Button variant="ghost" size="sm" title="Delete" onClick={() => { if (window.confirm("Delete this attendance record?")) remove.mutate(a.id); }}>
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      <Pagination meta={data?.meta} page={page} onPage={setPage} />

      <EditAttendanceDialog record={editing} onClose={() => setEditing(null)} onSaved={() => qc.invalidateQueries({ queryKey: ["attendance"] })} />
    </div>
  );
}

function SummaryCard({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <Card className="p-4 text-center">
      <p className={`text-2xl font-bold ${className ?? ""}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </Card>
  );
}

function EditAttendanceDialog({ record, onClose, onSaved }: { record: AttendanceRecord | null; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [status, setStatus] = useState("");
  const [lateMinutes, setLateMinutes] = useState("");
  const [overtimeHours, setOvertimeHours] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (record) {
      setStatus(record.status);
      setLateMinutes(String(record.lateMinutes ?? ""));
      setOvertimeHours(String(record.overtimeHours ?? ""));
    }
  }, [record]);

  if (!record) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/attendance/${record.id}`, {
        status,
        lateMinutes: Number(lateMinutes || 0),
        overtimeHours: Number(overtimeHours || 0),
      });
      toast({ title: "Attendance updated", variant: "success" });
      onSaved();
      onClose();
    } catch (err) {
      toast({ title: "Update failed", description: errorMessage(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <form className="w-full max-w-md rounded-lg border bg-card p-6 shadow-lg" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Edit Attendance</h2>
            <p className="text-sm text-muted-foreground">
              {record.employee.firstName} {record.employee.lastName} · {formatDate(record.date)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={[
                { label: "Present", value: "PRESENT" },
                { label: "Absent", value: "ABSENT" },
                { label: "Late", value: "LATE" },
                { label: "Half day", value: "HALF_DAY" },
                { label: "Paid leave", value: "PAID_LEAVE" },
                { label: "Unpaid leave", value: "UNPAID_LEAVE" },
                { label: "Holiday", value: "HOLIDAY" },
                { label: "Weekend", value: "WEEKEND" },
                { label: "Work from home", value: "WORK_FROM_HOME" },
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Late minutes</Label>
            <Input type="number" min={0} value={lateMinutes} onChange={(e) => setLateMinutes(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Overtime hours</Label>
            <Input type="number" min={0} step="0.5" value={overtimeHours} onChange={(e) => setOvertimeHours(e.target.value)} />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
