import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, useLocation } from "wouter";
import { Calendar, Clock, Video, Phone, Play, X, Check, Users, FileCheck } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ConsultationSummaryDialog } from "@/components/consultation-summary-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
    pending_validation: { label: "Por validar", variant: "outline" },
    completed: { label: "Completada", variant: "secondary" },
    cancelled: { label: "Cancelada", variant: "destructive" },
  };
  const s = statusMap[status] || { label: status, variant: "outline" };
  return <Badge variant={s.variant} data-testid={`status-badge-${status}`}>{s.label}</Badge>;
}

function AppointmentCard({ appointment, onStatusChange, onOpenSummary }: { 
  appointment: AppointmentWithPatient;
  onStatusChange: (id: number, status: string) => void;
  onOpenSummary: (id: number) => void;
}) {
  const [, navigate] = useLocation();
  const canConfirm = appointment.status === "scheduled";
  const canStart = appointment.status === "confirmed";
  const canCancel = appointment.status === "scheduled" || appointment.status === "confirmed";
  const canValidate = appointment.status === "pending_validation";
  const isSummaryView = appointment.status === "completed";

  const detailsUrl = appointment.status === "pending_validation"
    ? `/staff/consultation/${appointment.id}/validate`
    : `/consultation/${appointment.id}`;

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
      data-testid={`appointment-${appointment.id}`}
      onClick={() => isSummaryView ? onOpenSummary(appointment.id) : navigate(detailsUrl)}
    >
      <Avatar className="h-9 w-9 flex-shrink-0">
        <AvatarImage src={appointment.patientImage} />
        <AvatarFallback className="bg-secondary/10 text-secondary text-xs">
          {appointment.patientName?.split(" ").map(n => n[0]).join("") || "P"}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate" data-testid={`text-patient-name-${appointment.id}`}>
            {appointment.patientName}
          </span>
          {getStatusBadge(appointment.status)}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
          <span className="flex items-center gap-1" data-testid={`text-date-${appointment.id}`}>
            <Calendar className="h-3 w-3" />
            {format(parseISO(appointment.scheduledDate), "d MMM yyyy", { locale: es })}
          </span>
          <span className="flex items-center gap-1" data-testid={`text-time-${appointment.id}`}>
            <Clock className="h-3 w-3" />
            {appointment.scheduledTime.slice(0, 5)}
          </span>
          <span className="flex items-center gap-1" data-testid={`text-type-${appointment.id}`}>
            {appointment.consultationType === "video" ? <Video className="h-3 w-3" /> : <Phone className="h-3 w-3" />}
            {appointment.durationMinutes} min
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        {canValidate && (
          <Button size="sm" asChild data-testid={`button-validate-${appointment.id}`}>
            <Link href={`/staff/consultation/${appointment.id}/validate`}>
              <FileCheck className="h-3.5 w-3.5 mr-1" />
              Validar
            </Link>
          </Button>
        )}
        {canStart && (
          <Button size="sm" asChild data-testid={`button-start-${appointment.id}`}>
            <Link href={`/consultation/${appointment.id}`}>
              <Play className="h-3.5 w-3.5 mr-1" />
              Iniciar
            </Link>
          </Button>
        )}
        {canConfirm && (
          <Button size="sm" variant="outline" onClick={() => onStatusChange(appointment.id, "confirmed")} data-testid={`button-confirm-${appointment.id}`}>
            <Check className="h-3.5 w-3.5 mr-1" />
            Confirmar
          </Button>
        )}
        {canCancel && (
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => onStatusChange(appointment.id, "cancelled")} data-testid={`button-cancel-${appointment.id}`}>
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
        {appointment.status === "completed" && (
          <Button size="sm" variant="outline" onClick={() => onOpenSummary(appointment.id)} data-testid={`button-summary-${appointment.id}`}>
            Ver resumen
          </Button>
        )}
      </div>
    </div>
  );
}

