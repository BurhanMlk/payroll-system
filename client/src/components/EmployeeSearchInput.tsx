import { useMemo, useState } from "react";
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

function normalizeId(num: string): string {
  return /^\d+$/.test(num) ? String(Number(num)) : num;
}

export function EmployeeSearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-options"],
    queryFn: async () => (await api.get("/employees", { params: { limit: 100 } })).data.data as EmployeeOption[],
  });

  const query = value.trim().toLowerCase();
  const fullName = (e: EmployeeOption) => `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim().toLowerCase();
  const matchesQuery = (e: EmployeeOption) => {
    const num = (e.employeeNumber ?? "").toLowerCase();
    const name = fullName(e);
    return (
      num.includes(query) ||
      name.includes(query) ||
      (query.length > 0 && normalizeId(num).includes(query))
    );
  };

  const suggestions = useMemo(() => {
    const list = employees ?? [];
    if (!query) return list.slice(0, 6);
    return list.filter(matchesQuery).slice(0, 6);
  }, [employees, query]);

  const exact = useMemo(() => {
    if (!query) return undefined;
    return (employees ?? []).find((e) => {
      const num = (e.employeeNumber ?? "").toLowerCase();
      return num === query || normalizeId(num) === query;
    });
  }, [employees, query]);

  return (
    <div className="relative space-y-1.5">
      <Label>Employee ID (optional)</Label>
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search employee by ID or name"
        autoComplete="off"
      />

      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          {suggestions.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                onMouseDown={(ev) => {
                  ev.preventDefault();
                  onChange(e.employeeNumber);
                  setOpen(false);
                }}
              >
                <span className="font-medium">{e.employeeNumber}</span>
                <span className="truncate text-muted-foreground">
                  {e.firstName} {e.lastName}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {value.trim() && !open && (
        exact ? (
          <p className="text-xs font-medium text-emerald-600">✓ {exact.firstName} {exact.lastName}</p>
        ) : (
          <p className="text-xs text-muted-foreground">No employee found with this ID</p>
        )
      )}
    </div>
  );
}
