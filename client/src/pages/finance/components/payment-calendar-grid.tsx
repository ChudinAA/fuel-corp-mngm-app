
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { useState } from "react";

interface PaymentItem {
  id: string;
  dueDate: string;
  title: string;
  amount: string;
  status: string;
  category: string;
}

export function PaymentCalendarGrid() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const { data: items } = useQuery<PaymentItem[]>({
    queryKey: ["/api/payment-calendar"],
  });

  const getPaymentsForDate = (date: Date) => {
    if (!items) return [];
    const dateStr = date.toISOString().split('T')[0];
    return items.filter(item => item.dueDate === dateStr);
  };

  const selectedPayments = selectedDate ? getPaymentsForDate(selectedDate) : [];

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
    }).format(parseFloat(value));
  };

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    paid: "bg-green-100 text-green-800",
    overdue: "bg-red-100 text-red-800",
    cancelled: "bg-gray-100 text-gray-800",
  };

  const modifiers = {
    hasPayment: (date: Date) => {
      const dateStr = date.toISOString().split('T')[0];
      return items?.some(item => item.dueDate === dateStr) || false;
    },
  };

  const modifiersStyles = {
    hasPayment: {
      fontWeight: 'bold',
      textDecoration: 'underline',
    },
  };

  return (
    <div className="grid gap-6 md:grid-cols-[2fr_3fr]">
      <Card>
        <CardHeader>
          <CardTitle>Календарь</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            className="rounded-md border"
            modifiers={modifiers}
            modifiersStyles={modifiersStyles}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Платежи на {selectedDate?.toLocaleDateString('ru-RU')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedPayments.length > 0 ? (
            <div className="space-y-3">
              {selectedPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="space-y-1">
                    <p className="font-medium">{payment.title}</p>
                    <div className="flex gap-2">
                      <Badge className={statusColors[payment.status]} variant="outline">
                        {payment.status === 'pending' && 'Ожидает'}
                        {payment.status === 'paid' && 'Оплачено'}
                        {payment.status === 'overdue' && 'Просрочено'}
                        {payment.status === 'cancelled' && 'Отменено'}
                      </Badge>
                      <Badge variant="outline">
                        {payment.category === 'payable' ? 'К оплате' : 'К получению'}
                      </Badge>
                    </div>
                  </div>
                  <p className="font-semibold text-lg">
                    {formatCurrency(payment.amount)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Нет платежей на выбранную дату
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
