import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { api, errorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import Logo from "@/components/Logo";
import { cn } from "@/lib/utils";

const schema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  email: z.string().email("Enter a valid work email"),
  password: z
    .string()
    .min(8, "At least 8 characters")
    .regex(/[A-Z]/, "Needs an uppercase letter")
    .regex(/[a-z]/, "Needs a lowercase letter")
    .regex(/[0-9]/, "Needs a number"),
  institutionName: z.string().min(2, "Institution name is required"),
  institutionType: z.enum(["SCHOOL", "COLLEGE", "UNIVERSITY", "ACADEMY", "TRAINING_INSTITUTE", "OTHER"]),
  institutionEmail: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  currency: z.string().length(3, "3-letter currency code"),
  planKey: z.string().min(1, "Select a plan"),
  billingPeriod: z.enum(["MONTHLY", "YEARLY"]),
});

type FormValues = z.infer<typeof schema>;

interface Plan {
  id: string;
  key: string;
  name: string;
  description: string | null;
  monthlyPrice: string;
  yearlyPrice: string;
  employeeLimit: number;
  branchLimit: number;
  userLimit: number;
  features: { key: string; label: string; enabled: boolean }[];
}

interface Country {
  name: string;
  code: string;
  currency: string;
  rate: number;
  cities: string[];
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [customCities, setCustomCities] = useState<Record<string, string[]>>({});
  const [addingCity, setAddingCity] = useState(false);
  const [newCity, setNewCity] = useState("");

  const { data: plans } = useQuery({
    queryKey: ["public-plans"],
    queryFn: async () => {
      const res = await api.get("/onboarding/plans");
      return res.data.data as Plan[];
    },
  });

  const { data: countries } = useQuery({
    queryKey: ["public-countries"],
    queryFn: async () => {
      const res = await api.get("/onboarding/countries");
      return res.data.data as Country[];
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      institutionType: "COLLEGE",
      currency: "USD",
      billingPeriod: "MONTHLY",
    },
  });

  useEffect(() => {
    if (plans?.length && !form.getValues("planKey")) {
      form.setValue("planKey", plans[0].key, { shouldValidate: true });
    }
  }, [form, plans]);

  const selectedPlanKey = form.watch("planKey");
  const billingPeriod = form.watch("billingPeriod");
  const countryCode = form.watch("country");
  const city = form.watch("city");

  const selectedCountry = (countries ?? []).find((c) => c.code === countryCode);
  const cityOptions = selectedCountry ? [...selectedCountry.cities, ...(customCities[selectedCountry.code] ?? [])] : [];

  useEffect(() => {
    if (selectedCountry) form.setValue("currency", selectedCountry.currency);
  }, [selectedCountry?.currency]);

