import { Badge } from "@/components/ui/badge";

interface BaseTypeBadgeProps {
  type: string | null | undefined;
}

export function BaseTypeBadge({ type }: BaseTypeBadgeProps) {
  if (!type) return null;

  if (type === "opt") {
    return (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800">
        ОПТ
      </Badge>
    );
  }

  if (type === "refueling") {
    return (
      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800">
        Заправка
      </Badge>
    );
  }

  return (
    <Badge variant="outline">
      {type}
    </Badge>
  );
}
