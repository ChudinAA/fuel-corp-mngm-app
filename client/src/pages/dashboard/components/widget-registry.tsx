
import { lazy } from "react";
import { WidgetProps } from "../types";

// Lazy load widget components
const OptStatsWidget = lazy(() => import("./widgets/opt-stats-widget"));
const RefuelingStatsWidget = lazy(() => import("./widgets/refueling-stats-widget"));
const ProfitMonthWidget = lazy(() => import("./widgets/profit-month-widget"));
const WarehouseAlertsWidget = lazy(() => import("./widgets/warehouse-alerts-widget"));
const RecentOperationsWidget = lazy(() => import("./widgets/recent-operations-widget"));
const WarehouseBalancesWidget = lazy(() => import("./widgets/warehouse-balances-widget"));
const WeekStatsWidget = lazy(() => import("./widgets/week-stats-widget"));

// Widget registry mapping widget keys to components
export const WIDGET_REGISTRY: Record<string, React.ComponentType<WidgetProps>> = {
  opt_stats: OptStatsWidget,
  refueling_stats: RefuelingStatsWidget,
  profit_month: ProfitMonthWidget,
  warehouse_alerts: WarehouseAlertsWidget,
  recent_operations: RecentOperationsWidget,
  warehouse_balances: WarehouseBalancesWidget,
  week_stats: WeekStatsWidget,
};

// Get widget component by key
export function getWidgetComponent(widgetKey: string): React.ComponentType<WidgetProps> | null {
  return WIDGET_REGISTRY[widgetKey] || null;
}
