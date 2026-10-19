import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

interface LandingContent {
  heroHeading: string;
  heroAccent: string;
  heroSubtitle: string;
  institutionsLabel: string;
  employeesLabel: string;
  uptimeValue: string;
  uptimeLabel: string;
  supportValue: string;
  supportLabel: string;
}

const FIELDS: { key: keyof LandingContent; label: string }[] = [
  { key: "heroHeading", label: "Hero heading (first part)" },
  { key: "heroAccent", label: "Hero heading (highlighted part)" },
  { key: "heroSubtitle", label: "Hero subtitle" },
  { key: "institutionsLabel", label: "Stat label — Institutions" },
  { key: "employeesLabel", label: "Stat label — Employees" },
  { key: "uptimeValue", label: "Stat value — Uptime" },
  { key: "uptimeLabel", label: "Stat label — Uptime" },
  { key: "supportValue", label: "Stat value — Support" },
  { key: "supportLabel", label: "Stat label — Support" },
];

export default function PlatformSettingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<LandingContent | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["landing-content"],
    queryFn: async () => {
      const res = await api.get("/onboarding/content");
      return res.data.data as LandingContent;
    },
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: (value: LandingContent) => api.put("/platform/settings", { key: "landing", value }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["landing-content"] });
      toast({ title: "Website content saved", description: "Changes are now live on the landing page.", variant: "success" });
    },
    onError: (err) => toast({ title: "Failed", description: errorMessage(err), variant: "destructive" }),
  });

  if (isLoading || !form) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Website Content" description="Edit the text shown on your public landing page." />

      <Card className="space-y-4 p-6">
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label>{f.label}</Label>
            <Input
              value={form[f.key]}
              onChange={(e) => setForm((prev) => (prev ? { ...prev, [f.key]: e.target.value } : prev))}
            />
          </div>
        ))}

        <div className="flex justify-end pt-2">
          <Button onClick={() => save.mutate(form)} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
