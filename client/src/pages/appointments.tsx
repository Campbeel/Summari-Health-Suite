import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Link, useLocation } from "wouter";
import { Calendar, Clock, Plus, Video, Phone, CreditCard, Loader2, CalendarClock, RotateCcw, CircleDot } from "lucide-react";
import { format, parseISO, isAfter, isBefore } from "date-fns";
import { es } from "date-fns/locale";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ConsultationSummaryDialog } from "@/components/consultation-summary-dialog";

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
  consultationFee?: number;
  doctorId?: number;
}

const TIME_SLOTS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30",
  "21:00", "21:30", "22:00"
];

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


function AppointmentCard({ 
  appointment, 
  onOpenSummary,
  onReschedule,
  onReimbursement,
}: { 
  appointment: AppointmentWithDetails; 
  onOpenSummary: (id: number) => void;
  onReschedule: (appt: AppointmentWithDetails) => void;
  onReimbursement: (appt: AppointmentWithDetails) => void;
}) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const isUpcoming = isAfter(parseISO(appointment.scheduledDate), new Date()) || 
    (format(new Date(), "yyyy-MM-dd") === appointment.scheduledDate);
  const patientEndedConsultation = (() => {
    try {
      const ended = JSON.parse(localStorage.getItem("ended_consultations") || "[]");
      return ended.includes(appointment.id);
    } catch { return false; }
  })();
  const canJoin = (appointment.status === "confirmed" || appointment.status === "in_progress") && !patientEndedConsultation;
  const isSummaryView = appointment.status === "completed" || appointment.status === "pending_validation";
  const canReschedule = ["scheduled", "confirmed"].includes(appointment.status);
  const canRequestReimbursement = appointment.paymentStatus === "paid";

  const detailsUrl = `/consultation/${appointment.id}`;

  const { data: presenceData } = useQuery<{ doctorOnline: boolean; patientOnline: boolean }>({
    queryKey: ["/api/appointments", appointment.id, "presence"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/appointments/${appointment.id}/presence`);
      return res.json();
    },
    enabled: canJoin,
    refetchInterval: canJoin ? 10000 : false,
  });

  const { data: reimbursementData } = useQuery({
    queryKey: ["/api/appointments", appointment.id, "reimbursement"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/appointments/${appointment.id}/reimbursement`);
      return res.json();
    },
    enabled: canRequestReimbursement,
  });

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
    <Card 
      className="hover-elevate cursor-pointer" 
      data-testid={`appointment-${appointment.id}`}
      onClick={() => isSummaryView ? onOpenSummary(appointment.id) : navigate(detailsUrl)}
    >
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
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg">{appointment.doctorName}</h3>
                  {canJoin && presenceData?.doctorOnline && (
                    <span className="flex items-center gap-1" data-testid={`presence-doctor-${appointment.id}`}>
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                      </span>
                      <span className="text-xs text-green-600 dark:text-green-400">En línea</span>
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground">{appointment.doctorSpecialty}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {getStatusBadge(appointment.status)}
                {appointment.paymentStatus === "pending" && (
                  <Badge variant="outline" className="text-yellow-600 border-yellow-400 dark:text-yellow-400 dark:border-yellow-600">
                    Pago pendiente
                  </Badge>
                )}
                {appointment.paymentStatus === "rejected" && (
                  <Badge variant="destructive">
                    Pago rechazado
                  </Badge>
                )}
                {reimbursementData && (
                  <Badge variant="outline" className="text-blue-600 border-blue-400 dark:text-blue-400 dark:border-blue-600">
                    Reembolso: {reimbursementData.status === "pending" ? "Pendiente" : reimbursementData.status === "approved" ? "Aprobado" : "Rechazado"}
                  </Badge>
                )}
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

            <div className="flex flex-wrap gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
              {canJoin && (
                <Button asChild data-testid={`join-appointment-${appointment.id}`}>
                  <Link href={`/consultation/${appointment.id}`}>
                    <Video className="h-4 w-4 mr-2" />
                    Unirse a consulta
                  </Link>
                </Button>
              )}
              {appointment.paymentStatus === "pending" && (
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
              {canReschedule && (
                <Button 
                  variant="outline" 
                  onClick={() => onReschedule(appointment)}
                  data-testid={`reschedule-appointment-${appointment.id}`}
                >
                  <CalendarClock className="h-4 w-4 mr-2" />
                  Reagendar
                </Button>
              )}
              {canRequestReimbursement && !reimbursementData && (
                <Button 
                  variant="outline" 
                  onClick={() => onReimbursement(appointment)}
                  data-testid={`reimbursement-appointment-${appointment.id}`}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Solicitar reembolso
                </Button>
              )}
              <Button 
                variant="outline" 
                onClick={() => isSummaryView ? onOpenSummary(appointment.id) : navigate(detailsUrl)}
                data-testid={`button-details-${appointment.id}`}
              >
                Ver detalles
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AppointmentsPage() {
  const [summaryId, setSummaryId] = useState<number | null>(null);
  const [rescheduleAppt, setRescheduleAppt] = useState<AppointmentWithDetails | null>(null);
  const [reimbursementAppt, setReimbursementAppt] = useState<AppointmentWithDetails | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>();
  const [rescheduleTime, setRescheduleTime] = useState<string>("");
  const [reimbursementReason, setReimbursementReason] = useState("");
  const { toast } = useToast();

  const { data: appointments, isLoading } = useQuery<AppointmentWithDetails[]>({
    queryKey: ["/api/appointments"],
  });

  const rescheduleFormattedDate = rescheduleDate ? format(rescheduleDate, "yyyy-MM-dd") : null;

  const { data: bookedSlots = [] } = useQuery<string[]>({
    queryKey: ["/api/appointments/booked-slots", rescheduleAppt?.doctorId, rescheduleFormattedDate],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/appointments/booked-slots?doctorId=${rescheduleAppt!.doctorId}&date=${rescheduleFormattedDate}`);
      return res.json();
    },
    enabled: !!rescheduleAppt?.doctorId && !!rescheduleFormattedDate,
  });

  const rescheduleMutation = useMutation({
    mutationFn: async () => {
      if (!rescheduleAppt || !rescheduleDate || !rescheduleTime) return;
      const res = await apiRequest("POST", `/api/appointments/${rescheduleAppt.id}/reschedule`, {
        scheduledDate: format(rescheduleDate, "yyyy-MM-dd"),
        scheduledTime: rescheduleTime,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      setRescheduleAppt(null);
      setRescheduleDate(undefined);
      setRescheduleTime("");
      toast({ title: "Cita reagendada exitosamente" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al reagendar",
        description: error.message || "Intenta nuevamente",
        variant: "destructive",
      });
    },
  });

  const reimbursementMutation = useMutation({
    mutationFn: async () => {
      if (!reimbursementAppt) return;
      const res = await apiRequest("POST", `/api/appointments/${reimbursementAppt.id}/reimbursement`, {
        reason: reimbursementReason,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      if (reimbursementAppt) {
        queryClient.invalidateQueries({ queryKey: ["/api/appointments", reimbursementAppt.id, "reimbursement"] });
      }
      setReimbursementAppt(null);
      setReimbursementReason("");
      toast({ title: "Solicitud de reembolso enviada" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al solicitar reembolso",
        description: error.message || "Intenta nuevamente",
        variant: "destructive",
      });
    },
  });

  const getChileanNow = () => {
    const now = new Date();
    return new Date(now.toLocaleString("en-US", { timeZone: "America/Santiago" }));
  };

  const isSlotAvailable = (time: string) => {
    if (!rescheduleDate) return false;
    const chileanNow = getChileanNow();
    const todayStr = format(chileanNow, "yyyy-MM-dd");
    const selectedStr = format(rescheduleDate, "yyyy-MM-dd");
    if (selectedStr === todayStr) {
      const [hours, minutes] = time.split(":").map(Number);
      if (hours < chileanNow.getHours() || (hours === chileanNow.getHours() && minutes <= chileanNow.getMinutes())) return false;
    }
    if (bookedSlots.includes(time)) return false;
    return true;
  };

  const today = new Date();
  const upcoming = appointments?.filter(a => 
    isAfter(parseISO(a.scheduledDate), today) || format(today, "yyyy-MM-dd") === a.scheduledDate
  ) || [];
  const past = appointments?.filter(a => 
    isBefore(parseISO(a.scheduledDate), today) && format(today, "yyyy-MM-dd") !== a.scheduledDate
  ) || [];

  return (
    <div className="space-y-6">
      <ConsultationSummaryDialog
        appointmentId={summaryId}
        open={summaryId !== null}
        onOpenChange={(open) => { if (!open) setSummaryId(null); }}
      />

      {/* Reschedule Dialog */}
      <Dialog open={!!rescheduleAppt} onOpenChange={(open) => { if (!open) { setRescheduleAppt(null); setRescheduleDate(undefined); setRescheduleTime(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Reagendar consulta</DialogTitle>
            <DialogDescription>
              Selecciona una nueva fecha y hora para tu consulta con {rescheduleAppt?.doctorName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Fecha</Label>
              <CalendarComponent
                mode="single"
                selected={rescheduleDate}
                onSelect={(d) => { setRescheduleDate(d); setRescheduleTime(""); }}
                disabled={(date) => date < new Date() || date.getDay() === 0}
                locale={es}
                className="rounded-md border mx-auto"
              />
            </div>
            {rescheduleDate && (
              <div>
                <Label className="text-sm font-medium mb-2 block">Hora disponible</Label>
                <div className="grid grid-cols-4 gap-2 max-h-[200px] overflow-y-auto">
                  {TIME_SLOTS.map((time) => {
                    const available = isSlotAvailable(time);
                    return (
                      <Button
                        key={time}
                        variant={rescheduleTime === time ? "default" : "outline"}
                        size="sm"
                        disabled={!available}
                        onClick={() => setRescheduleTime(time)}
                        data-testid={`reschedule-time-${time}`}
                      >
                        {time}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleAppt(null)}>Cancelar</Button>
            <Button 
              onClick={() => rescheduleMutation.mutate()} 
              disabled={!rescheduleDate || !rescheduleTime || rescheduleMutation.isPending}
              data-testid="button-confirm-reschedule"
            >
              {rescheduleMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CalendarClock className="h-4 w-4 mr-2" />}
              Confirmar reagendamiento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reimbursement Dialog */}
      <Dialog open={!!reimbursementAppt} onOpenChange={(open) => { if (!open) { setReimbursementAppt(null); setReimbursementReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar reembolso</DialogTitle>
            <DialogDescription>
              Solicita un reembolso para tu consulta con {reimbursementAppt?.doctorName}
              {reimbursementAppt?.consultationFee && ` ($${reimbursementAppt.consultationFee.toLocaleString()} CLP)`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reimbursement-reason" className="text-sm font-medium">Motivo del reembolso</Label>
              <Textarea
                id="reimbursement-reason"
                value={reimbursementReason}
                onChange={(e) => setReimbursementReason(e.target.value)}
                placeholder="Describe el motivo de tu solicitud de reembolso (mínimo 10 caracteres)..."
                rows={4}
                data-testid="input-reimbursement-reason"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {reimbursementReason.length}/10 caracteres mínimos
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReimbursementAppt(null)}>Cancelar</Button>
            <Button 
              onClick={() => reimbursementMutation.mutate()} 
              disabled={reimbursementReason.trim().length < 10 || reimbursementMutation.isPending}
              data-testid="button-confirm-reimbursement"
            >
              {reimbursementMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
              Enviar solicitud
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <AppointmentCard 
                key={appointment.id} 
                appointment={appointment} 
                onOpenSummary={setSummaryId}
                onReschedule={setRescheduleAppt}
                onReimbursement={setReimbursementAppt}
              />
            ))
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-medium text-lg mb-2">No tienes consultas programadas</h3>
                <p className="text-muted-foreground">
                  Usa el botón "Nueva Consulta" para agendar con un especialista
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="past" className="space-y-4">
          {past.length > 0 ? (
            past.map((appointment) => (
              <AppointmentCard 
                key={appointment.id} 
                appointment={appointment} 
                onOpenSummary={setSummaryId}
                onReschedule={setRescheduleAppt}
                onReimbursement={setReimbursementAppt}
              />
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
