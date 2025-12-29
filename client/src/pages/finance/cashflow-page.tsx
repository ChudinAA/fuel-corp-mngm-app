
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CashflowTable } from "./components/cashflow-table";
import { CashflowDialog } from "./components/cashflow-dialog";
import { CashflowChart } from "./components/cashflow-chart";
import { useAuth } from "@/hooks/use-auth";

interface CashflowSummary {
  category: string;
  total: number;
}

export default function CashflowPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const { hasPermission } = useAuth();

  const { data: summary, isLoading: summaryLoading } = useQuery<CashflowSummary[]>({
    queryKey: ["/api/cashflow/summary"],
  });

  const income = summary?.find(s => s.category === 'income')?.total || 0;
  const expense = summary?.find(s => s.category === 'expense')?.total || 0;
  const netCashflow = income - expense;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Кешфлоу</h1>
          <p className="text-muted-foreground">Управление движением денежных средств</p>
        </div>
        {hasPermission("finance", "create") && (
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Добавить операцию
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Поступления
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-green-600">{formatCurrency(income)}</p>
            <p className="text-xs text-muted-foreground mt-1">За текущий период</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              Расходы
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-red-600">{formatCurrency(expense)}</p>
            <p className="text-xs text-muted-foreground mt-1">За текущий период</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Чистый денежный поток
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-semibold ${netCashflow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(netCashflow)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">За текущий период</p>
          </CardContent>
        </Card>
      </div>

      <CashflowChart />
      
      <Card>
        <CardHeader>
          <CardTitle>История операций</CardTitle>
          <CardDescription>Все транзакции движения денежных средств</CardDescription>
        </CardHeader>
        <CardContent>
          <CashflowTable />
        </CardContent>
      </Card>

      <CashflowDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
    </div>
  );
}
