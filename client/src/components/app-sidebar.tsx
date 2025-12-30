import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Fuel,
  ShoppingCart,
  Plane,
  ArrowLeftRight,
  Warehouse,
  DollarSign,
  Truck,
  BookOpen,
  LayoutDashboard,
  Settings,
  Users,
  Shield,
  LogOut,
  ChevronUp,
  TrendingUp,
  Calendar,
  Calculator,
  ChevronRight,
  Layers,
  Database,
  Coins,
  UserCog,
  BarChart3,
  FileText,
  FileCheck,
  Briefcase,
  Table2,
} from "lucide-react";

const getMainMenuItems = () => [
  {
    title: "Дашборд",
    url: "/",
    icon: LayoutDashboard,
  },
];

const getOperationsMenuItems = (hasPermission: (module: string, action: string) => boolean) => [
  {
    title: "ОПТ",
    url: "/opt",
    icon: ShoppingCart,
    permission: "opt.view",
  },
  {
    title: "Заправка ВС",
    url: "/refueling",
    icon: Plane,
    permission: "refueling.view",
  },
  {
    title: "Биржа",
    url: "/exchange",
    icon: TrendingUp,
    permission: "exchange.view",
  },
  {
    title: "Перемещение",
    url: "/movement",
    icon: ArrowLeftRight,
    permission: "movement.view",
  },
].filter(item => !item.permission || hasPermission(...item.permission.split('.')));

const getDataMenuItems = (hasPermission: (module: string, action: string) => boolean) => [
  {
    title: "Склады",
    url: "/warehouses",
    icon: Warehouse,
    permission: "warehouses.view",
  },
  {
    title: "Цены",
    url: "/prices",
    icon: DollarSign,
    permission: "prices.view",
  },
  {
    title: "Доставка",
    url: "/delivery",
    icon: Truck,
    permission: "delivery.view",
  },
  {
    title: "Справочники",
    url: "/directories",
    icon: BookOpen,
    permission: "directories.view",
  },
].filter(item => !item.permission || hasPermission(...item.permission.split('.')));

const getFinanceMenuItems = (hasPermission: (module: string, action: string) => boolean) => [
  {
    title: "Кешфлоу",
    url: "/finance/cashflow",
    icon: TrendingUp,
    permission: "finance.view",
  },
  {
    title: "Платежный календарь",
    url: "/finance/payment-calendar",
    icon: Calendar,
    permission: "finance.view",
  },
  {
    title: "Расчет цены",
    url: "/finance/price-calculation",
    icon: Calculator,
    permission: "finance.view",
  },
].filter(item => !item.permission || hasPermission(...item.permission.split('.')));

// New function to get reports and planning menu items
const getReportsMenuItems = (hasPermission: (module: string, action: string) => boolean) => [
  {
    title: "Текущие отчеты",
    url: "/reports/current",
    icon: FileText, // Changed to FileText for current reports
    permission: "reports.view",
  },
  {
    title: "Аналитические отчеты",
    url: "/reports/analytics",
    icon: FileCheck, // Changed to FileCheck for analytical reports
    permission: "reports.view",
  },
  {
    title: "Реестры",
    url: "/reports/registries",
    icon: Table2, // Kept BarChart3 for registries as it's a common visualization tool
    permission: "reports.view",
  },
  {
    title: "Ежемесячный план",
    url: "/reports/monthly-plan",
    icon: Calendar, // Changed to Calendar for monthly plan
    permission: "reports.create",
  },
  {
    title: "Госконтракты",
    url: "/reports/gov-contracts",
    icon: Briefcase, // Changed to Briefcase for government contracts
    permission: "reports.view",
  },
  {
    title: "БДР",
    url: "/reports/budget",
    icon: BarChart3, // Kept BarChart3 for budget reports
    permission: "reports.view",
  },
  {
    title: "Управленческий отчет",
    url: "/reports/management",
    icon: Briefcase, // Changed to Briefcase for management reports
    permission: "reports.view",
  },
].filter(item => !item.permission || hasPermission(...item.permission.split('.')));


const getAdminMenuItems = (hasPermission: (module: string, action: string) => boolean) => [
  {
    title: "Пользователи",
    url: "/admin/users",
    icon: Users,
    permission: "users.view",
  },
  {
    title: "Роли",
    url: "/admin/roles",
    icon: Shield,
    permission: "roles.view",
  },
  {
    title: "Настройки",
    url: "/admin/settings",
    icon: Settings,
  },
  {
    title: "Виджеты",
    url: "/admin/widgets",
    icon: Settings,
  },
].filter(item => !item.permission || hasPermission(...item.permission.split('.')));


