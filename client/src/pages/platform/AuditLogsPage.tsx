import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";
import { Pagination } from "@/pages/tenant/EmployeesPage";
import { ShieldCheck } from "lucide-react";

interface AuditLog {
  id: string;
  action: string;
  module: string;
  ipAddress: string | null;
  createdAt: string;
  tenant: { name: string } | null;
  user: { fullName: string; email: string } | null;
}

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["platform-audit", page],
    queryFn: async () => {
      const res = await api.get("/platform/audit-logs", { params: { page, limit: 30 } });
      return { items: res.data.data as AuditLog[], meta: res.data.meta };
    },
  });

  return (
    <div>
      <PageHeader title="Audit Logs" description="Security and activity trail across the platform" />
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : (data?.items.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <ShieldCheck className="mb-3 h-10 w-10 opacity-50" />
            <p className="font-medium">No audit events</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>User</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.action}</TableCell>
                  <TableCell className="text-muted-foreground">{a.module}</TableCell>
                  <TableCell>{a.tenant?.name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{a.user?.fullName ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{a.ipAddress ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(a.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      <Pagination meta={data?.meta} page={page} onPage={setPage} />
    </div>
  );
}
