import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  FlaskConical, 
  Calendar, 
  Stethoscope,
  FileDown,
  Loader2,
  Eye,
  CheckCircle2,
  Info,
  TestTubes,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface ExamOrderWithDetails {
  id: number;
  exams: Array<{
    name: string;
    instructions?: string;
  }>;
  clinicalJustification: string | null;
  issuedAt: string;
  status: string;
  doctorName: string;
  doctorSpecialty: string;
  appointmentId: number | null;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return <Badge className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" data-testid="status-completed">Completada</Badge>;
    case "cancelled":
      return <Badge variant="destructive" data-testid="status-cancelled">Cancelada</Badge>;
    case "pending":
    default:
      return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" data-testid="status-pending">Pendiente</Badge>;
  }
}

export default function ExamOrdersPage() {
  const { toast } = useToast();
  const [previewOrder, setPreviewOrder] = useState<ExamOrderWithDetails | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const { data: orders, isLoading } = useQuery<ExamOrderWithDetails[]>({
    queryKey: ["/api/exam-orders"],
  });

  const handleDownload = async (order: ExamOrderWithDetails) => {
    if (!order.appointmentId) {
      toast({ title: "Error", description: "No se puede descargar esta orden", variant: "destructive" });
      return;
    }
    setDownloadingId(order.id);
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`/api/consultations/${order.appointmentId}/documents/pdf?types=exams`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Error al descargar");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orden_examenes_${order.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Error", description: "No se pudo descargar la orden de exámenes", variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-exam-orders-title">Órdenes de Exámenes</h1>
        <p className="text-muted-foreground mt-1">
          Órdenes de exámenes médicos de tus consultas
        </p>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          <>
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <Skeleton className="h-10 w-10 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-48" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                    </div>
                    <Skeleton className="h-20 w-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        ) : orders && orders.length > 0 ? (
          orders.map((order) => (
            <Card key={order.id} data-testid={`exam-order-${order.id}`}>
              <CardContent className="p-4 sm:p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-950/50 flex items-center justify-center flex-shrink-0">
                      <FlaskConical className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">Orden de Exámenes</h3>
                        {getStatusBadge(order.status)}
                      </div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <Stethoscope className="h-3.5 w-3.5" />
                        {order.doctorName} - {order.doctorSpecialty}
                      </p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {format(parseISO(order.issuedAt), "d MMM yyyy", { locale: es })}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewOrder(order)}
                      data-testid={`preview-exam-order-${order.id}`}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Ver
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(order)}
                      disabled={downloadingId === order.id || !order.appointmentId}
                      data-testid={`download-exam-order-${order.id}`}
                    >
                      {downloadingId === order.id ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <FileDown className="h-4 w-4 mr-2" />
                      )}
                      Descargar
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg bg-muted/50 p-4 space-y-3">
                  <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                    <TestTubes className="h-4 w-4" />
                    Exámenes solicitados ({order.exams.length})
                  </h4>
                  {order.exams.map((exam, i) => (
                    <div key={i} className="flex items-start gap-3 pb-3 border-b border-border/50 last:border-0 last:pb-0">
                      <CheckCircle2 className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm" data-testid={`text-exam-name-${order.id}-${i}`}>{exam.name}</p>
                        {exam.instructions && (
                          <p className="text-sm text-muted-foreground mt-0.5">{exam.instructions}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {order.clinicalJustification && (
                  <div className="bg-blue-50 dark:bg-blue-950/50 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-sm text-blue-800 dark:text-blue-200">
                          Justificación clínica
                        </h4>
                        <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                          {order.clinicalJustification}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card data-testid="exam-orders-empty-state">
            <CardContent className="py-12 text-center">
              <FlaskConical className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium text-lg mb-2">No tienes órdenes de exámenes</h3>
              <p className="text-muted-foreground mb-4">
                Las órdenes de exámenes de tus consultas aparecerán aquí
              </p>
              <Button asChild data-testid="button-schedule-from-exams">
                <Link href="/appointments/new">Agendar Consulta</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!previewOrder} onOpenChange={() => setPreviewOrder(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              Orden de Exámenes
            </DialogTitle>
          </DialogHeader>
          {previewOrder && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                {getStatusBadge(previewOrder.status)}
                <div className="text-sm text-muted-foreground">
                  {format(parseISO(previewOrder.issuedAt), "d 'de' MMMM, yyyy", { locale: es })}
                </div>
              </div>

              <div className="text-sm">
                <p className="font-medium">{previewOrder.doctorName}</p>
                <p className="text-muted-foreground">{previewOrder.doctorSpecialty}</p>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <TestTubes className="h-4 w-4" />
                  Exámenes solicitados
                </h4>
                {previewOrder.exams.map((exam, i) => (
                  <div key={i} className="p-3 rounded-lg border">
                    <p className="font-medium text-sm">{exam.name}</p>
                    {exam.instructions && (
                      <p className="text-sm text-muted-foreground mt-1">{exam.instructions}</p>
                    )}
                  </div>
                ))}
              </div>

              {previewOrder.clinicalJustification && (
                <div className="bg-blue-50 dark:bg-blue-950/50 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-sm text-blue-800 dark:text-blue-200">Justificación clínica</h4>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">{previewOrder.clinicalJustification}</p>
                    </div>
                  </div>
                </div>
              )}

              <Button
                className="w-full"
                onClick={() => handleDownload(previewOrder)}
                disabled={downloadingId === previewOrder.id || !previewOrder.appointmentId}
                data-testid="btn-download-exam-order-preview"
              >
                {downloadingId === previewOrder.id ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4 mr-2" />
                )}
                Descargar PDF
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
