
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { PaymentCalendarDialog } from "./components/payment-calendar-dialog";
import { PaymentCalendarTable } from "./components/payment-calendar-table";
import { PaymentCalendarGrid } from "./components/payment-calendar-grid";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface UpcomingPayment {
  id: string;
  title: string;
  dueDate: string;
  amount: number;
  status: string;
}

export default function PaymentCalendarPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { hasPermission } = useAuth();

  const { data: upcomingPayments } = useQuery<UpcomingPayment[]>({
    queryKey: ["/api/payment-calendar/upcoming"],
  });

  const pendingCount = upcomingPayments?.filter(p => p.status === 'pending').length || 0;
  const overdueCount = upcomingPayments?.filter(p => p.status === 'overdue').length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Платежный календарь</h1>
          <p className="text-muted-foreground">Планирование и контроль платежей</p>
        </div>
        {hasPermission("finance", "create") && (
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Добавить платеж
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              Ожидает оплаты
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{pendingCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Платежей в ближайшие 7 дней</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              Просрочено
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-red-600">{overdueCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Требуют внимания</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Оплачено за месяц
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-green-600">
              {upcomingPayments?.filter(p => p.status === 'paid').length || 0}
            </p>
            <p className="text-xs text-muted-foreground mt-1">В текущем месяце</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="calendar" className="space-y-4">
        <TabsList>
          <TabsTrigger value="calendar">Календарь</TabsTrigger>
          <TabsTrigger value="list">Список</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="space-y-4">
          <PaymentCalendarGrid />
        </TabsContent>

        <TabsContent value="list" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Все платежи</CardTitle>
              <CardDescription>Полный список запланированных платежей</CardDescription>
            </CardHeader>
            <CardContent>
              <PaymentCalendarTable />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <PaymentCalendarDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
    </div>
  );
}
