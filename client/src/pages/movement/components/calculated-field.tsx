
import { Label } from "@/components/ui/label";
import { Calculator } from "lucide-react";

interface CalculatedFieldProps {
  label: string;
  value: string | number | null;
  suffix?: string;
}

export function CalculatedField({ label, value, suffix = "" }: CalculatedFieldProps) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground flex items-center gap-1">
        <Calculator className="h-3 w-3" />
        {label}
      </Label>
      <div className="flex items-center gap-2 h-10 px-3 bg-muted rounded-md">
        <span className="text-sm font-medium">{value !== null ? `${value}${suffix}` : "—"}</span>
      </div>
    </div>
  );
}
