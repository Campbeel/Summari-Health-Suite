import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { 
  Calendar, 
  Clock, 
  FileText, 
  ChevronRight,
  CheckCircle,
  Video,
  Phone,
  Users
} from "lucide-react";
import { format, parseISO, isToday, isTomorrow } from "date-fns";
import { es } from "date-fns/locale";

interface DoctorStats {
  todayAppointments: number;
  upcomingAppointments: number;
  completedConsultations: number;
}

interface AppointmentWithPatient {
  id: number;
  scheduledDate: string;
  scheduledTime: string;
  status: string;
  consultationType: string;
  patientName: string;
  patientImage?: string;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "scheduled":
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" data-testid={`status-${status}`}>Programada</Badge>;
    case "confirmed":
      return <Badge className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" data-testid={`status-${status}`}>Confirmada</Badge>;
    case "in_progress":
      return <Badge className="bg-primary text-primary-foreground" data-testid={`status-${status}`}>En curso</Badge>;
    case "completed":
      return <Badge variant="secondary" data-testid={`status-${status}`}>Completada</Badge>;
    case "cancelled":
      return <Badge variant="destructive" data-testid={`status-${status}`}>Cancelada</Badge>;
    default:
      return <Badge variant="outline" data-testid={`status-${status}`}>{status}</Badge>;
  }
}

function formatAppointmentDate(dateStr: string) {
  const date = parseISO(dateStr);
  if (isToday(date)) return "Hoy";
  if (isTomorrow(date)) return "Mañana";
  return format(date, "d 'de' MMMM", { locale: es });
}

function getConsultationTypeIcon(type: string) {
  return type === "video" ? <Video className="h-4 w-4" /> : <Phone className="h-4 w-4" />;
}

export default function DoctorDashboard() {
  const { user } = useAuth();

  const { data: stats, isLoading: loadingStats } = useQuery<DoctorStats>({
    queryKey: ["/api/doctors/me/stats"],
  });

  const { data: appointments, isLoading: loadingAppointments } = useQuery<AppointmentWithPatient[]>({
    queryKey: ["/api/doctors/me/appointments"],
  });

  const upcomingAppointments = appointments?.filter(a => 
    a.status === "scheduled" || a.status === "confirmed"
  ).slice(0, 5) || [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-page-title">
            Panel del Doctor
          </h1>
          <p className="text-muted-foreground mt-1">
            Bienvenido, Dr. {user?.lastName || user?.firstName || ""}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" asChild data-testid="button-view-schedule">
            <Link href="/doctor/appointments">
              <Calendar className="h-4 w-4 mr-2" />
              Ver Agenda
            </Link>
          </Button>
          <Button variant="outline" asChild data-testid="button-view-records">
            <Link href="/doctor/patients">
              <FileText className="h-4 w-4 mr-2" />
              Ver Expedientes
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card data-testid="stat-card-today">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <div>
              {loadingStats ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <p className="text-2xl font-bold" data-testid="text-today-count">
                  {stats?.todayAppointments || 0}
                </p>
              )}
              <p className="text-sm text-muted-foreground">Citas de Hoy</p>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="stat-card-pending">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
              <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              {loadingStats ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <p className="text-2xl font-bold" data-testid="text-upcoming-count">
                  {stats?.upcomingAppointments || 0}
                </p>
              )}
              <p className="text-sm text-muted-foreground">Citas Pendientes</p>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="stat-card-completed">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-950 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              {loadingStats ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <p className="text-2xl font-bold" data-testid="text-completed-count">
                  {stats?.completedConsultations || 0}
                </p>
              )}
              <p className="text-sm text-muted-foreground">Consultas Completadas</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
          <div>
            <CardTitle>Próximas Citas</CardTitle>
            <CardDescription>Tus consultas programadas</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild data-testid="link-view-all-appointments">
            <Link href="/doctor/appointments">
              Ver todas
              <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingAppointments ? (
            <>
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-lg border">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </>
          ) : upcomingAppointments.length > 0 ? (
            upcomingAppointments.map((appointment) => (
              <div
                key={appointment.id}
                className="flex items-center gap-4 p-4 rounded-lg border hover-elevate cursor-pointer"
                data-testid={`appointment-card-${appointment.id}`}
              >
                <Avatar className="h-12 w-12">
                  <AvatarImage src={appointment.patientImage} />
                  <AvatarFallback className="bg-secondary/10 text-secondary">
                    {appointment.patientName?.split(" ").map(n => n[0]).join("") || "P"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate" data-testid={`text-patient-name-${appointment.id}`}>
                    {appointment.patientName}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {getConsultationTypeIcon(appointment.consultationType)}
                    <span>{appointment.consultationType === "video" ? "Videollamada" : "Llamada"}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium" data-testid={`text-appointment-date-${appointment.id}`}>
                    {formatAppointmentDate(appointment.scheduledDate)}
                  </p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1 justify-end">
                    <Clock className="h-3 w-3" />
                    {appointment.scheduledTime.slice(0, 5)}
                  </p>
                </div>
                <div>
                  {getStatusBadge(appointment.status)}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No tienes citas programadas</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