  const addCity = () => {
    const value = newCity.trim();
    if (!value || !selectedCountry) return;
    setCustomCities((prev) => ({
      ...prev,
      [selectedCountry.code]: [...(prev[selectedCountry.code] ?? []), value],
    }));
    form.setValue("city", value);
    setNewCity("");
    setAddingCity(false);
  };

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const res = await api.post("/onboarding/register", {
        ...values,
        institutionEmail: values.institutionEmail?.trim() || undefined,
        phone: values.phone?.trim() || undefined,
        website: values.website?.trim() || undefined,
        address: values.address?.trim() || undefined,
        city: values.city?.trim() || undefined,
        country: values.country?.trim() || undefined,
        trial: true,
      });
      toast({ title: "Account created", description: "Your institution is ready. Sign in to continue.", variant: "success" });
      navigate("/login", { state: { email: res.data?.data?.user?.email } });
    } catch (err) {
      toast({ title: "Registration failed", description: errorMessage(err), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 py-10">
      <div className="mx-auto max-w-3xl px-4">
        <div className="mb-8 text-center">
          <Logo className="mx-auto mb-3 h-14 w-14" />
          <h1 className="text-2xl font-semibold tracking-tight">Create your institution account</h1>
          <p className="mt-1 text-sm text-muted-foreground">14-day free trial. No credit card required.</p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <section className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold">1. Your account</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" error={form.formState.errors.fullName?.message}>
                <Input placeholder="Jane Doe" {...form.register("fullName")} />
              </Field>
              <Field label="Work email" error={form.formState.errors.email?.message}>
                <Input type="email" placeholder="you@institution.edu" {...form.register("email")} />
              </Field>
              <Field label="Password" error={form.formState.errors.password?.message}>
                <Input type="password" {...form.register("password")} />
              </Field>
            </div>
          </section>

          <section className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold">2. Institution details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Institution name" error={form.formState.errors.institutionName?.message}>
                <Input placeholder="ABC College" {...form.register("institutionName")} />
              </Field>
              <Field label="Institution type" error={form.formState.errors.institutionType?.message}>
                <select className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" {...form.register("institutionType")}>
                  <option value="SCHOOL">School</option>
                  <option value="COLLEGE">College</option>
                  <option value="UNIVERSITY">University</option>
                  <option value="ACADEMY">Academy</option>
                  <option value="TRAINING_INSTITUTE">Training Institute</option>
                  <option value="OTHER">Other</option>
                </select>
              </Field>
              <Field label="Institution email" error={form.formState.errors.institutionEmail?.message}>
                <Input placeholder="info@abc.edu" {...form.register("institutionEmail")} />
              </Field>
              <Field label="Website" error={form.formState.errors.website?.message}>
                <Input placeholder="https://abc.edu" {...form.register("website")} />
              </Field>
              <Field label="Country" error={form.formState.errors.country?.message}>
                <select className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" {...form.register("country")}>
                  <option value="">Select country</option>
                  {(countries ?? []).map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Phone">
                <Input {...form.register("phone")} />
              </Field>
              <Field label="City" error={form.formState.errors.city?.message}>
                {addingCity ? (
                  <div className="flex items-center gap-2">
                    <Input placeholder="Enter city name" value={newCity} onChange={(e) => setNewCity(e.target.value)} />
                    <Button type="button" variant="outline" onClick={addCity}>Add</Button>
                    <Button type="button" variant="ghost" onClick={() => setAddingCity(false)}>Cancel</Button>
                  </div>
                ) : (
                  <select
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    value={city ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "__custom__") {
                        setAddingCity(true);
                        form.setValue("city", "");
                      } else {
                        form.setValue("city", v);
                      }
                    }}
                  >
                    <option value="">Select city</option>
                    {cityOptions.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="__custom__">➕ Add city manually</option>
                  </select>
                )}
              </Field>
              <Field label="Currency">
                <Input readOnly {...form.register("currency")} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Address" error={form.formState.errors.address?.message}>
                  <Input placeholder="Street, city, state" {...form.register("address")} />
                </Field>
              </div>
            </div>
          </section>

          <section className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-base font-semibold">3. Choose your plan</h2>
            <div className="mb-4 flex gap-2">
              {(["MONTHLY", "YEARLY"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => form.setValue("billingPeriod", p)}
                  className={cn(
                    "rounded-md border px-3 py-1 text-sm",
                    billingPeriod === p ? "border-primary bg-primary/5 text-primary" : "text-muted-foreground",
                  )}
                >
                  {p === "MONTHLY" ? "Monthly" : "Yearly (save 2 months)"}
                </button>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {(plans ?? []).map((plan) => {
                const basePrice = billingPeriod === "YEARLY" ? Number(plan.yearlyPrice) : Number(plan.monthlyPrice);
                const priceRate = selectedCountry?.rate ?? 1;
                const priceCurrency = selectedCountry?.currency ?? "USD";
                const price = basePrice * priceRate;
                const priceLabel = new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: priceCurrency,
                  currencyDisplay: "narrowSymbol",
                  maximumFractionDigits: ["USD", "GBP", "EUR", "AED", "SAR", "QAR", "BHD", "OMR", "KWD", "CAD", "AUD"].includes(priceCurrency) ? 2 : 0,
                }).format(price);
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => form.setValue("planKey", plan.key)}
                    className={cn(
                      "rounded-lg border p-4 text-left transition-colors",
                      selectedPlanKey === plan.key ? "border-primary ring-1 ring-primary" : "hover:border-input",
                    )}
                  >
                    <p className="font-semibold">{plan.name}</p>
                    <p className="mt-1 text-2xl font-semibold">
                      {priceLabel}
                      <span className="text-sm font-normal text-muted-foreground">/{billingPeriod === "YEARLY" ? "yr" : "mo"}</span>
                    </p>
                    <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                      <li>Up to {plan.employeeLimit} employees</li>
                      <li>{plan.branchLimit} branch(es)</li>
                      <li>{plan.userLimit} users</li>
                    </ul>
                  </button>
                );
              })}
            </div>
            {form.formState.errors.planKey && <p className="mt-2 text-xs text-destructive">{form.formState.errors.planKey.message}</p>}
          </section>

          <Button type="submit" className="w-full" size="lg" disabled={submitting}>
            {submitting ? "Creating account…" : "Start free trial"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
