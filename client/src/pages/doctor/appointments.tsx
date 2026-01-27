import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import { Calendar, Clock, Video, Phone, Play, X, Check, Users } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AppointmentWithPatient {
  id: number;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes: number;
  status: string;
  consultationType: string;
  notes?: string;
  patientName: string;
  patientImage?: string;
}

function getStatusBadge(status: string) {
  const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    scheduled: { label: "Programada", variant: "outline" },
    confirmed: { label: "Confirmada", variant: "default" },
    in_progress: { label: "En curso", variant: "default" },
    completed: { label: "Completada", variant: "secondary" },
    cancelled: { label: "Cancelada", variant: "destructive" },
  };
  const s = statusMap[status] || { label: status, variant: "outline" };
  return <Badge variant={s.variant} data-testid={`status-badge-${status}`}>{s.label}</Badge>;
}

function AppointmentCard({ appointment, onStatusChange }: { 
  appointment: AppointmentWithPatient;
  onStatusChange: (id: number, status: string) => void;
}) {
  const canConfirm = appointment.status === "scheduled";
  const canStart = appointment.status === "confirmed";
  const canCancel = appointment.status === "scheduled" || appointment.status === "confirmed";

  return (
    <Card className="hover-elevate" data-testid={`appointment-${appointment.id}`}>
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <Avatar className="h-14 w-14 sm:h-16 sm:w-16 flex-shrink-0">
            <AvatarImage src={appointment.patientImage} />
            <AvatarFallback className="bg-secondary/10 text-secondary text-lg">
              {appointment.patientName?.split(" ").map(n => n[0]).join("") || "P"}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-lg" data-testid={`text-patient-name-${appointment.id}`}>
                  {appointment.patientName}
                </h3>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {getStatusBadge(appointment.status)}
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span data-testid={`text-date-${appointment.id}`}>
                  {format(parseISO(appointment.scheduledDate), "EEEE d 'de' MMMM, yyyy", { locale: es })}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span data-testid={`text-time-${appointment.id}`}>
                  {appointment.scheduledTime.slice(0, 5)} ({appointment.durationMinutes} min)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {appointment.consultationType === "video" ? (
                  <Video className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Phone className="h-4 w-4 text-muted-foreground" />
                )}
                <span data-testid={`text-type-${appointment.id}`}>
                  {appointment.consultationType === "video" ? "Videollamada" : "Llamada"}
                </span>
              </div>
            </div>

            {appointment.notes && (
              <p className="text-sm text-muted-foreground bg-muted/50 rounded-md p-2">
                {appointment.notes}
              </p>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              {canStart && (
                <Button asChild data-testid={`button-start-${appointment.id}`}>
                  <Link href={`/consultation/${appointment.id}`}>
                    <Play className="h-4 w-4 mr-2" />
                    Iniciar Consulta
                  </Link>
                </Button>
              )}
              {canConfirm && (
                <Button 
                  variant="outline" 
                  onClick={() => onStatusChange(appointment.id, "confirmed")}
                  data-testid={`button-confirm-${appointment.id}`}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Confirmar
                </Button>
              )}
              {canCancel && (
                <Button 
                  variant="ghost" 
                  className="text-destructive hover:text-destructive"
                  onClick={() => onStatusChange(appointment.id, "cancelled")}
                  data-testid={`button-cancel-${appointment.id}`}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DoctorAppointmentsPage() {
  const { toast } = useToast();

  const { data: appointments, isLoading } = useQuery<AppointmentWithPatient[]>({
    queryKey: ["/api/doctors/me/appointments"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await apiRequest("PATCH", `/api/appointments/${id}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctors/me/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/doctors/me/stats"] });
      toast({
        title: "Estado actualizado",
        description: "La cita ha sido actualizada correctamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el estado de la cita",
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = (id: number, status: string) => {
    updateStatusMutation.mutate({ id, status });
  };

  const filterAppointments = (status?: string) => {
    if (!appointments) return [];
    if (!status || status === "all") return appointments;
    return appointments.filter(a => a.status === status);
  };

  const allAppointments = filterAppointments();
  const scheduledAppointments = filterAppointments("scheduled");
  const confirmedAppointments = filterAppointments("confirmed");
  const completedAppointments = filterAppointments("completed");
  const cancelledAppointments = filterAppointments("cancelled");

  const renderAppointmentList = (list: AppointmentWithPatient[]) => {
    if (isLoading) {
      return (
        <>
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <Skeleton className="h-16 w-16 rounded-full" />
                  <div className="flex-1 space-y-3">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-64" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </>
      );
    }

    if (list.length === 0) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No hay citas en esta categoría</p>
          </CardContent>
        </Card>
      );
    }

    return list.map((appointment) => (
      <AppointmentCard 
        key={appointment.id} 
        appointment={appointment} 
        onStatusChange={handleStatusChange}
      />
    ));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-page-title">Mis Citas</h1>
        <p className="text-muted-foreground mt-1">
          Gestiona todas tus consultas médicas
        </p>
      </div>

      <Tabs defaultValue="all" className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="all" data-testid="tab-all">
            Todas ({allAppointments.length})
          </TabsTrigger>
          <TabsTrigger value="scheduled" data-testid="tab-scheduled">
            Programadas ({scheduledAppointments.length})
          </TabsTrigger>
          <TabsTrigger value="confirmed" data-testid="tab-confirmed">
            Confirmadas ({confirmedAppointments.length})
          </TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed">
            Completadas ({completedAppointments.length})
          </TabsTrigger>
          <TabsTrigger value="cancelled" data-testid="tab-cancelled">
            Canceladas ({cancelledAppointments.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {renderAppointmentList(allAppointments)}
        </TabsContent>

        <TabsContent value="scheduled" className="space-y-4">
          {renderAppointmentList(scheduledAppointments)}
        </TabsContent>

        <TabsContent value="confirmed" className="space-y-4">
          {renderAppointmentList(confirmedAppointments)}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {renderAppointmentList(completedAppointments)}
        </TabsContent>

        <TabsContent value="cancelled" className="space-y-4">
          {renderAppointmentList(cancelledAppointments)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
