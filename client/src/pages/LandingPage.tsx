import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Banknote,
  CalendarClock,
  CalendarDays,
  CreditCard,
  BarChart3,
  Users,
  FileText,
  Building2,
  ShieldCheck,
  ArrowRight,
  Check,
  Menu,
  X,
  Sparkles,
  Globe2,
  Headphones,
  TrendingUp,
  GraduationCap,
} from "lucide-react";

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

const FEATURES = [
  { icon: Banknote, title: "Payroll Automation", desc: "Run accurate monthly payroll with salary templates, allowances and deductions in minutes.", gradient: "from-indigo-500 to-blue-600" },
  { icon: CalendarClock, title: "Attendance Tracking", desc: "Track daily attendance, shifts, holidays and biometric records in one place.", gradient: "from-emerald-500 to-teal-600" },
  { icon: CalendarDays, title: "Leave Management", desc: "Manage leave types, balances and approval workflows with full transparency.", gradient: "from-cyan-500 to-sky-600" },
  { icon: CreditCard, title: "Loans & Advances", desc: "Issue employee loans and salary advances with automated installment recovery.", gradient: "from-amber-500 to-orange-600" },
  { icon: FileText, title: "Payslips & Reports", desc: "Generate PDF payslips and export detailed payroll, attendance and finance reports.", gradient: "from-violet-500 to-purple-600" },
  { icon: Users, title: "Employee Records", desc: "Centralized employee profiles with departments, designations and documents.", gradient: "from-rose-500 to-pink-600" },
  { icon: BarChart3, title: "Analytics Dashboard", desc: "Real-time dashboards for payroll costs, attendance trends and staff insights.", gradient: "from-blue-500 to-cyan-600" },
  { icon: Building2, title: "Multi-Branch Support", desc: "Manage schools, colleges and branches under a single institution account.", gradient: "from-slate-600 to-slate-800" },
];

const STEPS = [
  { title: "Create your account", desc: "Register your institution in under two minutes with our guided onboarding.", icon: GraduationCap, gradient: "from-indigo-500 to-blue-600" },
  { title: "Add employees & structure", desc: "Import staff, assign departments and set up salary structures effortlessly.", icon: Users, gradient: "from-emerald-500 to-teal-600" },
  { title: "Run payroll", desc: "Generate payroll with one click — attendance and leave flow in automatically.", icon: Banknote, gradient: "from-amber-500 to-orange-600" },
  { title: "Approve & pay", desc: "Review, approve, generate payslips and mark payments as done.", icon: ShieldCheck, gradient: "from-violet-500 to-purple-600" },
];

