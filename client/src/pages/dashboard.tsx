import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  Calendar,
  Clock,
  FileText,
  CreditCard,
  Plus,
  ChevronRight,
  Stethoscope,
  Activity,
  AlertCircle,
} from "lucide-react";
import { format, parseISO, isToday, isTomorrow } from "date-fns";
import { es } from "date-fns/locale";

interface AppointmentWithDetails {
  id: number;
  scheduledDate: string;
  scheduledTime: string;
  status: string;
  paymentStatus: string;
  consultationType: string;
  doctorName: string;
  doctorSpecialty: string;
  doctorImage?: string;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "scheduled":
      return (
        <Badge
          variant="outline"
          className="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
          data-testid={`status-${status}`}
        >
          Programada
        </Badge>
      );
    case "confirmed":
      return (
        <Badge
          className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
          data-testid={`status-${status}`}
        >
          Confirmada
        </Badge>
      );
    case "in_progress":
      return (
        <Badge
          className="bg-primary text-primary-foreground"
          data-testid={`status-${status}`}
        >
          En curso
        </Badge>
      );
    case "completed":
      return (
        <Badge variant="secondary" data-testid={`status-${status}`}>
          Completada
        </Badge>
      );
    case "cancelled":
      return (
        <Badge variant="destructive" data-testid={`status-${status}`}>
          Cancelada
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" data-testid={`status-${status}`}>
          {status}
        </Badge>
      );
  }
}

function formatAppointmentDate(dateStr: string) {
  const date = parseISO(dateStr);
  if (isToday(date)) return "Hoy";
  if (isTomorrow(date)) return "Mañana";
  return format(date, "d 'de' MMMM", { locale: es });
}

export default function Dashboard() {
  const { user } = useAuth();

  const { data: upcomingAppointments, isLoading: loadingAppointments } =
    useQuery<AppointmentWithDetails[]>({
      queryKey: ["/api/appointments/upcoming"],
    });

  const { data: recentRecords, isLoading: loadingRecords } = useQuery<any[]>({
    queryKey: ["/api/clinical-records/recent"],
  });

  const { data: patientProfile, isLoading: loadingProfile } = useQuery<any>({
    queryKey: ["/api/patients/profile"],
  });

  const hasActiveAppointment = upcomingAppointments?.some(
    (a) => a.status === "in_progress",
  );

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">
            Bienvenido, {user?.firstName || "Paciente"}
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestiona tus consultas y accede a tu historial médico
          </p>
        </div>
        <Button asChild data-testid="button-new-appointment">
          <Link href="/appointments/new">
            <Plus className="h-4 w-4 mr-2" />
            Nueva Consulta
          </Link>
        </Button>
      </div>

      {/* Active Consultation Alert */}
      {hasActiveAppointment && (
        <Card className="border-primary bg-primary/5">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                <Activity className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <p className="font-medium">Tienes una consulta en curso</p>
                <p className="text-sm text-muted-foreground">
                  Únete ahora para continuar
                </p>
              </div>
            </div>
            <Button asChild data-testid="button-join-consultation">
              <Link
                href={`/consultation/${upcomingAppointments?.find((a) => a.status === "in_progress")?.id}`}
              >
                Unirse
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="stat-card-appointments">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p
                className="text-2xl font-bold"
                data-testid="text-appointments-count"
              >
                {upcomingAppointments?.length || 0}
              </p>
              <p className="text-sm text-muted-foreground">Citas próximas</p>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-card-records">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center">
              <FileText className="h-6 w-6 text-secondary" />
            </div>
            <div>
              <p
                className="text-2xl font-bold"
                data-testid="text-records-count"
              >
                {recentRecords?.length || 0}
              </p>
              <p className="text-sm text-muted-foreground">
                Registros clínicos
              </p>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-card-specialists">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center">
              <Stethoscope className="h-6 w-6 text-accent" />
            </div>
            <div>
              <p
                className="text-2xl font-bold"
                data-testid="text-specialists-count"
              >
                3
              </p>
              <p className="text-sm text-muted-foreground">Especialistas</p>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-card-balance">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-950 flex items-center justify-center">
              <CreditCard className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold" data-testid="text-balance">
                $0
              </p>
              <p className="text-sm text-muted-foreground">Balance pendiente</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Upcoming Appointments */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-4">
              <div>
                <CardTitle>Próximas Consultas</CardTitle>
                <CardDescription>Tus citas médicas agendadas</CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                asChild
                data-testid="link-view-all-appointments"
              >
                <Link href="/appointments">
                  Ver todas
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingAppointments ? (
                <>
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className="flex items-center gap-4 p-4 rounded-lg border"
                    >
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
                </>
              ) : upcomingAppointments && upcomingAppointments.length > 0 ? (
                upcomingAppointments.slice(0, 3).map((appointment) => (
                  <div
                    key={appointment.id}
                    className="flex items-center gap-4 p-4 rounded-lg border hover-elevate cursor-pointer"
                    data-testid={`appointment-card-${appointment.id}`}
                  >
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={appointment.doctorImage} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {appointment.doctorName
                          ?.split(" ")
                          .map((n) => n[0])
                          .join("") || "DR"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {appointment.doctorName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {appointment.doctorSpecialty}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {formatAppointmentDate(appointment.scheduledDate)}
                      </p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 justify-end">
                        <Clock className="h-3 w-3" />
                        {appointment.scheduledTime.slice(0, 5)}
                      </p>
                    </div>
                    <div>{getStatusBadge(appointment.status)}</div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground mb-4">
                    No tienes consultas programadas
                  </p>
                  <Button asChild data-testid="button-schedule-consultation">
                    <Link href="/appointments/new">Agendar Consulta</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions & Profile Completion */}
        <div className="space-y-6">
          {/* Profile Completion */}
          {!loadingProfile && patientProfile && !patientProfile.dateOfBirth && (
            <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800 dark:text-amber-200">
                      Completa tu perfil
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      Agrega tu información médica para una mejor atención
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      asChild
                      data-testid="button-complete-profile"
                    >
                      <Link href="/profile">Completar Perfil</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Records */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Registros Recientes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingRecords ? (
                <>
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-3 rounded-lg border"
                    >
                      <Skeleton className="h-8 w-8 rounded" />
                      <div className="flex-1 space-y-1">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-2 w-16" />
                      </div>
                    </div>
                  ))}
                </>
              ) : recentRecords && recentRecords.length > 0 ? (
                recentRecords.slice(0, 3).map((record: any) => (
                  <Link
                    key={record.id}
                    href={`/records/${record.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg border hover-elevate block"
                    data-testid={`record-link-${record.id}`}
                  >
                    <div className="w-8 h-8 rounded bg-secondary/10 flex items-center justify-center">
                      <FileText className="h-4 w-4 text-secondary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {record.diagnosis || "Consulta"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(record.recordDate), "d MMM yyyy", {
                          locale: es,
                        })}
                      </p>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay registros aún
                </p>
              )}
              {recentRecords && recentRecords.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  asChild
                  data-testid="link-view-all-records"
                >
                  <Link href="/records">Ver todos los registros</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
