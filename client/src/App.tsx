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
import DashboardPage from "@/pages/dashboard-page";
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

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
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

      <Route path="/">
        <AppLayout>
          <ProtectedRoute component={DashboardPage} />
        </AppLayout>
      </Route>

      <Route path="/opt">
        <AppLayout>
          <ProtectedRoute component={OptPage} />
        </AppLayout>
      </Route>

      <Route path="/refueling">
        <AppLayout>
          <ProtectedRoute component={RefuelingPage} />
        </AppLayout>
      </Route>

      <Route path="/exchange">
        <AppLayout>
          <ProtectedRoute component={ExchangePage} />
        </AppLayout>
      </Route>

      <Route path="/movement">
        <AppLayout>
          <ProtectedRoute component={MovementPage} />
        </AppLayout>
      </Route>

      <Route path="/warehouses">
        <AppLayout>
          <ProtectedRoute component={WarehousesPage} />
        </AppLayout>
      </Route>

      <Route path="/prices">
        <AppLayout>
          <ProtectedRoute component={PricesPage} />
        </AppLayout>
      </Route>

      <Route path="/delivery">
        <AppLayout>
          <ProtectedRoute component={DeliveryPage} />
        </AppLayout>
      </Route>

      <Route path="/directories">
        <AppLayout>
          <ProtectedRoute component={DirectoriesPage} />
        </AppLayout>
      </Route>

      <Route path="/finance/cashflow">
        <AppLayout>
          <ProtectedRoute component={CashflowPage} />
        </AppLayout>
      </Route>

      <Route path="/finance/payment-calendar">
        <AppLayout>
          <ProtectedRoute component={PaymentCalendarPage} />
        </AppLayout>
      </Route>

      <Route path="/finance/price-calculation">
        <AppLayout>
          <ProtectedRoute component={PriceCalculationPage} />
        </AppLayout>
      </Route>

      <Route path="/reports/current">
        <AppLayout>
          <ProtectedRoute component={DailyReportsPage} />
        </AppLayout>
      </Route>

      <Route path="/reports/analytics">
        <AppLayout>
          <ProtectedRoute component={AnalyticsPage} />
        </AppLayout>
      </Route>

      <Route path="/reports/registries">
        <AppLayout>
          <ProtectedRoute component={RegistriesPage} />
        </AppLayout>
      </Route>

      <Route path="/reports/monthly-plan">
        <AppLayout>
          <ProtectedRoute component={MonthlyPlanPage} />
        </AppLayout>
      </Route>

      <Route path="/reports/gov-contracts">
        <AppLayout>
          <ProtectedRoute component={GovContractsPage} />
        </AppLayout>
      </Route>

      <Route path="/reports/budget">
        <AppLayout>
          <ProtectedRoute component={BudgetPage} />
        </AppLayout>
      </Route>

      <Route path="/reports/management">
        <AppLayout>
          <ProtectedRoute component={ManagementReportPage} />
        </AppLayout>
      </Route>

      <Route path="/admin/users">
        <AppLayout>
          <ProtectedRoute component={UsersPage} />
        </AppLayout>
      </Route>

      <Route path="/admin/roles">
        <AppLayout>
          <ProtectedRoute component={RolesPage} />
        </AppLayout>
      </Route>

      <Route path="/admin/settings">
        <AppLayout>
          <ProtectedRoute component={SettingsPage} />
        </AppLayout>
      </Route>

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