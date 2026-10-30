import { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { studentApi, setStudentToken, StudentAccount } from "@/lib/studentApi";
import { errorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Logo from "@/components/Logo";
import { LogIn, GraduationCap, School } from "lucide-react";

export default function StudentPortalLoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [accounts, setAccounts] = useState<StudentAccount[]>([]);
  const navigate = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError("Please enter your B-Form / CNIC or Roll Number.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await studentApi.post("/login", { identifier, password });
      const data = res.data.data;

      if (data?.requiresSelection && data.accounts?.length) {
        setAccounts(data.accounts);
        return;
      }

      setStudentToken(data.accessToken);
      navigate("/student/portal");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const chooseAccount = async (account: StudentAccount) => {
    setLoading(true);
    setError("");
    try {
      const res = await studentApi.post("/login", {
        identifier,
        password,
        studentId: account.studentId,
      });
      setStudentToken(res.data.data.accessToken);
      navigate("/student/portal");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <GraduationCap className="h-7 w-7" />
          </div>
          <h1 className="mt-3 text-xl font-bold text-slate-900">Student Portal</h1>
          <p className="mt-1 text-xs text-slate-500">
            Sign in with your B-Form / CNIC or Roll Number to view fees & attendance.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">B-Form / CNIC or Roll Number</Label>
            <Input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="e.g. 35201-1234567-1 or STU-0001"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Last 4 digits of B-Form or Roll No"
            />
          </div>

          {error && <p className="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-500">{error}</p>}

          <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white" disabled={loading}>
            <LogIn className="h-4 w-4 mr-1.5" /> {loading ? "Signing in…" : "Sign In"}
          </Button>
        </form>

        <p className="mt-4 text-center text-[11px] text-slate-500">
          Default password is the last 4 digits of your B-Form/CNIC or your Roll Number.
        </p>

        <div className="mt-4 pt-3 border-t text-center space-y-1">
          <p className="text-xs text-slate-500">
            Faculty or Staff? <Link to="/employee" className="text-indigo-600 font-medium hover:underline">Employee Login</Link>
          </p>
          <p className="text-xs text-slate-500">
            Institution Admin? <Link to="/login" className="text-indigo-600 font-medium hover:underline">Admin Login</Link>
          </p>
        </div>
      </div>

      {/* Account Selection Modal */}
      {accounts.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex flex-col items-center text-center">
              <School className="h-8 w-8 text-indigo-600" />
              <h2 className="mt-2 text-lg font-bold text-slate-900">Select Institution</h2>
              <p className="mt-1 text-xs text-slate-500">
                You are registered in multiple institutions. Select your institute to continue.
              </p>
            </div>

            <div className="space-y-2">
              {accounts.map((a) => (
                <button
                  key={a.studentId}
                  type="button"
                  disabled={loading}
                  onClick={() => chooseAccount(a)}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left transition hover:border-indigo-400 hover:bg-indigo-50 disabled:opacity-50"
                >
                  <div>
                    <p className="font-semibold text-slate-900">{a.tenantName}</p>
                    <p className="text-xs text-slate-500">
                      {a.fullName} · {a.rollNumber} ({a.className} {a.section && `Sec ${a.section}`})
                    </p>
                  </div>
                  <LogIn className="h-4 w-4 text-slate-400" />
                </button>
              ))}
            </div>

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

