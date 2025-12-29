
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface DailyExchangeReportProps {
  date: string;
}

export function DailyExchangeReport({ date }: DailyExchangeReportProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Обмен за {new Date(date).toLocaleDateString('ru-RU')}</CardTitle>
        <CardDescription>
          Отчет по операциям обмена топлива
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
