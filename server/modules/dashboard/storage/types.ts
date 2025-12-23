export interface IDashboardStorage {
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
}
