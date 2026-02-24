import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PRODUCT_TYPE } from "@shared/constants";

interface ProductTypeBadgeProps {
  type: string;
}

export function ProductTypeBadge({ type }: ProductTypeBadgeProps) {
  const getProductLabel = (productType: string) => {
    const labels: Record<string, string> = {
      [PRODUCT_TYPE.KEROSENE]: "Керосин",
      [PRODUCT_TYPE.PVKJ]: "ПВКЖ",
      [PRODUCT_TYPE.SERVICE]: "Услуга",
      [PRODUCT_TYPE.AGENT]: "Агентские",
      [PRODUCT_TYPE.STORAGE]: "Хранение",
    };
    return labels[productType] || productType;
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[11px] md:text-xs px-2 py-0.5 h-6",
        type === PRODUCT_TYPE.PVKJ
          ? "bg-purple-50/50 dark:bg-purple-950/20 border-purple-200/30 dark:border-purple-800/30 text-purple-700 dark:text-purple-300"
          : type === PRODUCT_TYPE.KEROSENE
            ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/30 dark:border-blue-800/30 text-blue-700 dark:text-blue-300"
            : type === PRODUCT_TYPE.SERVICE
              ? "bg-green-50/50 dark:bg-green-950/20 border-green-200/30 dark:border-green-800/30 text-green-700 dark:text-green-300"
              : "",
      )}
    >
      {getProductLabel(type)}
    </Badge>
  );
}
