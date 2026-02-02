import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft,
  Calendar, 
  User,
  Stethoscope,
  Pill,
  FileText,
  Clock,
  AlertCircle
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface ClinicalRecordDetail {
  id: number;
  appointmentId: number;
  recordDate: string;
  chiefComplaint?: string;
  symptoms?: string[];
  diagnosis?: string;
  treatment?: string;
  notes?: string;
  followUpDate?: string;
  vitalSigns?: {
    bloodPressure?: string;
    heartRate?: number;
    temperature?: number;
    weight?: number;
    height?: number;
  };
  doctorName: string;
  doctorSpecialty: string;
  prescription?: {
    id: number;
    medications: Array<{
      name: string;
      dosage: string;
      frequency: string;
      duration: string;
      instructions?: string;
    }>;
    generalInstructions?: string;
  };
}

export default function RecordDetailPage() {
  const [match, params] = useRoute("/records/:id");
  const recordId = params?.id;

  const { data: record, isLoading, error } = useQuery<ClinicalRecordDetail>({
    queryKey: ["/api/clinical-records", recordId],
    enabled: !!recordId,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link href="/records">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a registros
          </Link>
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="font-medium text-lg mb-2">Registro no encontrado</h3>
            <p className="text-muted-foreground">
              No se pudo cargar el registro clínico solicitado.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild data-testid="button-back-records">
          <Link href="/records">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Registro Clínico</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {format(parseISO(record.recordDate), "d 'de' MMMM, yyyy", { locale: es })}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card data-testid="card-record-main">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Información de la Consulta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {record.chiefComplaint && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">
                    Motivo de Consulta
                  </h4>
                  <p>{record.chiefComplaint}</p>
                </div>
              )}

              {record.symptoms && record.symptoms.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">
                    Síntomas
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {record.symptoms.map((symptom, i) => (
                      <Badge key={i} variant="secondary" data-testid={`badge-symptom-${i}`}>
                        {symptom}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {record.diagnosis && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">
                    Diagnóstico
                  </h4>
                  <p className="font-medium">{record.diagnosis}</p>
                </div>
              )}

              {record.treatment && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">
                    Tratamiento
                  </h4>
                  <p>{record.treatment}</p>
                </div>
              )}

              {record.notes && (
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">
                    Notas Adicionales
                  </h4>
                  <p className="text-muted-foreground">{record.notes}</p>
                </div>
              )}

              {record.followUpDate && (
                <div className="flex items-center gap-2 p-3 bg-secondary/20 rounded-lg">
                  <Clock className="h-5 w-5 text-secondary" />
                  <div>
                    <p className="text-sm font-medium">Próxima Cita de Seguimiento</p>
                    <p className="text-sm text-muted-foreground">
                      {format(parseISO(record.followUpDate), "d 'de' MMMM, yyyy", { locale: es })}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {record.prescription && (
            <Card data-testid="card-prescription">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Pill className="h-5 w-5 text-secondary" />
                  Receta Médica
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {record.prescription.medications.map((med, i) => (
                  <div 
                    key={i} 
                    className="p-4 border rounded-lg space-y-2"
                    data-testid={`medication-${i}`}
                  >
                    <h4 className="font-semibold">{med.name}</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Dosis:</span>{" "}
                        {med.dosage}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Frecuencia:</span>{" "}
                        {med.frequency}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Duración:</span>{" "}
                        {med.duration}
                      </div>
                    </div>
                    {med.instructions && (
                      <p className="text-sm text-muted-foreground">
                        {med.instructions}
                      </p>
                    )}
                  </div>
                ))}
                
                {record.prescription.generalInstructions && (
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-medium mb-1">Instrucciones Generales</h4>
                    <p className="text-sm text-muted-foreground">
                      {record.prescription.generalInstructions}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card data-testid="card-doctor-info">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Stethoscope className="h-4 w-4" />
                Médico Tratante
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{record.doctorName}</p>
                  <p className="text-sm text-muted-foreground">{record.doctorSpecialty}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {record.vitalSigns && (
            <Card data-testid="card-vital-signs">
              <CardHeader>
                <CardTitle className="text-base">Signos Vitales</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {record.vitalSigns.bloodPressure && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Presión Arterial</span>
                      <span className="font-medium">{record.vitalSigns.bloodPressure}</span>
                    </div>
                  )}
                  {record.vitalSigns.heartRate && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Frecuencia Cardíaca</span>
                      <span className="font-medium">{record.vitalSigns.heartRate} lpm</span>
                    </div>
                  )}
                  {record.vitalSigns.temperature && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Temperatura</span>
                      <span className="font-medium">{record.vitalSigns.temperature}°C</span>
                    </div>
                  )}
                  {record.vitalSigns.weight && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Peso</span>
                      <span className="font-medium">{record.vitalSigns.weight} kg</span>
                    </div>
                  )}
                  {record.vitalSigns.height && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Altura</span>
                      <span className="font-medium">{record.vitalSigns.height} cm</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Button 
            className="w-full" 
            variant="outline"
            asChild
            data-testid="button-view-consultation"
          >
            <Link href={`/consultation/${record.appointmentId}`}>
              Ver Consulta Original
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
