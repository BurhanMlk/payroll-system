import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";
import { Pencil, Check, X } from "lucide-react";

interface Plan {
  id: string;
  key: string;
  name: string;
  description: string | null;
  monthlyPrice: string;
  yearlyPrice: string;
  currency: string;
  employeeLimit: number;
  branchLimit: number;
  userLimit: number;
  trialDays: number;
  features: { key: string; label: string; enabled: boolean }[];
}

interface Country {
  name: string;
  code: string;
  currency: string;
  rate: number;
  cities: string[];
}

export default function PlansPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [monthly, setMonthly] = useState("");
  const [yearly, setYearly] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["platform-plans"],
    queryFn: async () => {
      const res = await api.get("/platform/plans");
      return res.data.data as Plan[];
    },
  });

  const { data: countries } = useQuery({
    queryKey: ["countries"],
    queryFn: async () => (await api.get("/onboarding/countries")).data.data as Country[],
  });

  const update = useMutation({
    mutationFn: ({ id, monthlyPrice, yearlyPrice }: { id: string; monthlyPrice: number; yearlyPrice: number }) =>
      api.put(`/platform/plans/${id}`, { monthlyPrice, yearlyPrice }),
    onSuccess: () => {
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["platform-plans"] });
      toast({ title: "Price updated", variant: "success" });
    },
    onError: (err) => toast({ title: "Failed", description: errorMessage(err), variant: "destructive" }),
  });

  const startEdit = (p: Plan) => {
    setEditingId(p.id);
    setMonthly(p.monthlyPrice);
    setYearly(p.yearlyPrice);
  };

  const saveEdit = (id: string) => {
    update.mutate({ id, monthlyPrice: Number(monthly || 0), yearlyPrice: Number(yearly || 0) });
  };

  if (isLoading || !data) return <Skeleton className="h-64" />;

  return (
    <div>
      <PageHeader title="Subscription Plans" description="Set plan prices — they auto-convert to every country's currency" />
      <div className="grid gap-4 lg:grid-cols-3">
        {data.map((plan) => (
          <Card key={plan.id} className="p-6">
            <div className="flex items-center justify-between">
              <p className="text-lg font-semibold">{plan.name}</p>
              <Badge variant="secondary" className="capitalize">{plan.key}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>

            <div className="mt-4">
              {editingId === plan.id ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input type="number" min={0} className="h-8 w-32" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
                    <span className="text-sm text-muted-foreground">USD /mo</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input type="number" min={0} className="h-8 w-32" value={yearly} onChange={(e) => setYearly(e.target.value)} />
                    <span className="text-sm text-muted-foreground">USD /yr</span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => saveEdit(plan.id)} disabled={update.isPending}>
                      <Check className="h-3.5 w-3.5" /> Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-3xl font-semibold">{formatCurrency(plan.monthlyPrice, plan.currency)}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                  <p className="text-sm text-muted-foreground">{formatCurrency(plan.yearlyPrice, plan.currency)}/yr · {plan.trialDays}-day trial</p>
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => startEdit(plan)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit Price
                  </Button>
                </>
              )}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-md bg-muted p-2"><p className="font-semibold">{plan.employeeLimit}</p><p className="text-xs text-muted-foreground">Employees</p></div>
              <div className="rounded-md bg-muted p-2"><p className="font-semibold">{plan.branchLimit}</p><p className="text-xs text-muted-foreground">Branches</p></div>
              <div className="rounded-md bg-muted p-2"><p className="font-semibold">{plan.userLimit}</p><p className="text-xs text-muted-foreground">Users</p></div>
            </div>

            <div className="mt-4 border-t pt-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Price in all countries (auto)</p>
              <div className="max-h-48 space-y-1 overflow-y-auto">
                {(countries ?? []).map((c) => (
                  <div key={c.code} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{c.name}</span>
                    <span className="font-medium">{formatCurrency(Number(plan.monthlyPrice) * c.rate, c.currency)}/mo</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {plan.features.filter((f) => f.enabled).map((f) => (
                <Badge key={f.key} variant="outline">{f.label}</Badge>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
