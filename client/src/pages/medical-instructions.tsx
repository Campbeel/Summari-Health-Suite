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
  ClipboardList, 
  Calendar, 
  Stethoscope,
  FileDown,
  Loader2,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Apple,
  Dumbbell,
  Heart,
  FlaskConical,
  ArrowRight,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface InstructionWithDetails {
  id: number;
  category: string;
  title: string;
  description: string;
  priority: string;
  dueDate: string | null;
  isCompleted: boolean;
  createdAt: string;
  doctorName: string;
  doctorSpecialty: string;
  appointmentId: number | null;
}

function getPriorityBadge(priority: string) {
  switch (priority) {
    case "urgent":
      return <Badge variant="destructive" data-testid="priority-urgent">Urgente</Badge>;
    case "high":
      return <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300" data-testid="priority-high">Alta</Badge>;
    case "normal":
      return <Badge className="bg-primary/10 text-primary" data-testid="priority-normal">Normal</Badge>;
    case "low":
      return <Badge variant="secondary" data-testid="priority-low">Baja</Badge>;
    default:
      return <Badge variant="secondary">{priority}</Badge>;
  }
}

function getCategoryIcon(category: string) {
  switch (category) {
    case "diet": return <Apple className="h-5 w-5 text-green-600 dark:text-green-400" />;
    case "exercise": return <Dumbbell className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
    case "lifestyle": return <Heart className="h-5 w-5 text-pink-600 dark:text-pink-400" />;
    case "follow-up": return <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400" />;
    case "tests": return <FlaskConical className="h-5 w-5 text-orange-600 dark:text-orange-400" />;
    default: return <ClipboardList className="h-5 w-5 text-primary" />;
  }
}

function getCategoryLabel(category: string) {
  switch (category) {
    case "diet": return "Dieta";
    case "exercise": return "Ejercicio";
    case "lifestyle": return "Estilo de vida";
    case "follow-up": return "Seguimiento";
    case "tests": return "Exámenes";
    default: return category;
  }
}

type GroupedInstructions = {
  appointmentId: number | null;
  doctorName: string;
  doctorSpecialty: string;
  createdAt: string;
  items: InstructionWithDetails[];
};

function groupByConsultation(instructions: InstructionWithDetails[]): GroupedInstructions[] {
  const groups = new Map<string, GroupedInstructions>();
  for (const instr of instructions) {
    const key = `${instr.appointmentId}-${instr.createdAt.split('T')[0]}`;
    if (!groups.has(key)) {
      groups.set(key, {
        appointmentId: instr.appointmentId,
        doctorName: instr.doctorName,
        doctorSpecialty: instr.doctorSpecialty,
        createdAt: instr.createdAt,
        items: [],
      });
    }
    groups.get(key)!.items.push(instr);
  }
  return Array.from(groups.values());
}

export default function MedicalInstructionsPage() {
  const { toast } = useToast();
  const [previewGroup, setPreviewGroup] = useState<GroupedInstructions | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const { data: instructions, isLoading } = useQuery<InstructionWithDetails[]>({
    queryKey: ["/api/medical-instructions"],
  });

  const grouped = instructions ? groupByConsultation(instructions) : [];

  const handleDownload = async (appointmentId: number | null) => {
    if (!appointmentId) {
      toast({ title: "Error", description: "No se puede descargar este documento", variant: "destructive" });
      return;
    }
    setDownloadingId(appointmentId);
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`/api/consultations/${appointmentId}/documents/pdf?types=instructions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Error al descargar");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `indicaciones_${appointmentId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Error", description: "No se pudo descargar las indicaciones", variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-instructions-title">Mis Indicaciones</h1>
        <p className="text-muted-foreground mt-1">
          Indicaciones médicas de tus consultas
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
                    <Skeleton className="h-32 w-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        ) : grouped.length > 0 ? (
          grouped.map((group, gi) => (
            <Card key={gi} data-testid={`instruction-group-${gi}`}>
              <CardContent className="p-4 sm:p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <ClipboardList className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Indicaciones Médicas</h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <Stethoscope className="h-3.5 w-3.5" />
                        {group.doctorName} - {group.doctorSpecialty}
                      </p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {format(parseISO(group.createdAt), "d MMM yyyy", { locale: es })}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPreviewGroup(group)}
                      data-testid={`preview-instructions-${gi}`}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Ver
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(group.appointmentId)}
                      disabled={downloadingId === group.appointmentId || !group.appointmentId}
                      data-testid={`download-instructions-${gi}`}
                    >
                      {downloadingId === group.appointmentId ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <FileDown className="h-4 w-4 mr-2" />
                      )}
                      Descargar
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  {group.items.slice(0, 3).map((instr) => (
                    <div key={instr.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                      <div className="mt-0.5 flex-shrink-0">{getCategoryIcon(instr.category)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{instr.title}</p>
                          {getPriorityBadge(instr.priority)}
                          <Badge variant="outline" className="text-xs">{getCategoryLabel(instr.category)}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{instr.description}</p>
                      </div>
                    </div>
                  ))}
                  {group.items.length > 3 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-muted-foreground"
                      onClick={() => setPreviewGroup(group)}
                    >
                      Ver {group.items.length - 3} indicaciones más
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card data-testid="instructions-empty-state">
            <CardContent className="py-12 text-center">
              <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium text-lg mb-2">No tienes indicaciones</h3>
              <p className="text-muted-foreground mb-4">
                Las indicaciones de tus consultas aparecerán aquí
              </p>
              <Button asChild data-testid="button-schedule-from-instructions">
                <Link href="/appointments/new">Agendar Consulta</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!previewGroup} onOpenChange={() => setPreviewGroup(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Indicaciones Médicas
            </DialogTitle>
          </DialogHeader>
          {previewGroup && (
            <div className="space-y-4">
              <div className="text-sm">
                <p className="font-medium">{previewGroup.doctorName}</p>
                <p className="text-muted-foreground">{previewGroup.doctorSpecialty}</p>
                <p className="text-muted-foreground">
                  {format(parseISO(previewGroup.createdAt), "d 'de' MMMM, yyyy", { locale: es })}
                </p>
              </div>

              <div className="space-y-3">
                {previewGroup.items.map((instr) => (
                  <div key={instr.id} className="p-3 rounded-lg border space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex-shrink-0">{getCategoryIcon(instr.category)}</div>
                      <p className="font-medium text-sm flex-1">{instr.title}</p>
                      {getPriorityBadge(instr.priority)}
                    </div>
                    <p className="text-sm text-muted-foreground">{instr.description}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs">{getCategoryLabel(instr.category)}</Badge>
                      {instr.dueDate && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Hasta: {format(parseISO(instr.dueDate), "d MMM yyyy", { locale: es })}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <Button
                className="w-full"
                onClick={() => handleDownload(previewGroup.appointmentId)}
                disabled={downloadingId === previewGroup.appointmentId || !previewGroup.appointmentId}
                data-testid="btn-download-instructions-preview"
              >
                {downloadingId === previewGroup.appointmentId ? (
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
