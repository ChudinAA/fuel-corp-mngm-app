import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { CheckCircle, Clock } from "lucide-react";

interface SyncStatusBannerProps {
  syncData: any;
  periodFrom: string;
  periodTo: string;
}

export function SyncStatusBanner({ syncData, periodFrom, periodTo }: SyncStatusBannerProps) {
  if (!syncData?.latest) return null;

  const latest = syncData.latest;
  const createdAt = latest.createdAt
    ? format(new Date(latest.createdAt), "dd.MM.yy HH:mm", { locale: ru })
    : "—";

  return (
    <div className="flex items-center gap-3 rounded-md border bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 px-4 py-2 text-sm">
      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
      <span className="text-green-800 dark:text-green-300">
        Ежемесячный план синхронизирован с логистикой{" "}
        <strong>{createdAt}</strong>
      </span>
    </div>
  );
}
