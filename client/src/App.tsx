import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import { useDoctor } from "@/hooks/use-doctor";
import { useRole, type UserRole } from "@/hooks/use-role";
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
import LandingPage from "@/pages/landing";
import AuthLoginPage from "@/pages/auth-login";
import AuthRegisterPage from "@/pages/auth-register";
import Dashboard from "@/pages/dashboard";
import AppointmentsPage from "@/pages/appointments";
import BookAppointmentPage from "@/pages/book-appointment";
import ConsultationPage from "@/pages/consultation";
import RecordsPage from "@/pages/records";
import RecordDetailPage from "@/pages/record-detail";
import PrescriptionsPage from "@/pages/prescriptions";
import MedicalInstructionsPage from "@/pages/medical-instructions";
import ExamOrdersPage from "@/pages/exam-orders";
import PaymentsPage from "@/pages/payments";
import PaymentResultPage from "@/pages/payment-result";
import ProfilePage from "@/pages/profile";
import DoctorDashboard from "@/pages/doctor/dashboard";
import DoctorAppointmentsPage from "@/pages/doctor/appointments";
import DoctorProfilePage from "@/pages/doctor/profile";
import ConsultationValidationPage from "@/pages/doctor/consultation-validation";
import DoctorPatientsPage from "@/pages/doctor/patients";
import PatientDetailPage from "@/pages/doctor/patient-detail";
import AdminUsersPage from "@/pages/admin/users";
import AdminDashboardPage from "@/pages/admin/dashboard";
import AdminSchedulesPage from "@/pages/admin/schedules";
import SuperAdminDashboardPage from "@/pages/super-admin/dashboard";
import SuperAdminOrganizationsPage from "@/pages/super-admin/organizations";
import SuperAdminUsersPage from "@/pages/super-admin/users";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import HealthDataPage from "@/pages/health-data";
import ConsultationFeedbackPage from "@/pages/consultation-feedback";
import ConsultationSummaryPage from "@/pages/consultation-summary";

function homeForRole(role: UserRole): string {
  switch (role) {
    case "doctor": return "/doctor/dashboard";
    case "admin": return "/admin/dashboard";
    case "superAdmin": return "/super-admin/dashboard";
    case "patient": default: return "/";
  }
}

// Inactivity bound for an authenticated session. Combined with the server-side JWT TTL this is the
// effective max time a forgotten browser stays usable.
const IDLE_TIMEOUT_MS = 20 * 60 * 1000; // 20 min
const IDLE_WARN_MS = 60 * 1000; // show the warning for the last 60s

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