function formatStat(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

export default function LandingPage() {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [billing, setBilling] = useState<"MONTHLY" | "YEARLY">("MONTHLY");

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ["public-plans"],
    queryFn: async () => {
      const res = await api.get("/onboarding/plans");
      return res.data.data as Plan[];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["public-stats"],
    queryFn: async () => {
      const res = await api.get("/onboarding/stats");
      return res.data.data as { institutions: number; employees: number };
    },
  });

  const { data: content } = useQuery({
    queryKey: ["landing-content"],
    queryFn: async () => {
      const res = await api.get("/onboarding/content");
      return res.data.data as LandingContent;
    },
  });

  const dashboardLink = user?.scope === "PLATFORM" ? "/platform" : "/app";

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2">
            <Logo className="h-9 w-9" />
            <span className="text-lg font-bold tracking-tight">Edu<span className="text-primary">Payroll</span></span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm font-medium text-slate-600 hover:text-slate-900">Features</a>
            <a href="#how" className="text-sm font-medium text-slate-600 hover:text-slate-900">How it works</a>
            <a href="#pricing" className="text-sm font-medium text-slate-600 hover:text-slate-900">Pricing</a>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Button asChild variant="ghost">
              <Link to="/employee">Employee Login</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/student">Student Login</Link>
            </Button>
            {user ? (
              <Button asChild variant="outline">
                <Link to={dashboardLink}>Go to Dashboard</Link>
              </Button>
            ) : (
              <Button asChild variant="ghost">
                <Link to="/login">Sign in</Link>
              </Button>
            )}
            <Button asChild className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700">
              <Link to="/register">Enroll Now</Link>
            </Button>
          </div>

          <button className="md:hidden" onClick={() => setMenuOpen((v) => !v)}>
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t bg-white px-4 py-4 md:hidden">
            <div className="flex flex-col gap-3">
              <a href="#features" onClick={() => setMenuOpen(false)} className="text-sm font-medium text-slate-700">Features</a>
              <a href="#how" onClick={() => setMenuOpen(false)} className="text-sm font-medium text-slate-700">How it works</a>
              <a href="#pricing" onClick={() => setMenuOpen(false)} className="text-sm font-medium text-slate-700">Pricing</a>
              <Link to="/employee" onClick={() => setMenuOpen(false)} className="text-sm font-medium text-slate-700">Employee Login</Link>
              <Link to="/student" onClick={() => setMenuOpen(false)} className="text-sm font-medium text-slate-700">Student Login</Link>
              <div className="flex gap-3 pt-2">
                {user ? (
                  <Button asChild variant="outline" className="flex-1">
                    <Link to={dashboardLink}>Go to Dashboard</Link>
                  </Button>
                ) : (
                  <Button asChild variant="outline" className="flex-1">
                    <Link to="/login">Sign in</Link>
                  </Button>
                )}
                <Button asChild className="flex-1 bg-gradient-to-r from-indigo-600 to-blue-600">
                  <Link to="/register">Enroll Now</Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950 text-white">
        <div className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-indigo-600/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-28 lg:px-8">
          <div>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              {content?.heroHeading ?? "Payroll for educational institutions,"}{" "}
              <span className="bg-gradient-to-r from-indigo-400 to-cyan-300 bg-clip-text text-transparent">{content?.heroAccent ?? "made simple."}</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-300">
              {content?.heroSubtitle ?? "Manage salaries, attendance, leave, loans and payslips for your entire staff all in one professional, easy-to-use platform."}
            </p>
            <div className="mt-8 flex flex-wrap gap-6 text-sm text-slate-300">
              <span className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> 14-day free trial</span>
              <span className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> No credit card required</span>
              <span className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> Cancel anytime</span>
            </div>
          </div>

          {/* Hero mockup card */}
          <div className="relative">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">Monthly Payroll</p>
                <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-xs font-medium text-emerald-300">Approved</span>
              </div>
              <p className="mt-3 text-4xl font-bold text-white">$28,450</p>
              <p className="mt-1 text-sm text-slate-400">Net pay · 42 employees</p>
              <div className="mt-6 space-y-3">
                {[
                  { label: "Gross salary", value: "$32,800", color: "from-indigo-500 to-blue-500" },
                  { label: "Deductions", value: "$4,350", color: "from-rose-500 to-red-500" },
                  { label: "Loans recovered", value: "$1,200", color: "from-amber-500 to-orange-500" },
                ].map((r) => (
                  <div key={r.label} className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">{r.label}</span>
                    <span className="text-sm font-semibold text-white">{r.value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-xl bg-white/10 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-300">Payslips generated</p>
                    <p className="text-sm font-semibold text-white">42 ready for download</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-b bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 lg:grid-cols-4 lg:px-8">
          {[
            { value: stats ? `${formatStat(stats.institutions)}+` : "—", label: content?.institutionsLabel ?? "Institutions onboarded", icon: Building2 },
            { value: stats ? `${formatStat(stats.employees)}+` : "—", label: content?.employeesLabel ?? "Employees paid monthly", icon: Users },
            { value: content?.uptimeValue ?? "99.9%", label: content?.uptimeLabel ?? "Platform uptime", icon: ShieldCheck },
            { value: content?.supportValue ?? "24/7", label: content?.supportLabel ?? "Dedicated support", icon: Headphones },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white">
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-sm text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-base font-bold uppercase tracking-wider text-primary">Features</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Everything your institution needs</h2>
            <p className="mt-4 text-lg text-muted-foreground">One platform to manage payroll, attendance, leave and finance — without the spreadsheet chaos.</p>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="group rounded-2xl border bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
                <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md", f.gradient)}>
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-base font-bold uppercase tracking-wider text-primary">How it works</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Up and running in four steps</h2>
          </div>

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <div key={s.title} className="relative rounded-2xl border bg-white p-6 shadow-sm">
                <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md", s.gradient)}>
                  <s.icon className="h-6 w-6" />
                </div>
                <p className="mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Step {i + 1}</p>
                <h3 className="mt-1 text-base font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-slate-50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-base font-bold uppercase tracking-wider text-primary">Pricing</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Simple, transparent plans</h2>
            <p className="mt-4 text-lg text-muted-foreground">Start free, upgrade when you grow. Every plan includes core payroll.</p>

            <div className="mt-6 inline-flex rounded-lg border bg-white p-1">
              {(["MONTHLY", "YEARLY"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setBilling(p)}
                  className={cn(
                    "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                    billing === p ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white" : "text-muted-foreground",
                  )}
                >
                  {p === "MONTHLY" ? "Monthly" : "Yearly (save 2 months)"}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {plansLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-80 animate-pulse rounded-2xl border bg-white p-8 shadow-sm">
                  <div className="h-5 w-28 rounded bg-slate-200" />
                  <div className="mt-4 h-10 w-24 rounded bg-slate-200" />
                  <div className="mt-6 space-y-3">
                    {Array.from({ length: 5 }).map((_, j) => <div key={j} className="h-3 w-full rounded bg-slate-100" />)}
                  </div>
                </div>
              ))
            ) : (plans ?? []).length === 0 ? (
              <div className="col-span-full text-center text-sm text-muted-foreground">Pricing is loading…</div>
            ) : (
              (plans ?? []).map((plan) => {
              const price = billing === "YEARLY" ? plan.yearlyPrice : plan.monthlyPrice;
              const featured = plan.key === "professional";
              return (
                <div
                  key={plan.id}
                  className={cn(
                    "relative flex flex-col rounded-2xl border bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg",
                    featured && "border-transparent ring-2 ring-indigo-500",
                  )}
                >
                  {featured && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-600 to-blue-600 px-3 py-1 text-xs font-semibold text-white">
                      Most Popular
                    </span>
                  )}
                  <h3 className="text-lg font-bold">{plan.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.description ?? "For growing institutions"}</p>
                  <div className="mt-5">
                    <span className="text-4xl font-extrabold">${price}</span>
                    <span className="text-sm text-muted-foreground">/{billing === "YEARLY" ? "yr" : "mo"}</span>
                  </div>
                  <ul className="mt-6 flex-1 space-y-3 text-sm">
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> Up to {plan.employeeLimit} employees</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> {plan.branchLimit} branch(es)</li>
                    <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> {plan.userLimit} admin users</li>
                    {plan.features.filter((f) => f.enabled).slice(0, 4).map((f) => (
                      <li key={f.key} className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-500" /> {f.label}</li>
                    ))}
                  </ul>
                  <Button asChild className={cn("mt-8 w-full", featured ? "bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700" : "")}>
                    <Link to="/register">Enroll Now</Link>
                  </Button>
                </div>
              );
            })
            )}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-gradient-to-r from-indigo-600 to-blue-600 py-20 text-white">
        <div className="pointer-events-none absolute -top-20 right-10 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
          <Globe2 className="mx-auto h-12 w-12 text-white/80" />
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Ready to simplify your institution's payroll?</h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-indigo-100">
            Join schools and colleges already saving hours every month. Start your 14-day free trial today.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="bg-white text-indigo-700 hover:bg-indigo-50">
              <Link to="/register">Enroll Now <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            {!user && (
              <Button asChild size="lg" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10">
                <Link to="/login">Sign in</Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 py-12 text-slate-300">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-2">
              <Logo className="h-9 w-9" />
              <span className="text-lg font-bold text-white">Edu<span className="text-indigo-400">Payroll</span></span>
            </div>
            <p className="text-sm text-slate-400">Payroll for educational institutions simple, secure, professional.</p>
            <div className="flex gap-6 text-sm">
              <a href="#features" className="hover:text-white">Features</a>
              <a href="#pricing" className="hover:text-white">Pricing</a>
              <Link to="/login" className="hover:text-white">Sign in</Link>
            </div>
          </div>
          <div className="mt-8 border-t border-white/10 pt-6 text-center text-xs text-slate-500">
             Developed By Muhammad Burhan © {new Date().getFullYear()}  EduPayroll. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
