import { AlertTriangle } from "lucide-react";
import { format, parseISO, isAfter, startOfDay } from "date-fns";
import { ru } from "date-fns/locale";
import type { Customer, Supplier } from "@shared/schema";

interface SpecialConditionsBannerProps {
  counterparty: Customer | Supplier | undefined;
  label?: string;
}

function isConditionActive(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return true;
  const expiry = startOfDay(parseISO(expiresAt));
  const today = startOfDay(new Date());
  return !isAfter(today, expiry);
}

export function SpecialConditionsBanner({
  counterparty,
  label,
}: SpecialConditionsBannerProps) {
  if (!counterparty) return null;
  if (!counterparty.hasSpecialConditions) return null;
  if (!counterparty.specialConditions) return null;
  if (!isConditionActive(counterparty.specialConditionsExpiresAt)) return null;

  return (
    <div className="rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-500 p-3 flex gap-3">
      <div className="shrink-0 pt-0.5">
        <AlertTriangle className="h-4 w-4 text-amber-500 animate-pulse" />
      </div>
      <div className="space-y-1 min-w-0">
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
          Особые условия
          {label ? ` · ${label}` : ""}
        </p>
        <p className="text-sm text-amber-700 dark:text-amber-400 whitespace-pre-wrap break-words">
          {counterparty.specialConditions}
        </p>
        {counterparty.specialConditionsExpiresAt && (
          <p className="text-xs text-amber-600 dark:text-amber-500">
            Действует до:{" "}
            {format(parseISO(counterparty.specialConditionsExpiresAt), "d MMMM yyyy", {
              locale: ru,
            })}
          </p>
        )}
      </div>
    </div>
  );
}
