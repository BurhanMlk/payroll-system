import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ToastVariant = "default" | "destructive" | "success";

interface Toast {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (opts: { title: string; description?: string; variant?: ToastVariant }) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let idCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((opts: { title: string; description?: string; variant?: ToastVariant }) => {
    const id = ++idCounter;
    setToasts((prev) => [...prev, { id, ...opts, variant: opts.variant ?? "default" }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "w-80 animate-slide-up rounded-lg border bg-background p-4 shadow-lg",
              t.variant === "destructive" && "border-red-200 bg-red-50",
              t.variant === "success" && "border-emerald-200 bg-emerald-50",
            )}
          >
            <p className="text-sm font-semibold">{t.title}</p>
            {t.description && <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
