import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Pagination } from "@/pages/tenant/EmployeesPage";

interface Sub {
  id: string;
  status: string;
  billingPeriod: string;
  amount: string;
  currency: string;
  renewalDate: string;
  tenant: { name: string };
  plan: { name: string };
}

export default function SubscriptionsPage() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["platform-subs", status, page],
    queryFn: async () => {
      const res = await api.get("/platform/subscriptions", { params: { status: status || undefined, page, limit: 20 } });
      return { items: res.data.data as Sub[], meta: res.data.meta };
    },
  });

  const act = useMutation({
    mutationFn: ({ id, action, days }: { id: string; action: string; days?: number }) =>
      api.post(`/platform/subscriptions/${id}/${action}`, days ? { days } : {}),
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["platform-subs"] });
      toast({ title: `Subscription ${vars.action}`, variant: "success" });
    },
    onError: (err) => toast({ title: "Failed", description: errorMessage(err), variant: "destructive" }),
  });

  return (
    <div>
      <PageHeader
        title="Subscriptions"
        description="Manage tenant subscriptions"
        actions={
          <Select
            className="w-44"
            placeholder="All statuses"
            options={["ACTIVE", "TRIALING", "PAST_DUE", "GRACE_PERIOD", "EXPIRED", "CANCELLED", "SUSPENDED"].map((s) => ({ label: s.toLowerCase(), value: s }))}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          />
        }
      />

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Billing</TableHead>
                <TableHead>Renewal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.tenant.name}</TableCell>
                  <TableCell>{s.plan.name}</TableCell>
                  <TableCell>{formatCurrency(s.amount, s.currency)}</TableCell>
                  <TableCell className="capitalize">{s.billingPeriod.toLowerCase()}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(s.renewalDate)}</TableCell>
                  <TableCell><Badge variant={statusVariant(s.status)}>{s.status.toLowerCase()}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="outline" size="sm" onClick={() => act.mutate({ id: s.id, action: "renew" })}>Renew</Button>
                      <Button variant="outline" size="sm" onClick={() => act.mutate({ id: s.id, action: "extend", days: 30 })}>+30d</Button>
                      <Button variant="ghost" size="sm" onClick={() => act.mutate({ id: s.id, action: "cancel" })}>Cancel</Button>
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
