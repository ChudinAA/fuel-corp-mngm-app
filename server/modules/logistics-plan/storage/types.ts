import type {
  LogisticsTransportUnit,
  InsertLogisticsTransportUnit,
  LogisticsDriverSchedule,
  InsertLogisticsDriverSchedule,
  LogisticsVehicleAvailability,
  InsertLogisticsVehicleAvailability,
  LogisticsPlanRoute,
  InsertLogisticsPlanRoute,
  LogisticsPlanComment,
  InsertLogisticsPlanComment,
  LogisticsMonthlySync,
  InsertLogisticsMonthlySync,
  LogisticsPlanNotification,
  InsertLogisticsPlanNotification,
} from "@shared/schema";

export interface ILogisticsPlanStorage {
  // Transport Units
  getAllTransportUnits(filters?: { carrierId?: string; periodFrom?: string; periodTo?: string }): Promise<LogisticsTransportUnit[]>;
  getTransportUnit(id: string): Promise<LogisticsTransportUnit | undefined>;
  createTransportUnit(data: InsertLogisticsTransportUnit): Promise<LogisticsTransportUnit>;
  updateTransportUnit(id: string, data: Partial<InsertLogisticsTransportUnit>): Promise<LogisticsTransportUnit | undefined>;
  deleteTransportUnit(id: string, userId?: string): Promise<boolean>;

  // Driver Schedule
  getDriverSchedule(driverId: string): Promise<LogisticsDriverSchedule[]>;
  getAllDriverSchedules(filters?: { dateFrom?: string; dateTo?: string }): Promise<LogisticsDriverSchedule[]>;
  createDriverSchedule(data: InsertLogisticsDriverSchedule): Promise<LogisticsDriverSchedule>;
  updateDriverSchedule(id: string, data: Partial<InsertLogisticsDriverSchedule>): Promise<LogisticsDriverSchedule | undefined>;
  deleteDriverSchedule(id: string, userId?: string): Promise<boolean>;

  // Vehicle Availability
  getVehicleAvailability(vehicleId: string): Promise<LogisticsVehicleAvailability[]>;
  getAllVehicleAvailabilities(filters?: { dateFrom?: string; dateTo?: string }): Promise<LogisticsVehicleAvailability[]>;
  createVehicleAvailability(data: InsertLogisticsVehicleAvailability): Promise<LogisticsVehicleAvailability>;
  updateVehicleAvailability(id: string, data: Partial<InsertLogisticsVehicleAvailability>): Promise<LogisticsVehicleAvailability | undefined>;
  deleteVehicleAvailability(id: string, userId?: string): Promise<boolean>;

  // Plan Routes
  getPlanRoutes(filters?: { periodFrom?: string; periodTo?: string; scenarioId?: string; transportUnitId?: string }): Promise<LogisticsPlanRoute[]>;
  getPlanRoute(id: string): Promise<LogisticsPlanRoute | undefined>;
  createPlanRoute(data: InsertLogisticsPlanRoute): Promise<LogisticsPlanRoute>;
  updatePlanRoute(id: string, data: Partial<InsertLogisticsPlanRoute>): Promise<LogisticsPlanRoute | undefined>;
  deletePlanRoute(id: string, userId?: string): Promise<boolean>;
  getUnassignedRoutes(periodFrom: string, periodTo: string, scenarioId?: string): Promise<any[]>;

  // Plan Comments
  getRouteComments(routeId: string): Promise<LogisticsPlanComment[]>;
  createRouteComment(data: InsertLogisticsPlanComment): Promise<LogisticsPlanComment>;
  deleteRouteComment(id: string, userId?: string): Promise<boolean>;
  markCommentsRead(routeId: string): Promise<void>;

  // Monthly Syncs
  getActiveSyncs(periodFrom?: string, periodTo?: string): Promise<LogisticsMonthlySync[]>;
  getSync(id: string): Promise<LogisticsMonthlySync | undefined>;
  createSync(data: InsertLogisticsMonthlySync): Promise<LogisticsMonthlySync>;
  updateSync(id: string, data: Partial<InsertLogisticsMonthlySync>): Promise<LogisticsMonthlySync | undefined>;
  getLatestSync(scenarioId?: string): Promise<LogisticsMonthlySync | undefined>;
  getSyncByPeriodAndScenario(periodFrom: string, periodTo: string, scenarioId?: string | null): Promise<LogisticsMonthlySync | undefined>;

  // Extra Drivers
  getExtraDriversForUnit(transportUnitId: string): Promise<any[]>;
  addExtraDriver(data: { transportUnitId: string; driverId: string; notes?: string | null; createdById?: string }): Promise<any>;
  removeExtraDriver(id: string): Promise<boolean>;

  // Notifications
  getNotifications(filters?: { periodFrom?: string; periodTo?: string; isRead?: boolean }): Promise<LogisticsPlanNotification[]>;
  createNotification(data: InsertLogisticsPlanNotification): Promise<LogisticsPlanNotification>;
  markNotificationRead(id: string): Promise<void>;
  markAllNotificationsRead(periodFrom?: string, periodTo?: string): Promise<void>;
  getUnreadNotificationsCount(periodFrom?: string, periodTo?: string): Promise<number>;
}
