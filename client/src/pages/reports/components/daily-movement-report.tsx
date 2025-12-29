
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface DailyMovementReportProps {
  date: string;
}

export function DailyMovementReport({ date }: DailyMovementReportProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Перемещения за {new Date(date).toLocaleDateString('ru-RU')}</CardTitle>
        <CardDescription>
          Отчет по перемещениям топлива между складами
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8 text-muted-foreground">
          В разработке
        </div>
      </CardContent>
    </Card>
  );
}
