
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface CashflowData {
  date: string;
  income: number;
  expense: number;
}

export function CashflowChart() {
  const { data: transactions } = useQuery<any[]>({
    queryKey: ["/api/cashflow"],
  });

  // Группируем данные по месяцам
  const chartData: CashflowData[] = transactions
    ? Object.values(
        transactions.reduce((acc: Record<string, CashflowData>, transaction) => {
          const date = new Date(transaction.transactionDate);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          
          if (!acc[monthKey]) {
            acc[monthKey] = { date: monthKey, income: 0, expense: 0 };
          }

          const amount = parseFloat(transaction.amount);
          if (transaction.category === 'income') {
            acc[monthKey].income += amount;
          } else if (transaction.category === 'expense') {
            acc[monthKey].expense += amount;
          }

          return acc;
        }, {})
      ).sort((a, b) => a.date.localeCompare(b.date))
    : [];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Динамика движения средств</CardTitle>
        <CardDescription>Поступления и расходы по месяцам</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis tickFormatter={(value) => formatCurrency(value)} />
            <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            <Legend />
            <Area
              type="monotone"
              dataKey="income"
              stackId="1"
              stroke="#22c55e"
              fill="#22c55e"
              name="Поступления"
            />
            <Area
              type="monotone"
              dataKey="expense"
              stackId="2"
              stroke="#ef4444"
              fill="#ef4444"
              name="Расходы"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
