import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";
import { Pagination } from "@/pages/tenant/EmployeesPage";
import { Activity } from "lucide-react";

interface Job {
  id: string;
  jobName: string;
  queueName: string;
  status: string;
  attempts: number;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export default function JobsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["platform-jobs", page],
    queryFn: async () => {
      const res = await api.get("/platform/jobs", { params: { page, limit: 30 } });
      return { items: res.data.data as Job[], meta: res.data.meta };
    },
  });

  return (
    <div>
      <PageHeader title="System Jobs" description="Background job execution history" />
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : (data?.items.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Activity className="mb-3 h-10 w-10 opacity-50" />
            <p className="font-medium">No jobs recorded yet</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Queue</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Finished</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="font-medium">{j.jobName}</TableCell>
                  <TableCell className="text-muted-foreground">{j.queueName}</TableCell>
                  <TableCell><Badge variant={statusVariant(j.status)}>{j.status.toLowerCase()}</Badge></TableCell>
                  <TableCell>{j.attempts}</TableCell>
                  <TableCell className="text-muted-foreground">{j.startedAt ? formatDate(j.startedAt) : "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{j.finishedAt ? formatDate(j.finishedAt) : "—"}</TableCell>
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
