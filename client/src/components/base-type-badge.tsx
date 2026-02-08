import { Badge } from "@/components/ui/badge";
import { BASE_TYPE } from "@shared/constants";
import { Droplets, Fuel, Globe } from "lucide-react";

interface BaseTypeBadgeProps {
  type: string | null | undefined;
  short?: boolean;
}

export function BaseTypeBadge({ type, short = false }: BaseTypeBadgeProps) {
  if (!type) return null;

  return (
    <Badge variant="outline" className="flex items-center gap-1.5 w-fit">
      {type === BASE_TYPE.WHOLESALE ? (
        <>
          <Droplets className="h-3.5 w-3.5 text-orange-400" />
          {!short && <span>ОПТ</span>}
        </>
      ) : type === BASE_TYPE.REFUELING ? (
        <>
          <Fuel className="h-3.5 w-3.5 text-green-400" />
          {!short && <span>Заправка</span>}
        </>
      ) : (
        <>
          <Globe className="h-3.5 w-3.5 text-blue-400" />
          {!short && <span>Зарубеж</span>}
        </>
      )}
    </Badge>
  );
}