export function AppSidebar() {
  const [location] = useLocation();
  const { user, logoutMutation, hasPermission } = useAuth();

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const isActive = (url: string) => {
    if (url === "/") return location === "/";
    return location.startsWith(url);
  };

  const mainMenuItems = getMainMenuItems();
  const operationsMenuItems = getOperationsMenuItems(hasPermission);
  const dataMenuItems = getDataMenuItems(hasPermission);
  const financeMenuItems = getFinanceMenuItems(hasPermission);
  const reportsMenuItems = getReportsMenuItems(hasPermission); // Get the new reports menu items
  const adminMenuItems = getAdminMenuItems(hasPermission);

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary text-primary-foreground">
            <Plane className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold">АвиаСервис</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={isActive(item.url)}
                    data-testid={`nav-${item.url.replace(/\//g, '-').slice(1) || 'dashboard'}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {operationsMenuItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <Collapsible asChild defaultOpen className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip="Операции">
                        <Layers className="h-4 w-4" />
                        <span>Операции</span>
                        <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {operationsMenuItems.map((item) => (
                          <SidebarMenuSubItem key={item.title}>
                            <SidebarMenuSubButton 
                              asChild
                              isActive={isActive(item.url)}
                              data-testid={`nav-${item.url.replace(/\//g, '-').slice(1)}`}
                            >
                              <Link href={item.url}>
                                <item.icon className="h-4 w-4" />
                                <span>{item.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {dataMenuItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <Collapsible asChild defaultOpen className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip="Данные">
                        <Database className="h-4 w-4" />
                        <span>Данные</span>
                        <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {dataMenuItems.map((item) => (
                          <SidebarMenuSubItem key={item.title}>
                            <SidebarMenuSubButton 
                              asChild
                              isActive={isActive(item.url)}
                              data-testid={`nav-${item.url.replace(/\//g, '-').slice(1)}`}
                            >
                              <Link href={item.url}>
                                <item.icon className="h-4 w-4" />
                                <span>{item.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {financeMenuItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <Collapsible asChild defaultOpen className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip="Финансы">
                        <Coins className="h-4 w-4" />
                        <span>Финансы</span>
                        <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {financeMenuItems.map((item) => (
                          <SidebarMenuSubItem key={item.title}>
                            <SidebarMenuSubButton 
                              asChild
                              isActive={isActive(item.url)}
                              data-testid={`nav-${item.url.replace(/\//g, '-').slice(1)}`}
                            >
                              <Link href={item.url}>
                                <item.icon className="h-4 w-4" />
                                <span>{item.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* New Reports and Planning section */}
        {reportsMenuItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <Collapsible asChild defaultOpen className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip="Отчеты и планирование">
                        <BarChart3 className="h-4 w-4" /> {/* Using BarChart3 as the main icon for the section */}
                        <span>Отчеты и планирование</span>
                        <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {reportsMenuItems.map((item) => (
                          <SidebarMenuSubItem key={item.title}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={isActive(item.url)}
                              data-testid={`nav-${item.url.replace(/\//g, '-').slice(1)}`}
                            >
                              <Link href={item.url}>
                                <item.icon className="h-4 w-4" />
                                <span>{item.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {adminMenuItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <Collapsible asChild defaultOpen className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip="Администрирование">
                        <UserCog className="h-4 w-4" />
                        <span>Администрирование</span>
                        <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {adminMenuItems.map((item) => (
                          <SidebarMenuSubItem key={item.title}>
                            <SidebarMenuSubButton 
                              asChild
                              isActive={isActive(item.url)}
                              data-testid={`nav-${item.url.replace(/\//g, '-').slice(1)}`}
                            >
                              <Link href={item.url}>
                                <item.icon className="h-4 w-4" />
                                <span>{item.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2 px-2 h-auto py-2"
                  data-testid="button-user-menu"
                >
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                      {user ? getInitials(user.firstName, user.lastName) : "??"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left truncate">
                    <span className="text-sm font-medium">
                      {user ? `${user.firstName} ${user.lastName}` : "Гость"}
                    </span>
                  </div>
                  <ChevronUp className="h-4 w-4 ml-auto" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                side="top" 
                className="w-56"
                align="end"
                sideOffset={4}
              >
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">
                    {user ? `${user.firstName} ${user.lastName}` : "Гость"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/admin/settings" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Настройки
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => logoutMutation.mutate()}
                  className="text-destructive focus:text-destructive cursor-pointer"
                  data-testid="button-logout"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Выйти
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}