function ProtectedRoute({ component: Component, fullScreen, allowedRoles }: { component: React.ComponentType; fullScreen?: boolean; allowedRoles?: UserRole[] }) {
  const { isAuthenticated, isLoading } = useAuth();
  const { role, isLoading: roleLoading } = useRole();
  const [location, navigate] = useLocation();

  const shouldRedirectToLogin = !isLoading && !isAuthenticated;
  const wrongRole = isAuthenticated && !roleLoading && allowedRoles && !allowedRoles.includes(role);

  useEffect(() => {
    if (shouldRedirectToLogin && location !== "/") {
      navigate("/login");
    } else if (wrongRole) {
      navigate(homeForRole(role));
    }
  }, [shouldRedirectToLogin, wrongRole, role, location, navigate]);

  if (isLoading || (allowedRoles && roleLoading)) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (shouldRedirectToLogin || wrongRole) {
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

function DoctorProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { isDoctor, isLoading: doctorLoading } = useDoctor();
  const [, navigate] = useLocation();

  const shouldRedirect = !authLoading && !doctorLoading && (!isAuthenticated || !isDoctor);

  useEffect(() => {
    if (shouldRedirect) {
      navigate("/login");
    }
  }, [shouldRedirect, navigate]);

  if (authLoading || doctorLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (shouldRedirect) {
    return null;
  }

  return (
    <AuthenticatedLayout>
      <Component />
    </AuthenticatedLayout>
  );
}

function RoleHomeRedirect() {
  const { role, isLoading: roleLoading } = useRole();
  const { currentRole, isLoading: doctorLoading } = useDoctor();
  const isLoading = roleLoading || doctorLoading;
  const [, navigate] = useLocation();
  // A doctor who has opted into the patient view stays on the patient home.
  const effectiveRole: UserRole = role === "doctor" && currentRole === "patient" ? "patient" : role;
  useEffect(() => {
    if (!isLoading && effectiveRole !== "patient") {
      navigate(homeForRole(effectiveRole));
    }
  }, [effectiveRole, isLoading, navigate]);
  if (isLoading || effectiveRole !== "patient") {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  return <Dashboard />;
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/">
        {isAuthenticated ? (
          <ProtectedRoute component={RoleHomeRedirect} allowedRoles={["patient", "doctor", "admin", "superAdmin"]} />
        ) : (
          <LandingPage />
        )}
      </Route>
      <Route path="/login">
        {isAuthenticated ? <ProtectedRoute component={RoleHomeRedirect} /> : <AuthLoginPage />}
      </Route>
      <Route path="/crear-cuenta">
        {isAuthenticated ? <ProtectedRoute component={RoleHomeRedirect} /> : <AuthRegisterPage />}
      </Route>
      <Route path="/recuperar-contrasena">
        {isAuthenticated ? <ProtectedRoute component={RoleHomeRedirect} /> : <ForgotPasswordPage />}
      </Route>
      <Route path="/restablecer-contrasena">
        {isAuthenticated ? <ProtectedRoute component={RoleHomeRedirect} /> : <ResetPasswordPage />}
      </Route>
      <Route path="/appointments">
        <ProtectedRoute component={AppointmentsPage} />
      </Route>
      <Route path="/appointments/new">
        <ProtectedRoute component={BookAppointmentPage} />
      </Route>
      <Route path="/consultation/:id/summary">
        <ProtectedRoute component={ConsultationSummaryPage} />
      </Route>
      <Route path="/consultation/:id">
        <ProtectedRoute component={ConsultationPage} fullScreen />
      </Route>
      <Route path="/consultation/:id/feedback">
        <ProtectedRoute component={ConsultationFeedbackPage} fullScreen />
      </Route>
      <Route path="/records">
        <ProtectedRoute component={RecordsPage} />
      </Route>
      <Route path="/records/:id">
        <ProtectedRoute component={RecordDetailPage} />
      </Route>
      <Route path="/prescriptions">
        <ProtectedRoute component={PrescriptionsPage} />
      </Route>
      <Route path="/indicaciones">
        <ProtectedRoute component={MedicalInstructionsPage} />
      </Route>
      <Route path="/examenes">
        <ProtectedRoute component={ExamOrdersPage} />
      </Route>
      <Route path="/payments">
        <ProtectedRoute component={PaymentsPage} />
      </Route>
      <Route path="/payment/result">
        <ProtectedRoute component={PaymentResultPage} />
      </Route>
      <Route path="/profile">
        <ProtectedRoute component={ProfilePage} />
      </Route>
      <Route path="/health-data">
        <ProtectedRoute component={HealthDataPage} />
      </Route>
      <Route path="/doctor/dashboard">
        <DoctorProtectedRoute component={DoctorDashboard} />
      </Route>
      <Route path="/doctor/appointments">
        <DoctorProtectedRoute component={DoctorAppointmentsPage} />
      </Route>
      <Route path="/doctor/profile">
        <DoctorProtectedRoute component={DoctorProfilePage} />
      </Route>
      <Route path="/doctor/patients">
        <DoctorProtectedRoute component={DoctorPatientsPage} />
      </Route>
      <Route path="/doctor/patients/:patientId">
        <DoctorProtectedRoute component={PatientDetailPage} />
      </Route>
      <Route path="/doctor/consultation/:id/validate">
        <DoctorProtectedRoute component={ConsultationValidationPage} />
      </Route>
      <Route path="/admin/dashboard">
        <ProtectedRoute component={AdminDashboardPage} allowedRoles={["admin"]} />
      </Route>
      <Route path="/admin/users">
        <ProtectedRoute component={AdminUsersPage} allowedRoles={["admin"]} />
      </Route>
      <Route path="/admin/schedules">
        <ProtectedRoute component={AdminSchedulesPage} allowedRoles={["admin"]} />
      </Route>
      <Route path="/super-admin/dashboard">
        <ProtectedRoute component={SuperAdminDashboardPage} allowedRoles={["superAdmin"]} />
      </Route>
      <Route path="/super-admin/organizations">
        <ProtectedRoute component={SuperAdminOrganizationsPage} allowedRoles={["superAdmin"]} />
      </Route>
      <Route path="/super-admin/users">
        <ProtectedRoute component={SuperAdminUsersPage} allowedRoles={["superAdmin"]} />
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
