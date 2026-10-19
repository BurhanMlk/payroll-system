import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { Pagination } from "@/pages/tenant/EmployeesPage";
import { LockOpen, Clock, ShieldAlert } from "lucide-react";

interface LockedAccount {
  id: string;
  email: string;
  fullName: string;
  status: string;
  failedLoginAttempts: number;
  lockedUntil: string;
  lastLoginAt: string | null;
  tenant: { id: string; name: string } | null;
}

const PRESETS = [
  { label: "+30m", ms: 30 * 60 * 1000 },
  { label: "+1h", ms: 60 * 60 * 1000 },
  { label: "+2h", ms: 2 * 60 * 60 * 1000 },
  { label: "+24h", ms: 24 * 60 * 60 * 1000 },
];

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

export default function LockedAccountsPage() {
  const [page, setPage] = useState(1);
  const [lockTimes, setLockTimes] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["platform-locked-accounts", page],
    queryFn: async () => {
      const res = await api.get("/platform/locked-accounts", { params: { page, limit: 20 } });
      return { items: res.data.data as LockedAccount[], meta: res.data.meta };
    },
  });

  const unlock = useMutation({
    mutationFn: (id: string) => api.post(`/platform/users/${id}/unlock`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-locked-accounts"] });
      toast({ title: "Account unlocked", variant: "success" });
    },
    onError: (err) => toast({ title: "Failed to unlock", description: errorMessage(err), variant: "destructive" }),
  });

  const setLock = useMutation({
    mutationFn: ({ id, until }: { id: string; until: string }) => api.post(`/platform/users/${id}/lock`, { until }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-locked-accounts"] });
      toast({ title: "Lock time updated", variant: "success" });
    },
    onError: (err) => toast({ title: "Failed to update lock", description: errorMessage(err), variant: "destructive" }),
  });

  const applyLock = (id: string) => {
    const value = lockTimes[id];
    if (!value) return;
    setLock.mutate({ id, until: new Date(value).toISOString() }, {
      onSuccess: () => setLockTimes((p) => ({ ...p, [id]: "" })),
    });
  };

  return (
    <div>
      <PageHeader
        title="Locked Accounts"
        description="Accounts temporarily locked after 3 failed password attempts. Unlock immediately or schedule when they should become active."
      />

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (data?.items.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <ShieldAlert className="mb-3 h-10 w-10 opacity-50" />
            <p className="font-medium">No locked accounts</p>
            <p className="text-sm">Accounts will appear here after 3 failed login attempts.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Institution</TableHead>
                <TableHead>Failed Attempts</TableHead>
                <TableHead>Locked Until</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <p className="font-medium">{a.fullName}</p>
                    <p className="text-xs text-muted-foreground">{a.email}</p>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{a.tenant?.name ?? "Platform"}</TableCell>
                  <TableCell className="font-mono">{a.failedLoginAttempts}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(a.lockedUntil)}</TableCell>
                  <TableCell><Badge variant={statusVariant(a.status)}>{a.status.toLowerCase()}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => unlock.mutate(a.id)} disabled={unlock.isPending}>
                        <LockOpen className="h-3.5 w-3.5" />
                        Unlock
                      </Button>
                      <div className="flex items-center gap-1">
                        <Input
                          type="datetime-local"
                          className="h-8 w-44"
                          value={lockTimes[a.id] ?? ""}
                          onChange={(e) => setLockTimes((p) => ({ ...p, [a.id]: e.target.value }))}
                        />
                        <Button size="sm" onClick={() => applyLock(a.id)} disabled={!lockTimes[a.id] || setLock.isPending} title="Schedule unlock at this time">
                          <Clock className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-1">
                        {PRESETS.map((p) => (
                          <Button
                            key={p.label}
                            size="sm"
                            variant="ghost"
                            onClick={() => setLock.mutate({ id: a.id, until: new Date(Date.now() + p.ms).toISOString() })}
                            title={`Lock for ${p.label.slice(1)}`}
                          >
                            {p.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </TableCell>
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
