
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

export interface WidgetProps {
  widgetKey: string;
  config?: any;
  onRemove?: () => void;
  isEditMode?: boolean;
}
