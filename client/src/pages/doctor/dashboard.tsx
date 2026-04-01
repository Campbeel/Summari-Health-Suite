import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link, useLocation } from "wouter";
import {
  Calendar,
  Clock,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  Video,
  Phone,
  Users,
  AlertCircle,
  ClipboardCheck,
  Play,
  FileCheck,
  Check,
  X,
} from "lucide-react";
import { format, parseISO, isToday, addDays, subDays, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface DoctorStats {
  todayAppointments: number;
  upcomingAppointments: number;
  completedConsultations: number;
}

interface AppointmentWithPatient {
  id: number;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes?: number;
  status: string;
  consultationType: string;
  notes?: string;
  patientName: string;
  patientImage?: string;
}

function PatientPresenceDot({ appointmentId }: { appointmentId: number }) {
  const { data } = useQuery<{ patientOnline: boolean; patientWaiting: boolean }>({
    queryKey: ["/api/appointments", appointmentId, "presence"],
    queryFn: async () => {
      const res = await fetch(`/api/appointments/${appointmentId}/presence`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      return res.json();
    },
    refetchInterval: 15000,
  });

  if (!data?.patientOnline && !data?.patientWaiting) return null;

  return (
    <span className="flex items-center gap-1" data-testid={`presence-patient-${appointmentId}`}>
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
      </span>
      <span className="text-[10px] text-green-600 dark:text-green-400 font-normal">
        {data?.patientWaiting ? "Esperando" : "En línea"}
      </span>
    </span>
  );
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; darkBg: string; barColor: string }> = {
  scheduled: {
    label: "Programada",
    color: "text-blue-700 dark:text-blue-300",
    bg: "bg-blue-50 dark:bg-blue-950/50",
    darkBg: "bg-blue-100 dark:bg-blue-900",
    barColor: "bg-blue-500",
  },
  confirmed: {
    label: "Confirmada",
    color: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-50 dark:bg-emerald-950/50",
    darkBg: "bg-emerald-100 dark:bg-emerald-900",
    barColor: "bg-emerald-500",
  },
  in_progress: {
    label: "En curso",
    color: "text-purple-700 dark:text-purple-300",
    bg: "bg-purple-50 dark:bg-purple-950/50",
    darkBg: "bg-purple-100 dark:bg-purple-900",
    barColor: "bg-purple-500",
  },
  completed: {
    label: "Completada",
    color: "text-gray-600 dark:text-gray-400",
    bg: "bg-gray-50 dark:bg-gray-900/50",
    darkBg: "bg-gray-100 dark:bg-gray-800",
    barColor: "bg-gray-400 dark:bg-gray-600",
  },
  pending_validation: {
    label: "Pendiente validación",
    color: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-50 dark:bg-amber-950/50",
    darkBg: "bg-amber-100 dark:bg-amber-900",
    barColor: "bg-amber-500",
  },
  cancelled: {
    label: "Cancelada",
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/50",
    darkBg: "bg-red-100 dark:bg-red-900",
    barColor: "bg-red-400",
  },
};

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] || {
    label: status,
    color: "text-gray-600",
    bg: "bg-gray-50 dark:bg-gray-900",
    darkBg: "bg-gray-100",
    barColor: "bg-gray-400",
  };
}

function generateTimeSlots(startHour: number, endHour: number): string[] {
  const slots: string[] = [];
  for (let h = startHour; h <= endHour; h++) {
    slots.push(`${h.toString().padStart(2, "0")}:00`);
    if (h < endHour) slots.push(`${h.toString().padStart(2, "0")}:30`);
  }
  return slots;
}

