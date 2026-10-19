import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EmployeeOption {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
}

export function EmployeeSearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data: employees } = useQuery({
    queryKey: ["employees-options"],
    queryFn: async () => (await api.get("/employees", { params: { limit: 100 } })).data.data as EmployeeOption[],
  });

  const matched = (employees ?? []).find((e) => e.employeeNumber.toLowerCase() === value.trim().toLowerCase());

  return (
    <div className="space-y-1.5">
      <Label>Employee ID (optional)</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Enter employee ID" />
      {value.trim() && (
        matched ? (
          <p className="text-xs font-medium text-emerald-600">✓ {matched.firstName} {matched.lastName}</p>
        ) : (
          <p className="text-xs text-muted-foreground">No employee found with this ID</p>
        )
      )}
    </div>
  );
}
