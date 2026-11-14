import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { errorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import Logo from "@/components/Logo";
import { Eye, EyeOff, AlertTriangle } from "lucide-react";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [expiredModal, setExpiredModal] = useState<{ open: boolean; message: string }>({ open: false, message: "" });
  const { register, handleSubmit, formState } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const user = await login(values.email, values.password);
      toast({ title: "Welcome back", variant: "success" });
      navigate(user.scope === "PLATFORM" ? "/platform" : "/app");
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { code?: string; message?: string; error?: { code?: string; message?: string } } } };
      const code = anyErr?.response?.data?.code || anyErr?.response?.data?.error?.code;
      const msg = errorMessage(err);
      if (
        code === "SUBSCRIPTION_EXPIRED" ||
        msg.toLowerCase().includes("trial") ||
        msg.toLowerCase().includes("balance is insufficient") ||
        msg.toLowerCase().includes("subscription has expired")
      ) {
        setExpiredModal({
          open: true,
          message: msg || "Your balance is insufficient or your free trial has ended. Please subscribe first to continue.",
        });
      } else {
        toast({ title: "Sign in failed", description: msg, variant: "destructive" });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-lg">
        <div className="space-y-6 rounded-xl border bg-transparent p-8">
          <div className="flex flex-col items-center text-center">
            <Logo className="mb-4 h-24 w-24" />
            <h1 className="text-3xl font-semibold tracking-tight">EduPayroll</h1>
            <p className="mt-2 text-base text-muted-foreground">Payroll for educational institutions</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@institution.edu" autoComplete="email" {...register("email")} />
              {formState.errors.email && <p className="text-xs text-destructive">{formState.errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className="pr-10"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {formState.errors.password && <p className="text-xs text-destructive">{formState.errors.password.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          New institution?{" "}
          <Link to="/register" className="font-medium text-primary hover:underline">
            Start your free trial
          </Link>
        </p>
      </div>

      {expiredModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <AlertTriangle className="h-7 w-7" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Subscription / Trial Expired</h3>
            <div className="rounded-lg bg-amber-50 p-3.5 text-xs text-amber-900 border border-amber-200 text-left space-y-1">
              <p className="font-semibold text-amber-950">Your balance is insufficient / Please subscribe first</p>
              <p className="text-slate-700">{expiredModal.message}</p>
            </div>
            <p className="text-xs text-slate-500">
              Aapka 7-day free trial ya subscription period khatam ho chuka hai. Sign in karne aur service use karne ke liye pehle plan subscribe ya renew karein.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <Link
                to="/register"
                className="w-full inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition"
              >
                Subscribe / Upgrade Plan &rarr;
              </Link>
              <Button variant="ghost" size="sm" onClick={() => setExpiredModal({ open: false, message: "" })}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
