import { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  employeeApi,
  setEmployeeToken,
  saveEmployeeCredentials,
  saveEmployeeAccounts,
  InstitutionAccount,
} from "@/lib/employeeApi";
import { errorMessage } from "@/lib/api";
import { isValidCnic } from "@/lib/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Logo from "@/components/Logo";
import { LogIn, Landmark } from "lucide-react";

function formatCnic(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 13);
  const parts = [digits.slice(0, 5), digits.slice(5, 12), digits.slice(12, 13)];
  return parts.filter(Boolean).join("-");
}

export default function EmployeePortalLoginPage() {
  const [cnic, setCnic] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [accounts, setAccounts] = useState<InstitutionAccount[]>([]);
  const navigate = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isValidCnic(cnic)) {
      setError("Enter a valid 13-digit CNIC (e.g. 12345-1234567-1).");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await employeeApi.post("/login", { cnic, password });
      const data = res.data.data;

      if (data?.requiresSelection && data.accounts?.length) {
        setAccounts(data.accounts);
        return;
      }

      setEmployeeToken(data.accessToken);
      saveEmployeeCredentials(cnic, password);
      navigate("/employee/portal");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const chooseAccount = async (account: InstitutionAccount) => {
    setLoading(true);
    setError("");
    try {
      const res = await employeeApi.post("/select", {
        cnic,
        password,
        employeeId: account.employeeId,
      });
      setEmployeeToken(res.data.data.accessToken);
      saveEmployeeCredentials(cnic, password);
      saveEmployeeAccounts(accounts);
      navigate("/employee/portal");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo className="h-10 w-10" />
          <h1 className="mt-3 text-xl font-bold text-slate-900">Employee Portal</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in with your CNIC to view your payslips and attendance.</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>CNIC</Label>
            <Input
              value={cnic}
              onChange={(e) => setCnic(formatCnic(e.target.value))}
              placeholder="12345-1234567-1"
              maxLength={15}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Last 4 digits of CNIC"
              maxLength={4}
              required
            />
          </div>

          {error && <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            <LogIn className="h-4 w-4" /> {loading ? "Signing in…" : "Sign In"}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-500">
          Default password is the last 4 digits of your CNIC.
        </p>
        <p className="mt-2 text-center text-xs text-slate-500">
          Admin? <Link to="/login" className="text-indigo-600 hover:underline">Sign in here</Link>
        </p>
      </div>

      {accounts.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex flex-col items-center text-center">
              <Landmark className="h-8 w-8 text-indigo-600" />
              <h2 className="mt-2 text-lg font-bold text-slate-900">Select Institution</h2>
              <p className="mt-1 text-sm text-slate-500">
                You are enrolled in multiple institutions. Choose which one to view.
              </p>
            </div>

            <div className="space-y-2">
              {accounts.map((a) => (
                <button
                  key={a.employeeId}
                  type="button"
                  disabled={loading}
                  onClick={() => chooseAccount(a)}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left transition hover:border-indigo-400 hover:bg-indigo-50 disabled:opacity-50"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{a.tenantName}</p>
                    <p className="text-xs text-slate-500">
                      {a.firstName} {a.lastName} · {a.employeeNumber}
                    </p>
                  </div>
                  <LogIn className="h-4 w-4 text-slate-400" />
                </button>
              ))}
            </div>

            {error && <p className="mt-3 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}

            <Button
              variant="outline"
              className="mt-4 w-full"
              disabled={loading}
              onClick={() => {
                setAccounts([]);
                setError("");
              }}
            >
              Back
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
