import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";
import { CheckCircle2, XCircle, Trash2 } from "lucide-react";
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

export default function LeavePage() {
  const { toast } = useToast();
  const { hasPermission } = useAuth();
  const qc = useQueryClient();

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
