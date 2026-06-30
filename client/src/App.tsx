import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useRole, homeForRole } from "@/hooks/use-role";
import { useIdleTimeout } from "@/hooks/use-idle-timeout";
import { AppSidebar } from "@/components/app-sidebar";
import { NotificationBell } from "@/components/notification-bell";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import NotFound from "@/pages/not-found";
import AuthLoginPage from "@/pages/auth-login";
import ConsultationPage from "@/pages/consultation";
import DoctorDashboard from "@/pages/doctor/dashboard";
import ConsultationValidationPage from "@/pages/doctor/consultation-validation";
import DoctorPatientsPage from "@/pages/doctor/patients";
import PatientDetailPage from "@/pages/doctor/patient-detail";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import AdminDashboardPage from "@/pages/admin/dashboard";
import AdminUsersPage from "@/pages/admin/users";

const IDLE_TIMEOUT_MS = 20 * 60 * 1000;
const IDLE_WARN_MS = 60 * 1000;

function IdleSessionGuard() {
  const { isAuthenticated, logout } = useAuth();
  const { isWarning, dismissWarning } = useIdleTimeout({
    idleMs: IDLE_TIMEOUT_MS,
    warnBeforeMs: IDLE_WARN_MS,
    onWarn: () => {},
    onTimeout: () => {
      if (isAuthenticated) logout();
    },
    enabled: isAuthenticated,
  });

  return (
    <AlertDialog open={isWarning}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Sigues ahí?</AlertDialogTitle>
          <AlertDialogDescription>
            Por seguridad cerraremos tu sesión en menos de un minuto por inactividad. Haz clic para mantenerla abierta.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={dismissWarning} data-testid="button-stay-signed-in">
            Mantener sesión
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "13rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-4 p-3 border-b bg-background/80 backdrop-blur-md sticky top-0 z-10">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-1">
              <NotificationBell />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 sm:p-6">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function StaffProtectedRoute({ component: Component, fullScreen }: { component: React.ComponentType; fullScreen?: boolean }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { role, isLoading: roleLoading } = useRole();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (authLoading || roleLoading) return;
    if (!isAuthenticated) {
      navigate("/login");
    } else if (role === "admin") {
      navigate("/admin/dashboard");
    }
  }, [authLoading, roleLoading, isAuthenticated, role, navigate]);

  if (authLoading || roleLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAuthenticated || role !== "staff") {
    return null;
  }

  if (fullScreen) {
    return (
      <div className="flex flex-col h-screen w-full overflow-hidden">
        <Component />
      </div>
    );
  }

  return (
    <AuthenticatedLayout>
      <Component />
    </AuthenticatedLayout>
  );
}

function AdminProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { role, isLoading: roleLoading } = useRole();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (authLoading || roleLoading) return;
    if (!isAuthenticated) {
      navigate("/login");
    } else if (role === "staff") {
      navigate("/staff/dashboard");
    }
  }, [authLoading, roleLoading, isAuthenticated, role, navigate]);

  if (authLoading || roleLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAuthenticated || role !== "admin") {
    return null;
  }

  return (
    <AuthenticatedLayout>
      <Component />
    </AuthenticatedLayout>
  );
}

function StaffLegacyRedirect({ to }: { to: string }) {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate(to);
  }, [navigate, to]);
  return null;
}

function RedirectToStaffDashboard() {
  return <StaffLegacyRedirect to="/staff/dashboard" />;
}

function LegacyDoctorRedirect() {
  const [location, navigate] = useLocation();
  useEffect(() => {
    if (location.startsWith("/doctor")) {
      navigate(location.replace(/^\/doctor/, "/staff"));
    }
  }, [location, navigate]);
  return null;
}

function PublicAuthRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();
  const { role, isLoading: roleLoading } = useRole();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && !roleLoading && isAuthenticated && role) {
      navigate(homeForRole(role));
    }
  }, [isLoading, roleLoading, isAuthenticated, role, navigate]);

  if (isLoading || roleLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (isAuthenticated && role) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return <Component />;
}

function Router() {
  const { isLoading } = useAuth();
  const { isLoading: roleLoading } = useRole();

  if (isLoading || roleLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/">
        <PublicAuthRoute component={AuthLoginPage} />
      </Route>
      <Route path="/login">
        <PublicAuthRoute component={AuthLoginPage} />
      </Route>
      <Route path="/recuperar-contrasena">
        <PublicAuthRoute component={ForgotPasswordPage} />
      </Route>
      <Route path="/restablecer-contrasena">
        <PublicAuthRoute component={ResetPasswordPage} />
      </Route>
      <Route path="/consultation/:id">
        <StaffProtectedRoute component={ConsultationPage} fullScreen />
      </Route>
      <Route path="/staff/dashboard">
        <StaffProtectedRoute component={DoctorDashboard} />
      </Route>
      <Route path="/staff/appointments">
        <StaffProtectedRoute component={RedirectToStaffDashboard} />
      </Route>
      <Route path="/staff/profile">
        <StaffProtectedRoute component={RedirectToStaffDashboard} />
      </Route>
      <Route path="/staff/patients">
        <StaffProtectedRoute component={DoctorPatientsPage} />
      </Route>
      <Route path="/staff/patients/:patientId">
        <StaffProtectedRoute component={PatientDetailPage} />
      </Route>
      <Route path="/staff/consultation/:id/validate">
        <StaffProtectedRoute component={ConsultationValidationPage} />
      </Route>
      <Route path="/doctor/dashboard">
        <StaffProtectedRoute component={LegacyDoctorRedirect} />
      </Route>
      <Route path="/doctor/appointments">
        <StaffProtectedRoute component={LegacyDoctorRedirect} />
      </Route>
      <Route path="/doctor/profile">
        <StaffProtectedRoute component={LegacyDoctorRedirect} />
      </Route>
      <Route path="/doctor/patients/:patientId">
        <StaffProtectedRoute component={LegacyDoctorRedirect} />
      </Route>
      <Route path="/doctor/patients">
        <StaffProtectedRoute component={LegacyDoctorRedirect} />
      </Route>
      <Route path="/doctor/consultation/:id/validate">
        <StaffProtectedRoute component={LegacyDoctorRedirect} />
      </Route>
      <Route path="/admin/dashboard">
        <AdminProtectedRoute component={AdminDashboardPage} />
      </Route>
      <Route path="/admin/users">
        <AdminProtectedRoute component={AdminUsersPage} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Router />
          <IdleSessionGuard />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
