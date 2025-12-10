import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ShoppingCart, 
  Plane, 
  Warehouse, 
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  AlertTriangle,
  CheckCircle2
} from "lucide-react";

interface DashboardStats {
  optDealsToday: number;
  refuelingToday: number;
  warehouseAlerts: number;
  totalProfitMonth: number;
  pendingDeliveries: number;
  totalVolumeSold: number;
}

function StatCard({ 
  title, 
  value, 
  description, 
  icon: Icon, 
  trend,
  loading = false,
  variant = "default"
}: { 
  title: string; 
  value: string | number; 
  description?: string; 
  icon: React.ElementType;
  trend?: { value: number; isPositive: boolean };
  loading?: boolean;
  variant?: "default" | "warning" | "success";
}) {
  const variantStyles = {
    default: "",
    warning: "border-l-4 border-l-yellow-500",
    success: "border-l-4 border-l-green-500",
  };

  return (
    <Card className={variantStyles[variant]}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <>
            <Skeleton className="h-8 w-24 mb-1" />
            <Skeleton className="h-4 w-32" />
          </>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold">{value}</span>
              {trend && (
                <span className={`flex items-center text-xs ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {trend.isPositive ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
                  {trend.value}%
                </span>
              )}
            </div>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function RecentActivityItem({ 
  type, 
  description, 
  time, 
  status 
}: { 
  type: string; 
  description: string; 
  time: string; 
  status: "success" | "warning" | "pending";
}) {
  const statusIcons = {
    success: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    warning: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
    pending: <Package className="h-4 w-4 text-blue-500" />,
  };

  return (
    <div className="flex items-start gap-3 py-3 border-b last:border-0">
      {statusIcons[status]}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{type}</p>
        <p className="text-sm text-muted-foreground truncate">{description}</p>
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">{time}</span>
    </div>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('ru-RU').format(value);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Дашборд</h1>
        <p className="text-muted-foreground">
          Обзор ключевых показателей системы
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Оптовые сделки сегодня"
          value={stats?.optDealsToday ?? 0}
          description="Всего сделок за день"
          icon={ShoppingCart}
          loading={isLoading}
        />
        <StatCard
          title="Заправки ВС сегодня"
          value={stats?.refuelingToday ?? 0}
          description="Выполнено заправок"
          icon={Plane}
          loading={isLoading}
        />
        <StatCard
          title="Прибыль за месяц"
          value={formatCurrency(stats?.totalProfitMonth ?? 0)}
          description="Общая прибыль"
          icon={DollarSign}
          loading={isLoading}
        />
        <StatCard
          title="Оповещения склада"
          value={stats?.warehouseAlerts ?? 0}
          description="Требуют внимания"
          icon={Warehouse}
          loading={isLoading}
          variant={stats?.warehouseAlerts && stats.warehouseAlerts > 0 ? "warning" : "success"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Последние операции</CardTitle>
            <CardDescription>
              Недавние сделки и перемещения
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                    <Skeleton className="h-3 w-16" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-0">
                <RecentActivityItem
                  type="Оптовая продажа"
                  description="ГПН ЯНОС → ТЛК: 5,000 кг"
                  time="10 мин. назад"
                  status="success"
                />
                <RecentActivityItem
                  type="Заправка ВС"
                  description="Шереметьево: Boeing 737, 3,200 л"
                  time="25 мин. назад"
                  status="success"
                />
                <RecentActivityItem
                  type="Перемещение"
                  description="Служба → Склад Домодедово: 10,000 кг"
                  time="1 час назад"
                  status="pending"
                />
                <RecentActivityItem
                  type="Биржевая сделка"
                  description="Покупка: 50,000 кг керосина"
                  time="2 часа назад"
                  status="success"
                />
                <RecentActivityItem
                  type="Предупреждение"
                  description="Низкий остаток на складе Внуково"
                  time="3 часа назад"
                  status="warning"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Остатки на складах</CardTitle>
            <CardDescription>
              Текущие объемы топлива
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                    <Skeleton className="h-2 w-full" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {[
                  { name: "Служба (основной)", current: 125000, max: 200000 },
                  { name: "Шереметьево", current: 45000, max: 80000 },
                  { name: "Домодедово", current: 32000, max: 60000 },
                  { name: "Внуково", current: 8000, max: 50000 },
                ].map((warehouse) => {
                  const percentage = (warehouse.current / warehouse.max) * 100;
                  const isLow = percentage < 20;
                  
                  return (
                    <div key={warehouse.name} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{warehouse.name}</span>
                        <span className={isLow ? "text-yellow-600" : "text-muted-foreground"}>
                          {formatNumber(warehouse.current)} кг
                        </span>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            isLow ? 'bg-yellow-500' : 'bg-primary'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {percentage.toFixed(1)}% заполнено
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Статистика за неделю</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-2xl font-semibold">{isLoading ? <Skeleton className="h-8 w-16 mx-auto" /> : formatNumber(stats?.optDealsToday ?? 0)}</p>
                <p className="text-xs text-muted-foreground">Оптовых сделок</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-2xl font-semibold">{isLoading ? <Skeleton className="h-8 w-16 mx-auto" /> : formatNumber(stats?.refuelingToday ?? 0)}</p>
                <p className="text-xs text-muted-foreground">Заправок ВС</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-2xl font-semibold">{isLoading ? <Skeleton className="h-8 w-20 mx-auto" /> : formatNumber(stats?.totalVolumeSold ?? 0)}</p>
                <p className="text-xs text-muted-foreground">кг продано</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-2xl font-semibold">{isLoading ? <Skeleton className="h-8 w-24 mx-auto" /> : formatCurrency(stats?.totalProfitMonth ?? 0)}</p>
                <p className="text-xs text-muted-foreground">Прибыль</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
