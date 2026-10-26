import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";
import { CheckCircle2, XCircle, Trash2, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface LeaveRequest {
  id: string;
  startDate: string;
  endDate: string;
  days: string;
  reason: string | null;
  status: string;
  employee: { employeeNumber: string; firstName: string; lastName: string };
  leaveType: { name: string; isPaid: boolean };
}

interface EmployeeOption {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
}

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
}

export default function LeavePage() {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [empSearch, setEmpSearch] = useState("");
  const [foundEmployee, setFoundEmployee] = useState<EmployeeOption | null>(null);
  const [historyMonth, setHistoryMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const { data, isLoading } = useQuery({
    queryKey: ["leave-requests"],
    queryFn: async () => {
      const res = await api.get("/leaves", { params: { limit: 100 } });
      return res.data.data as LeaveRequest[];
    },
  });

  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "APPROVED" | "REJECTED" }) =>
      api.post(`/leaves/${id}/decision`, { decision }),
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["leave-requests"] });
      toast({ title: `Leave ${vars.decision.toLowerCase()}`, variant: "success" });
    },
    onError: (err) => toast({ title: "Failed", description: errorMessage(err), variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/leaves/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leave-requests"] });
      toast({ title: "Leave request deleted", variant: "success" });
    },
    onError: (err) => toast({ title: "Failed", description: errorMessage(err), variant: "destructive" }),
  });

  const searchEmployee = useMutation({
    mutationFn: async () => {
      const res = await api.get("/employees", { params: { search: empSearch, limit: 5 } });
      return res.data.data as EmployeeOption[];
    },
    onSuccess: (employees) => {
      if (employees.length === 0) {
        setFoundEmployee(null);
        toast({ title: "Employee not found", description: "No employee matches this ID or name.", variant: "destructive" });
        return;
      }
      setFoundEmployee(employees[0]);
    },
    onError: (err) => toast({ title: "Search failed", description: errorMessage(err), variant: "destructive" }),
  });

  const [monthStart, monthEnd] = (() => {
    const [y, m] = historyMonth.split("-").map(Number);
    const start = new Date(y, (m ?? 1) - 1, 1).toISOString().slice(0, 10);
    const end = new Date(y, m ?? 1, 0).toISOString().slice(0, 10);
    return [start, end];
  })();

  const { data: leaveHistory, isLoading: historyLoading } = useQuery({
    queryKey: ["leave-history", foundEmployee?.id, historyMonth],
    enabled: Boolean(foundEmployee),
    queryFn: async () => {
      const res = await api.get("/attendance", {
        params: { employeeId: foundEmployee?.id, from: monthStart, to: monthEnd, limit: 100 },
      });
      const items = res.data.data as AttendanceRecord[];
      return items.filter((a) => ["PAID_LEAVE", "UNPAID_LEAVE", "ABSENT"].includes(a.status));
    },
  });

  const paidCount = leaveHistory?.filter((a) => a.status === "PAID_LEAVE").length ?? 0;
  const unpaidCount = leaveHistory?.filter((a) => a.status === "UNPAID_LEAVE").length ?? 0;
  const absentCount = leaveHistory?.filter((a) => a.status === "ABSENT").length ?? 0;

  const pending = data?.filter((l) => l.status === "PENDING").length ?? 0;
  const approved = data?.filter((l) => l.status === "APPROVED").length ?? 0;
  const rejected = data?.filter((l) => l.status === "REJECTED").length ?? 0;

  return (
    <div>
      <PageHeader title="Leave Requests" description="Approve or reject employee leave requests" />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <SummaryCard label="Pending" value={pending} className="text-amber-600" />
        <SummaryCard label="Approved" value={approved} className="text-emerald-600" />
        <SummaryCard label="Rejected" value={rejected} className="text-red-600" />
      </div>

      <Card className="mb-6 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>Employee ID or name</Label>
            <div className="flex gap-2">
              <Input placeholder="Search employee" value={empSearch} onChange={(e) => { setEmpSearch(e.target.value); setFoundEmployee(null); }} />
              <Button type="button" size="sm" variant="outline" onClick={() => searchEmployee.mutate()} disabled={!empSearch || searchEmployee.isPending}>
                <Search className="h-4 w-4" /> Search
              </Button>
            </div>
            {foundEmployee && (
              <p className="text-xs text-emerald-600">
                {foundEmployee.firstName} {foundEmployee.lastName} ({foundEmployee.employeeNumber})
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Month</Label>
            <Input type="month" value={historyMonth} onChange={(e) => setHistoryMonth(e.target.value)} className="w-44" />
          </div>
        </div>

        {foundEmployee && (
          <div className="mt-4">
            <div className="mb-3 flex flex-wrap gap-3 text-sm">
              <span className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-700">Paid leave: {paidCount}</span>
              <span className="rounded-md bg-red-50 px-2 py-1 text-red-700">Unpaid leave: {unpaidCount}</span>
              <span className="rounded-md bg-amber-50 px-2 py-1 text-amber-700">Absent: {absentCount}</span>
            </div>
            {historyLoading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : (leaveHistory?.length ?? 0) === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No leave records for this employee in this month.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaveHistory?.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-muted-foreground">{formatDate(a.date)}</TableCell>
                      <TableCell><Badge variant={statusVariant(a.status)}>{a.status.toLowerCase().replace("_", " ")}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (data?.length ?? 0) === 0 ? (
          <div className="py-16 text-center text-muted-foreground">No leave requests.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <p className="font-medium">{l.employee.firstName} {l.employee.lastName}</p>
                    <p className="text-xs text-muted-foreground">{l.employee.employeeNumber}</p>
                  </TableCell>
                  <TableCell>{l.leaveType.name} <span className="text-xs text-muted-foreground">({l.leaveType.isPaid ? "paid" : "unpaid"})</span></TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(l.startDate)} → {formatDate(l.endDate)}</TableCell>
                  <TableCell>{l.days}</TableCell>
                  <TableCell><Badge variant={statusVariant(l.status)}>{l.status.toLowerCase()}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {l.status === "PENDING" && (
                        <>
                          <Button variant="outline" size="sm" onClick={() => decide.mutate({ id: l.id, decision: "APPROVED" })}>
                            <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => decide.mutate({ id: l.id, decision: "REJECTED" })}>
                            <XCircle className="h-3.5 w-3.5" /> Reject
                          </Button>
                        </>
                      )}
                      {l.status !== "APPROVED" && (hasPermission("leave.manage") || hasPermission("leave.approve")) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Delete"
                          onClick={() => {
                            if (window.confirm("Delete this leave request? This cannot be undone.")) {
                              remove.mutate(l.id);
                            }
                          }}
                          disabled={remove.isPending}
                        >
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
