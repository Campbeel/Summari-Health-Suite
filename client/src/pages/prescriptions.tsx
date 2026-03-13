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
  Pill, 
  Calendar, 
  Download,
  Clock,
  Stethoscope,
  AlertCircle,
  CheckCircle2,
  Eye,
  FileDown,
  Loader2,
} from "lucide-react";
import { format, parseISO, isAfter } from "date-fns";
import { es } from "date-fns/locale";

interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

interface PrescriptionWithDetails {
  id: number;
  medications: Medication[];
  instructions?: string;
  issuedAt: string;
  validUntil?: string;
  status: string;
  doctorName: string;
  doctorSpecialty: string;
  appointmentId: number | null;
}

function getStatusBadge(status: string, validUntil?: string) {
  const isExpired = validUntil && !isAfter(parseISO(validUntil), new Date());
  
  if (status === "cancelled") {
    return <Badge variant="destructive" data-testid="status-cancelled">Cancelada</Badge>;
  }
  if (isExpired || status === "expired") {
    return <Badge variant="secondary" data-testid="status-expired">Expirada</Badge>;
  }
  if (status === "dispensed") {
    return <Badge className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300" data-testid="status-dispensed">Dispensada</Badge>;
  }
  return <Badge className="bg-primary/10 text-primary" data-testid="status-active">Activa</Badge>;
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case "urgent": return "text-red-600 bg-red-50 dark:bg-red-950/50 dark:text-red-400";
    case "high": return "text-orange-600 bg-orange-50 dark:bg-orange-950/50 dark:text-orange-400";
    case "normal": return "text-blue-600 bg-blue-50 dark:bg-blue-950/50 dark:text-blue-400";
    case "low": return "text-gray-600 bg-gray-50 dark:bg-gray-950/50 dark:text-gray-400";
    default: return "text-blue-600 bg-blue-50 dark:bg-blue-950/50 dark:text-blue-400";
  }
}

export default function PrescriptionsPage() {
  const { toast } = useToast();
  const [previewPrescription, setPreviewPrescription] = useState<PrescriptionWithDetails | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const { data: prescriptions, isLoading } = useQuery<PrescriptionWithDetails[]>({
    queryKey: ["/api/prescriptions"],
  });

  const handleDownload = async (prescription: PrescriptionWithDetails) => {
    if (!prescription.appointmentId) {
      toast({ title: "Error", description: "No se puede descargar esta receta", variant: "destructive" });
      return;
    }
    setDownloadingId(prescription.id);
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`/api/consultations/${prescription.appointmentId}/documents/pdf?types=prescription`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Error al descargar");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receta_${prescription.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Error", description: "No se pudo descargar la receta", variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-prescriptions-title">Mis Recetas</h1>
        <p className="text-muted-foreground mt-1">
          Accede a tus recetas médicas y descárgalas
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
        ) : prescriptions && prescriptions.length > 0 ? (
          prescriptions.map((prescription) => (
            <Card key={prescription.id} data-testid={`prescription-${prescription.id}`}>
              <CardContent className="p-4 sm:p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0">
                      <Pill className="h-5 w-5 text-secondary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">Receta Médica</h3>
                        {getStatusBadge(prescription.status, prescription.validUntil)}
                      </div>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <Stethoscope className="h-3.5 w-3.5" />
                        {prescription.doctorName} - {prescription.doctorSpecialty}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewPrescription(prescription)}
                      data-testid={`preview-prescription-${prescription.id}`}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Ver
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(prescription)}
                      disabled={downloadingId === prescription.id || !prescription.appointmentId}
                      data-testid={`download-prescription-${prescription.id}`}
                    >
                      {downloadingId === prescription.id ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <FileDown className="h-4 w-4 mr-2" />
                      )}
                      Descargar
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    Emitida: {format(parseISO(prescription.issuedAt), "d MMM yyyy", { locale: es })}
                  </span>
                  {prescription.validUntil && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      Válida hasta: {format(parseISO(prescription.validUntil), "d MMM yyyy", { locale: es })}
                    </span>
                  )}
                </div>

                <div className="prescription-paper rounded-lg p-4 space-y-3" data-testid={`medications-list-${prescription.id}`}>
                  <h4 className="font-medium text-sm mb-3">Medicamentos</h4>
                  {prescription.medications.map((med, i) => (
                    <div key={i} className="flex items-start gap-3 pb-3 border-b last:border-0 last:pb-0" data-testid={`medication-item-${prescription.id}-${i}`}>
                      <CheckCircle2 className="h-4 w-4 text-secondary mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium" data-testid={`text-medication-name-${prescription.id}-${i}`}>{med.name}</p>
                        <p className="text-sm text-muted-foreground" data-testid={`text-medication-dosage-${prescription.id}-${i}`}>
                          {med.dosage} - {med.frequency}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Duración: {med.duration}
                        </p>
                        {med.instructions && (
                          <p className="text-sm text-muted-foreground mt-1 italic">
                            {med.instructions}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {prescription.instructions && (
                  <div className="bg-amber-50 dark:bg-amber-950/50 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-sm text-amber-800 dark:text-amber-200">
                          Indicaciones generales
                        </h4>
                        <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                          {prescription.instructions}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card data-testid="prescriptions-empty-state">
            <CardContent className="py-12 text-center">
              <Pill className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium text-lg mb-2">No tienes recetas</h3>
              <p className="text-muted-foreground mb-4">
                Las recetas de tus consultas aparecerán aquí
              </p>
              <Button asChild data-testid="button-schedule-from-prescriptions">
                <Link href="/appointments/new">Agendar Consulta</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!previewPrescription} onOpenChange={() => setPreviewPrescription(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pill className="h-5 w-5 text-secondary" />
              Receta Médica
            </DialogTitle>
          </DialogHeader>
          {previewPrescription && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                {getStatusBadge(previewPrescription.status, previewPrescription.validUntil)}
                <div className="text-sm text-muted-foreground">
                  {format(parseISO(previewPrescription.issuedAt), "d 'de' MMMM, yyyy", { locale: es })}
                </div>
              </div>

              <div className="text-sm">
                <p className="font-medium">{previewPrescription.doctorName}</p>
                <p className="text-muted-foreground">{previewPrescription.doctorSpecialty}</p>
              </div>

              <div className="prescription-paper rounded-lg p-4 space-y-3">
                <h4 className="font-medium text-sm mb-3">Medicamentos</h4>
                {previewPrescription.medications.map((med, i) => (
                  <div key={i} className="pb-3 border-b last:border-0 last:pb-0">
                    <p className="font-medium">{med.name}</p>
                    <p className="text-sm text-muted-foreground">{med.dosage} - {med.frequency}</p>
                    <p className="text-sm text-muted-foreground">Duración: {med.duration}</p>
                    {med.instructions && (
                      <p className="text-sm text-muted-foreground mt-1 italic">{med.instructions}</p>
                    )}
                  </div>
                ))}
              </div>

              {previewPrescription.instructions && (
                <div className="bg-amber-50 dark:bg-amber-950/50 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-sm text-amber-800 dark:text-amber-200">Indicaciones generales</h4>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">{previewPrescription.instructions}</p>
                    </div>
                  </div>
                </div>
              )}

              <Button
                className="w-full"
                onClick={() => handleDownload(previewPrescription)}
                disabled={downloadingId === previewPrescription.id || !previewPrescription.appointmentId}
                data-testid="btn-download-prescription-preview"
              >
                {downloadingId === previewPrescription.id ? (
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
