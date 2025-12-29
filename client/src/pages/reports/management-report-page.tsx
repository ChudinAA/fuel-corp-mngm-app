
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ManagementReportPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Управленческий отчет</h1>
        <p className="text-muted-foreground mt-2">
          Сводная dashboard по основным показателям
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Управленческая отчетность</CardTitle>
          <CardDescription>
            Функционал в разработке
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            Модуль находится в разработке
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
