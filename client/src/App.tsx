import { Switch, Route, useLocation } from "wouter";
import { queryClient, setGlobalRedirectHandler } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

import AuthPage from "@/pages/auth-page";
import CustomizableDashboard from "@/pages/dashboard/index";
import DashboardTemplatesPage from "@/pages/dashboard/templates-page";
import OptPage from "@/pages/opt-page";
import RefuelingPage from "@/pages/refueling-page";
import ExchangePage from "@/pages/exchange-page";
import MovementPage from "@/pages/movement-page";
import WarehousesPage from "@/pages/warehouses-page";
import PricesPage from "@/pages/prices-page";
import DeliveryPage from "@/pages/delivery-page";
import DirectoriesPage from "@/pages/directories-page";
import UsersPage from "@/pages/admin/users-page";
import RolesPage from "@/pages/admin/roles-page";
import SettingsPage from "@/pages/admin/settings-page";
import WidgetsPage from "@/pages/admin/widgets-page";
import CashflowPage from "@/pages/finance/cashflow-page";
import PaymentCalendarPage from "@/pages/finance/payment-calendar-page";
import PriceCalculationPage from "@/pages/finance/price-calculation-page";
import DailyReportsPage from "@/pages/reports/daily-reports-page";
import AnalyticsPage from "@/pages/reports/analytics-page";
import RegistriesPage from "@/pages/reports/registries-page";
import MonthlyPlanPage from "@/pages/reports/monthly-plan-page";
import GovContractsPage from "@/pages/reports/gov-contracts-page";
import BudgetPage from "@/pages/reports/budget-page";
import ManagementReportPage from "@/pages/reports/management-report-page";
import NotFound from "@/pages/not-found";

function ProtectedRoute({ component: Component, requiredPermissions }: { component: React.ComponentType, requiredPermissions?: string[] }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  // Add permission check here if requiredPermissions are provided
  if (requiredPermissions && requiredPermissions.length > 0) {
    const hasPermission = user.permissions?.some(p => requiredPermissions.includes(p));
    if (!hasPermission) {
      // Optionally redirect to a not-authorized page or show a message
      // For now, let's assume it falls through to NotFound or similar
      // In a real app, you'd want a dedicated unauthorized page.
      console.warn("User does not have required permissions:", requiredPermissions);
      // return <NotFound />; // Or a dedicated unauthorized component
    }
  }

  return <Component />;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1">
          <header className="flex h-14 items-center justify-between gap-4 border-b px-4 lg:px-6">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto p-4 lg:p-6">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  const [, setLocation] = useLocation();

  // Set up global 401 redirect handler
  useEffect(() => {
    setGlobalRedirectHandler(() => {
      // Clear user data from cache
      queryClient.setQueryData(["/api/auth/user"], null);
      // Redirect to auth page
      setLocation("/auth");
    });
  }, [setLocation]);

  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />

      <Route path="/dashboard" element={
                <ProtectedRoute requiredPermissions={[]}>
                  <CustomizableDashboard />
                </ProtectedRoute>
              } />
              <Route path="/dashboard/templates" element={
                <ProtectedRoute requiredPermissions={[]}>
                  <DashboardTemplatesPage />
                </ProtectedRoute>
              } />

      <Route path="/opt" element={
        <AppLayout>
          <ProtectedRoute component={OptPage} />
        </AppLayout>
      } />

      <Route path="/refueling" element={
        <AppLayout>
          <ProtectedRoute component={RefuelingPage} />
        </AppLayout>
      } />

      <Route path="/exchange" element={
        <AppLayout>
          <ProtectedRoute component={ExchangePage} />
        </AppLayout>
      } />

      <Route path="/movement" element={
        <AppLayout>
          <ProtectedRoute component={MovementPage} />
        </AppLayout>
      } />

      <Route path="/warehouses" element={
        <AppLayout>
          <ProtectedRoute component={WarehousesPage} />
        </AppLayout>
      } />

      <Route path="/prices" element={
        <AppLayout>
          <ProtectedRoute component={PricesPage} />
        </AppLayout>
      } />

      <Route path="/delivery" element={
        <AppLayout>
          <ProtectedRoute component={DeliveryPage} />
        </AppLayout>
      } />

      <Route path="/directories" element={
        <AppLayout>
          <ProtectedRoute component={DirectoriesPage} />
        </AppLayout>
      } />

      <Route path="/finance/cashflow" element={
        <AppLayout>
          <ProtectedRoute component={CashflowPage} />
        </AppLayout>
      } />

      <Route path="/finance/payment-calendar" element={
        <AppLayout>
          <ProtectedRoute component={PaymentCalendarPage} />
        </AppLayout>
      } />

      <Route path="/finance/price-calculation" element={
        <AppLayout>
          <ProtectedRoute component={PriceCalculationPage} />
        </AppLayout>
      } />

      <Route path="/reports/current" element={
        <AppLayout>
          <ProtectedRoute component={DailyReportsPage} />
        </AppLayout>
      } />

      <Route path="/reports/analytics" element={
        <AppLayout>
          <ProtectedRoute component={AnalyticsPage} />
        </AppLayout>
      } />

      <Route path="/reports/registries" element={
        <AppLayout>
          <ProtectedRoute component={RegistriesPage} />
        </AppLayout>
      } />

      <Route path="/reports/monthly-plan" element={
        <AppLayout>
          <ProtectedRoute component={MonthlyPlanPage} />
        </AppLayout>
      } />

      <Route path="/reports/gov-contracts" element={
        <AppLayout>
          <ProtectedRoute component={GovContractsPage} />
        </AppLayout>
      } />

      <Route path="/reports/budget" element={
        <AppLayout>
          <ProtectedRoute component={BudgetPage} />
        </AppLayout>
      } />

      <Route path="/reports/management" element={
        <AppLayout>
          <ProtectedRoute component={ManagementReportPage} />
        </AppLayout>
      } />

      <Route path="/admin/users" element={
        <AppLayout>
          <ProtectedRoute component={UsersPage} />
        </AppLayout>
      } />

      <Route path="/admin/roles" element={
        <AppLayout>
          <ProtectedRoute component={RolesPage} />
        </AppLayout>
      } />

      <Route path="/admin/settings" element={
        <AppLayout>
          <ProtectedRoute component={SettingsPage} />
        </AppLayout>
      } />

      <Route path="/admin/widgets" element={
        <AppLayout>
          <ProtectedRoute component={WidgetsPage} />
        </AppLayout>
      } />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AuthProvider>
            <Toaster />
            <Router />
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;