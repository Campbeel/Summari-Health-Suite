import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import { useDoctor } from "@/hooks/use-doctor";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";

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
import PaymentsPage from "@/pages/payments";
import PaymentResultPage from "@/pages/payment-result";
import ProfilePage from "@/pages/profile";
import DoctorDashboard from "@/pages/doctor/dashboard";
import DoctorAppointmentsPage from "@/pages/doctor/appointments";
import DoctorProfilePage from "@/pages/doctor/profile";
import AdminUsersPage from "@/pages/admin/users";
import PatientRegisterPage from "@/pages/patient-register";

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-4 p-3 border-b bg-background/80 backdrop-blur-md sticky top-0 z-10">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <ThemeToggle />
          </header>
          <main className="flex-1 overflow-auto p-4 sm:p-6">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();
  const { isDoctor, isLoading: doctorLoading } = useDoctor();
  const [location, navigate] = useLocation();

  const { data: registrationStatus, isLoading: regLoading } = useQuery<{ registered: boolean; patient: any }>({
    queryKey: ["/api/patients/registration-status"],
    enabled: isAuthenticated && !doctorLoading && !isDoctor,
  });

  const needsRegCheck = isAuthenticated && !doctorLoading && !isDoctor;
  const shouldRedirectToLogin = !isLoading && !isAuthenticated;
  const shouldRedirectToRegistro = !isDoctor && registrationStatus && !registrationStatus.registered;

  useEffect(() => {
    if (shouldRedirectToLogin && location !== "/") {
      navigate("/login");
    }
  }, [shouldRedirectToLogin, location, navigate]);

  useEffect(() => {
    if (shouldRedirectToRegistro && location !== "/registro") {
      navigate("/registro");
    }
  }, [shouldRedirectToRegistro, location, navigate]);

  if (isLoading || doctorLoading || (needsRegCheck && regLoading)) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (shouldRedirectToLogin || shouldRedirectToRegistro) {
    return null;
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
          <ProtectedRoute component={Dashboard} />
        ) : (
          <LandingPage />
        )}
      </Route>
      <Route path="/login">
        {isAuthenticated ? <ProtectedRoute component={Dashboard} /> : <AuthLoginPage />}
      </Route>
      <Route path="/crear-cuenta">
        {isAuthenticated ? <ProtectedRoute component={Dashboard} /> : <AuthRegisterPage />}
      </Route>
      <Route path="/registro">
        {isAuthenticated ? <PatientRegisterPage /> : <AuthLoginPage />}
      </Route>
      <Route path="/appointments">
        <ProtectedRoute component={AppointmentsPage} />
      </Route>
      <Route path="/appointments/new">
        <ProtectedRoute component={BookAppointmentPage} />
      </Route>
      <Route path="/consultation/:id">
        <ProtectedRoute component={ConsultationPage} />
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
      <Route path="/payments">
        <ProtectedRoute component={PaymentsPage} />
      </Route>
      <Route path="/payment/result">
        <ProtectedRoute component={PaymentResultPage} />
      </Route>
      <Route path="/profile">
        <ProtectedRoute component={ProfilePage} />
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
      <Route path="/admin/users">
        <ProtectedRoute component={AdminUsersPage} />
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
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
