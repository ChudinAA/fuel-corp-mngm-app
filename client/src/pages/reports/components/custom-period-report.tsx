
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function CustomPeriodReport() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Отчет за период</CardTitle>
        <CardDescription>
          Произвольный период до месяца
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