export default function DoctorAppointmentsPage() {
  const { toast } = useToast();
  const [summaryId, setSummaryId] = useState<number | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AppointmentWithPatient | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancelReasonError, setCancelReasonError] = useState<string | null>(null);

  const { data: appointments, isLoading } = useQuery<AppointmentWithPatient[]>({
    queryKey: ["/api/doctors/me/appointments"],
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, cancellationReason }: { id: number; status: string; cancellationReason?: string }) => {
      const body: Record<string, unknown> = { status };
      if (cancellationReason) body.cancellationReason = cancellationReason;
      const response = await apiRequest("PATCH", `/api/appointments/${id}/status`, body);
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
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err?.message || "No se pudo actualizar el estado de la cita",
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = (id: number, status: string) => {
    updateStatusMutation.mutate({ id, status });
  };

  const closeCancelDialog = () => {
    setCancelTarget(null);
    setCancellationReason("");
    setCancelReasonError(null);
  };

  const submitCancellation = () => {
    const reason = cancellationReason.trim();
    if (reason.length < 3) {
      setCancelReasonError("Ingresa un motivo (mínimo 3 caracteres).");
      return;
    }
    if (!cancelTarget) return;
    updateStatusMutation.mutate({ id: cancelTarget.id, status: "cancelled", cancellationReason: reason });
    closeCancelDialog();
  };

  const filterAppointments = (status?: string) => {
    if (!appointments) return [];
    if (!status || status === "all") return appointments;
    return appointments.filter(a => a.status === status);
  };

  const allAppointments = filterAppointments();
  const scheduledAppointments = filterAppointments("scheduled");
  const confirmedAppointments = filterAppointments("confirmed");
  const pendingValidationAppointments = filterAppointments("pending_validation");
  const completedAppointments = filterAppointments("completed");
  const cancelledAppointments = filterAppointments("cancelled");

  const renderAppointmentList = (list: AppointmentWithPatient[]) => {
    if (isLoading) {
      return (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg border">
              <Skeleton className="h-9 w-9 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (list.length === 0) {
      return (
        <div className="py-8 text-center text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No hay citas en esta categoría</p>
        </div>
      );
    }

    return (
      <div className="max-h-[70vh] overflow-y-auto space-y-1.5 pr-1">
        {list.map((appointment) => (
          <AppointmentCard 
            key={appointment.id} 
            appointment={appointment} 
            onStatusChange={handleStatusChange}
            onOpenSummary={setSummaryId}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <ConsultationSummaryDialog
        appointmentId={summaryId}
        open={summaryId !== null}
        onOpenChange={(open) => { if (!open) setSummaryId(null); }}
        isDoctor={true}
      />
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
          <TabsTrigger value="pending_validation" data-testid="tab-pending-validation">
            Por validar ({pendingValidationAppointments.length})
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

        <TabsContent value="pending_validation" className="space-y-4">
          {renderAppointmentList(pendingValidationAppointments)}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {renderAppointmentList(completedAppointments)}
        </TabsContent>

        <TabsContent value="cancelled" className="space-y-4">
          {renderAppointmentList(cancelledAppointments)}
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && closeCancelDialog()}>
        <AlertDialogContent data-testid="dialog-cancel-appointment">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar esta cita?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Esta acción no se puede deshacer. Se notificará al paciente con el motivo indicado.</p>
                {cancelTarget && (
                  <div className="rounded-md border bg-muted/40 p-3 text-sm text-foreground">
                    <div><span className="text-muted-foreground">Paciente:</span> <span className="font-medium" data-testid="text-cancel-patient">{cancelTarget.patientName}</span></div>
                    <div><span className="text-muted-foreground">Fecha:</span> <span className="font-medium" data-testid="text-cancel-date">{format(parseISO(cancelTarget.scheduledDate), "PPP", { locale: es })}</span></div>
                    <div><span className="text-muted-foreground">Hora:</span> <span className="font-medium" data-testid="text-cancel-time">{cancelTarget.scheduledTime}</span></div>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="cancellation-reason">
              Motivo de la cancelación <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="cancellation-reason"
              value={cancellationReason}
              onChange={(e) => {
                setCancellationReason(e.target.value);
                if (cancelReasonError) setCancelReasonError(null);
              }}
              placeholder="Ej: Inasistencia del paciente, emergencia del médico, etc."
              rows={3}
              data-testid="input-cancellation-reason"
            />
            {cancelReasonError && (
              <p className="text-xs text-destructive" data-testid="error-cancellation-reason">
                {cancelReasonError}
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeCancelDialog} data-testid="button-keep-appointment">
              Conservar cita
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                submitCancellation();
              }}
              data-testid="button-confirm-cancel"
            >
              Sí, cancelar cita
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
