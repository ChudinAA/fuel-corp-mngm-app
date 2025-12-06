
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Calculator, CheckCircle2, AlertTriangle } from "lucide-react";

interface CalculatedFieldProps {
  label: string;
  value: string | number | null;
  status?: "ok" | "error" | "warning";
  suffix?: string;
  isLoading?: boolean;
}

export function CalculatedField({ 
  label, 
  value, 
  status,
  suffix = "",
  isLoading = false
}: CalculatedFieldProps) {
  const statusColors = {
    ok: "text-green-600 dark:text-green-400",
    error: "text-red-600 dark:text-red-400",
    warning: "text-yellow-600 dark:text-yellow-400",
  };

  const statusIcons = {
    ok: <CheckCircle2 className="h-4 w-4" />,
    error: <AlertTriangle className="h-4 w-4" />,
    warning: <AlertTriangle className="h-4 w-4" />,
  };

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground flex items-center gap-1">
        <Calculator className="h-3 w-3" />
        {label}
      </Label>
      <div className="flex items-center gap-2 h-10 px-3 bg-muted rounded-md">
        {isLoading ? (
          <Skeleton className="h-5 w-20" />
        ) : status ? (
          <>
            <span className={statusColors[status]}>{statusIcons[status]}</span>
            <span className={`text-sm font-medium ${statusColors[status]}`}>
              {value}{suffix}
            </span>
          </>
        ) : (
          <span className="text-sm font-medium">
            {value !== null ? `${value}${suffix}` : "—"}
          </span>
        )}
      </div>
    </div>
  );
}
