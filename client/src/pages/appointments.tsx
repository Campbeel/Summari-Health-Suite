import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import { Calendar, Clock, Plus, Video, Phone, MapPin, CreditCard, Loader2 } from "lucide-react";
import { format, parseISO, isAfter, isBefore } from "date-fns";
import { es } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AppointmentWithDetails {
  id: number;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes: number;
  status: string;
  paymentStatus: string;
  consultationType: string;
  notes?: string;
  doctorName: string;
  doctorSpecialty: string;
  doctorImage?: string;
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
  return <Badge variant={s.variant}>{s.label}</Badge>;
}


function AppointmentCard({ appointment }: { appointment: AppointmentWithDetails }) {
  const { toast } = useToast();
  const isUpcoming = isAfter(parseISO(appointment.scheduledDate), new Date()) || 
    (format(new Date(), "yyyy-MM-dd") === appointment.scheduledDate);
  const canJoin = appointment.status === "confirmed" || appointment.status === "in_progress";

  const payMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/appointments/${appointment.id}/pay`);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error al procesar el pago",
        description: error.message || "Por favor intenta nuevamente",
        variant: "destructive",
      });
    },
  });

  return (
    <Card className="hover-elevate" data-testid={`appointment-${appointment.id}`}>
      <CardContent className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <Avatar className="h-14 w-14 sm:h-16 sm:w-16 flex-shrink-0">
            <AvatarImage src={appointment.doctorImage} />
            <AvatarFallback className="bg-primary/10 text-primary text-lg">
              {appointment.doctorName?.split(" ").map(n => n[0]).join("") || "DR"}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-lg">{appointment.doctorName}</h3>
                <p className="text-muted-foreground">{appointment.doctorSpecialty}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {getStatusBadge(appointment.status)}
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>{format(parseISO(appointment.scheduledDate), "EEEE d 'de' MMMM, yyyy", { locale: es })}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{appointment.scheduledTime.slice(0, 5)} ({appointment.durationMinutes} min)</span>
              </div>
              <div className="flex items-center gap-1.5">
                {appointment.consultationType === "video" ? (
                  <Video className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Phone className="h-4 w-4 text-muted-foreground" />
                )}
                <span>{appointment.consultationType === "video" ? "Videollamada" : "Llamada"}</span>
              </div>
            </div>

            {appointment.notes && (
              <p className="text-sm text-muted-foreground bg-muted/50 rounded-md p-2">
                {appointment.notes}
              </p>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              {isUpcoming && canJoin && (
                <Button asChild data-testid={`join-appointment-${appointment.id}`}>
                  <Link href={`/consultation/${appointment.id}`}>
                    <Video className="h-4 w-4 mr-2" />
                    Unirse a consulta
                  </Link>
                </Button>
              )}
              {isUpcoming && appointment.paymentStatus === "pending" && (
                <Button 
                  variant="outline" 
                  onClick={() => payMutation.mutate()}
                  disabled={payMutation.isPending}
                  data-testid={`pay-appointment-${appointment.id}`}
                >
                  {payMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CreditCard className="h-4 w-4 mr-2" />
                  )}
                  Pagar consulta
                </Button>
              )}
              <Button variant="ghost" asChild>
                <Link href={`/consultation/${appointment.id}`}>
                  Ver detalles
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AppointmentsPage() {
  const { data: appointments, isLoading } = useQuery<AppointmentWithDetails[]>({
    queryKey: ["/api/appointments"],
  });

  const today = new Date();
  const upcoming = appointments?.filter(a => 
    isAfter(parseISO(a.scheduledDate), today) || format(today, "yyyy-MM-dd") === a.scheduledDate
  ) || [];
  const past = appointments?.filter(a => 
    isBefore(parseISO(a.scheduledDate), today) && format(today, "yyyy-MM-dd") !== a.scheduledDate
  ) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Mis Consultas</h1>
          <p className="text-muted-foreground mt-1">
            Gestiona todas tus citas médicas
          </p>
        </div>
        <Button asChild data-testid="button-schedule-appointment">
          <Link href="/appointments/new">
            <Plus className="h-4 w-4 mr-2" />
            Nueva Consulta
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="upcoming" className="space-y-6">
        <TabsList>
          <TabsTrigger value="upcoming" data-testid="tab-upcoming">
            Próximas ({upcoming.length})
          </TabsTrigger>
          <TabsTrigger value="past" data-testid="tab-past">
            Anteriores ({past.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-4">
          {isLoading ? (
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
          ) : upcoming.length > 0 ? (
            upcoming.map((appointment) => (
              <AppointmentCard key={appointment.id} appointment={appointment} />
            ))
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium text-lg mb-2">No tienes consultas programadas</h3>
                <p className="text-muted-foreground mb-4">
                  Agenda una consulta con un especialista
                </p>
                <Button asChild>
                  <Link href="/appointments/new">Agendar Consulta</Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="past" className="space-y-4">
          {past.length > 0 ? (
            past.map((appointment) => (
              <AppointmentCard key={appointment.id} appointment={appointment} />
            ))
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  No tienes consultas anteriores
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
