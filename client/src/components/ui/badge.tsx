import { HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "secondary" | "success" | "warning" | "destructive" | "outline";

const variants: Record<BadgeVariant, string> = {
  default: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-800",
  destructive: "bg-red-100 text-red-800",
  outline: "border border-input text-foreground",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <span
      ref={ref}
      className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", variants[variant], className)}
      {...props}
    />
  ),
);
Badge.displayName = "Badge";

export function statusVariant(status: string): BadgeVariant {
  switch (status?.toUpperCase()) {
    case "ACTIVE":
    case "PAID":
    case "APPROVED":
    case "COMPLETED":
      return "success";
    case "TRIALING":
    case "PENDING":
    case "PENDING_REVIEW":
    case "CALCULATED":
    case "DRAFT":
      return "warning";
    case "EXPIRED":
    case "CANCELLED":
    case "TERMINATED":
    case "REJECTED":
    case "SUSPENDED":
    case "FAILED":
      return "destructive";
    default:
      return "secondary";
  }
}