function getEndTime(startTime: string, durationMinutes: number): string {
  const [h, m] = startTime.split(":").map(Number);
  const totalMin = h * 60 + m + durationMinutes;
  const endH = Math.floor(totalMin / 60);
  const endM = totalMin % 60;
  return `${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export default function DoctorDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedAppt, setSelectedAppt] = useState<AppointmentWithPatient | null>(null);

  const { data: stats, isLoading: loadingStats } = useQuery<DoctorStats>({
    queryKey: ["/api/doctors/me/stats"],
  });

  const { data: appointments, isLoading: loadingAppointments } = useQuery<AppointmentWithPatient[]>({
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
      setSelectedAppt(null);
      toast({ title: "Estado actualizado", description: "La cita ha sido actualizada correctamente" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar el estado", variant: "destructive" });
    },
  });

  const todayAppts = useMemo(() => {
    if (!appointments) return [];
    return appointments
      .filter((a) => {
        const apptDate = parseISO(a.scheduledDate);
        return isSameDay(apptDate, selectedDate) && a.status !== "cancelled";
      })
      .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
  }, [appointments, selectedDate]);

  const timeSlots = useMemo(() => {
    if (todayAppts.length === 0) return generateTimeSlots(8, 18);
    const times = todayAppts.map((a) => timeToMinutes(a.scheduledTime));
    const endTimes = todayAppts.map((a) => timeToMinutes(a.scheduledTime) + (a.durationMinutes || 30));
    const earliest = Math.min(...times);
    const latest = Math.max(...endTimes);
    const startH = Math.floor(earliest / 60);
    const endH = Math.ceil(latest / 60);
    return generateTimeSlots(startH, endH);
  }, [todayAppts]);

  const dayLabel = format(selectedDate, "d 'de' MMMM 'de' yyyy", { locale: es });
  const weekdayLabel = format(selectedDate, "EEEE", { locale: es });
  const isTodaySelected = isToday(selectedDate);

  const handleAppointmentClick = (appt: AppointmentWithPatient) => {
    setSelectedAppt(appt);
  };

  const completedToday = todayAppts.filter(a => a.status === "completed" || a.status === "pending_validation").length;
  const pendingToday = todayAppts.filter(a => a.status === "scheduled" || a.status === "confirmed").length;
  const inProgressToday = todayAppts.filter(a => a.status === "in_progress").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-page-title">
            Agenda Profesional
          </h1>
          <p className="text-muted-foreground mt-1">
            Dr. {user?.lastName || user?.firstName || ""}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" asChild data-testid="button-view-all-appointments">
            <Link href="/doctor/appointments">
              <Calendar className="h-4 w-4 mr-2" />
              Todas las citas
            </Link>
          </Button>
        </div>
      </div>


      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setSelectedDate(subDays(selectedDate, 1))}
                aria-label="Día anterior"
                data-testid="button-prev-day"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant={isTodaySelected ? "default" : "outline"}
                size="sm"
                className="text-xs"
                onClick={() => setSelectedDate(new Date())}
                data-testid="button-today"
              >
                Hoy
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                aria-label="Día siguiente"
                data-testid="button-next-day"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-center sm:text-left">
              <CardTitle className="text-lg capitalize" data-testid="text-selected-date">{dayLabel}</CardTitle>
              <p className="text-xs text-muted-foreground capitalize">{weekdayLabel}</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {completedToday > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-gray-400 dark:bg-gray-600" />
                  {completedToday} completada{completedToday !== 1 ? "s" : ""}
                </span>
              )}
              {pendingToday > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
                  {pendingToday} pendiente{pendingToday !== 1 ? "s" : ""}
                </span>
              )}
              {inProgressToday > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-purple-500" />
                  {inProgressToday} en curso
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingAppointments ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-4 w-12 flex-shrink-0" />
                  <Skeleton className="h-16 flex-1" />
                </div>
              ))}
            </div>
          ) : todayAppts.length > 0 ? (
            <div className="relative" data-testid="agenda-timeline">
              {timeSlots.map((slot, slotIndex) => {
                const slotMin = timeToMinutes(slot);
                const slotAppts = todayAppts.filter((a) => {
                  const aMin = timeToMinutes(a.scheduledTime);
                  return aMin >= slotMin && aMin < slotMin + 30;
                });

                return (
                  <div
                    key={slot}
                    className={`flex border-t border-border/50 min-h-[3.25rem] ${slotIndex === 0 ? "border-t-0" : ""}`}
                    data-testid={`timeslot-${slot}`}
                  >
                    <div className="w-16 sm:w-20 flex-shrink-0 py-2 px-2 sm:px-3 text-xs text-muted-foreground font-mono text-right">
                      {slot}
                    </div>
                    <div className="flex-1 py-1 pr-2 sm:pr-4 space-y-1">
                      {slotAppts.map((appt) => {
                        const cfg = getStatusConfig(appt.status);
                        const duration = appt.durationMinutes || 30;
                        const endTime = getEndTime(appt.scheduledTime, duration);
                        const isClickable = ["scheduled", "confirmed", "in_progress", "pending_validation", "completed"].includes(appt.status);
                        return (
                          <div
                            key={appt.id}
                            role={isClickable ? "button" : undefined}
                            tabIndex={isClickable ? 0 : undefined}
                            className={`flex items-stretch rounded-md overflow-hidden border ${cfg.bg} ${isClickable ? "cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none" : "opacity-75"}`}
                            onClick={() => isClickable && handleAppointmentClick(appt)}
                            onKeyDown={(e) => { if (isClickable && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); handleAppointmentClick(appt); }}}
                            aria-label={isClickable ? `Cita con ${appt.patientName} a las ${appt.scheduledTime.slice(0, 5)}` : undefined}
                            data-testid={`agenda-appointment-${appt.id}`}
                          >
                            <div className={`w-1.5 flex-shrink-0 ${cfg.barColor}`} />
                            <div className="flex-1 py-2 px-3 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[11px] font-mono text-muted-foreground">
                                  {appt.scheduledTime.slice(0, 5)} – {endTime.slice(0, 5)}
                                </span>
                                {appt.consultationType === "video" ? (
                                  <Video className="h-3 w-3 text-muted-foreground" />
                                ) : (
                                  <Phone className="h-3 w-3 text-muted-foreground" />
                                )}
                              </div>
                              <p className="font-semibold text-sm truncate flex items-center gap-1.5" data-testid={`text-patient-name-${appt.id}`}>
                                {appt.patientName}
                                {(appt.status === "confirmed" || appt.status === "in_progress") && (
                                  <PatientPresenceDot appointmentId={appt.id} />
                                )}
                              </p>
                              {appt.notes && (
                                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                  {appt.notes}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 pr-3 flex-shrink-0">
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 border-current ${cfg.color}`}
                                data-testid={`badge-status-${appt.id}`}
                              >
                                {cfg.label}
                              </Badge>
                              {isClickable && (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12" data-testid="agenda-empty">
              <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">
                {isTodaySelected ? "No hay citas programadas para hoy" : "No hay citas para este día"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Usa la navegación para ver otros días
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground px-1">
        <span className="font-medium">Leyenda:</span>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className={`w-3 h-2 rounded-sm ${cfg.barColor}`} />
            {cfg.label}
          </span>
        ))}
      </div>

      <Dialog open={selectedAppt !== null} onOpenChange={(open) => { if (!open) setSelectedAppt(null); }}>
        <DialogContent className="max-w-md" data-testid="appointment-detail-modal">
          <DialogHeader>
            <DialogTitle className="text-lg">Detalle de Cita</DialogTitle>
          </DialogHeader>
          {selectedAppt && (() => {
            const cfg = getStatusConfig(selectedAppt.status);
            const canConfirm = selectedAppt.status === "scheduled";
            const canStart = selectedAppt.status === "confirmed";
            const canValidate = selectedAppt.status === "pending_validation";
            const isInProgress = selectedAppt.status === "in_progress";
            const isCompleted = selectedAppt.status === "completed";
            return (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={selectedAppt.patientImage} />
                    <AvatarFallback className="bg-secondary/10 text-secondary">
                      {selectedAppt.patientName?.split(" ").map(n => n[0]).join("") || "P"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-base" data-testid="modal-patient-name">{selectedAppt.patientName}</p>
                    <Badge variant="outline" className={`text-xs ${cfg.color}`} data-testid="modal-status-badge">
                      {cfg.label}
                    </Badge>
                  </div>
                </div>

                <div className="rounded-lg border p-3 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span data-testid="modal-date">
                      {format(parseISO(selectedAppt.scheduledDate), "EEEE d 'de' MMMM, yyyy", { locale: es })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span data-testid="modal-time">
                      {selectedAppt.scheduledTime.slice(0, 5)} ({selectedAppt.durationMinutes || 30} min)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedAppt.consultationType === "video" ? (
                      <Video className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Phone className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span data-testid="modal-type">
                      {selectedAppt.consultationType === "video" ? "Videollamada" : "Llamada telefónica"}
                    </span>
                  </div>
                </div>

                {selectedAppt.notes && (
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Motivo de consulta</p>
                    <p className="text-sm" data-testid="modal-notes">{selectedAppt.notes}</p>
                  </div>
                )}

                <div className="flex flex-col gap-2 pt-1">
                  {canValidate && (
                    <Button className="w-full" onClick={() => navigate(`/doctor/consultation/${selectedAppt.id}/validate`)} data-testid="modal-button-validate">
                      <FileCheck className="h-4 w-4 mr-2" />
                      Validar Consulta
                    </Button>
                  )}
                  {(canStart || isInProgress) && (
                    <Button className="w-full" onClick={() => navigate(`/consultation/${selectedAppt.id}`)} data-testid="modal-button-join">
                      <Play className="h-4 w-4 mr-2" />
                      {isInProgress ? "Unirse a Consulta" : "Iniciar Consulta"}
                    </Button>
                  )}
                  {canConfirm && (
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => updateStatusMutation.mutate({ id: selectedAppt.id, status: "confirmed" })}
                      disabled={updateStatusMutation.isPending}
                      data-testid="modal-button-confirm"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Confirmar Cita
                    </Button>
                  )}
                  {isCompleted && (
                    <Button className="w-full" variant="outline" onClick={() => navigate(`/doctor/appointments`)} data-testid="modal-button-history">
                      <ClipboardCheck className="h-4 w-4 mr-2" />
                      Ver en historial
                    </Button>
                  )}
                  {(canConfirm || canStart) && (
                    <Button
                      variant="ghost"
                      className="w-full text-destructive hover:text-destructive"
                      onClick={() => updateStatusMutation.mutate({ id: selectedAppt.id, status: "cancelled" })}
                      disabled={updateStatusMutation.isPending}
                      data-testid="modal-button-cancel"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancelar Cita
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
