
export interface WidgetDefinition {
  id: string;
  widgetKey: string;
  name: string;
  description?: string;
  category: string;
  defaultWidth: number;
  defaultHeight: number;
  minWidth: number;
  minHeight: number;
  requiredPermissions: string[];
  configSchema?: any;
  isActive: boolean;
  createdAt: string;
}

export interface DashboardWidget {
  id: string;
  widgetKey: string;
  x: number;
  y: number;
  w: number;
  h: number;
  config?: any;
}

export interface DashboardLayout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DashboardConfiguration {
  id: string;
  userId: string;
  isDefault: boolean;
  layout: DashboardLayout[];
  widgets: DashboardWidget[];
  createdAt: string;
  updatedAt?: string;
}

export interface IDashboardStorage {
  // Старые методы (для совместимости)
  getDashboardStats(): Promise<{
    optDealsToday: number;
    refuelingToday: number;
    warehouseAlerts: number;
    totalProfitMonth: number;
    pendingDeliveries: number;
    totalVolumeSold: number;
  }>;
  getRecentOperations(): Promise<any[]>;
  getWeekStats(): Promise<{
    optDealsWeek: number;
    refuelingsWeek: number;
    volumeSoldWeek: number;
    profitWeek: number;
  }>;
  
  // Новые методы для виджетов
  getAvailableWidgets(userPermissions: string[]): Promise<WidgetDefinition[]>;
  getUserDashboard(userId: string): Promise<DashboardConfiguration | null>;
  saveDashboardConfiguration(userId: string, layout: DashboardLayout[], widgets: DashboardWidget[]): Promise<DashboardConfiguration>;
  getWidgetData(widgetKey: string, config?: any): Promise<any>;
}
