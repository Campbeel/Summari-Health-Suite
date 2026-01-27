import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { 
  FileText, 
  Search, 
  Calendar, 
  User,
  ChevronRight,
  Stethoscope,
  Pill
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";

interface ClinicalRecordWithDetails {
  id: number;
  recordDate: string;
  chiefComplaint?: string;
  symptoms?: string[];
  diagnosis?: string;
  notes?: string;
  doctorName: string;
  doctorSpecialty: string;
  hasPrescription: boolean;
}

export default function RecordsPage() {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: records, isLoading } = useQuery<ClinicalRecordWithDetails[]>({
    queryKey: ["/api/clinical-records"],
  });

  const filteredRecords = records?.filter(record => 
    record.diagnosis?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.chiefComplaint?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.doctorName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Historial Clínico</h1>
          <p className="text-muted-foreground mt-1">
            Accede a todos tus registros médicos
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por diagnóstico o médico..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
          data-testid="input-search-records"
        />
      </div>

      {/* Records List */}
      <div className="space-y-4">
        {isLoading ? (
          <>
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-64" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        ) : filteredRecords && filteredRecords.length > 0 ? (
          filteredRecords.map((record) => (
            <Link key={record.id} href={`/records/${record.id}`}>
              <Card className="hover-elevate cursor-pointer" data-testid={`record-card-${record.id}`}>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold">
                            {record.diagnosis || record.chiefComplaint || "Consulta médica"}
                          </h3>
                          <p className="text-sm text-muted-foreground flex items-center gap-2">
                            <Stethoscope className="h-3.5 w-3.5" />
                            {record.doctorName} - {record.doctorSpecialty}
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(parseISO(record.recordDate), "d 'de' MMMM, yyyy", { locale: es })}
                        </span>
                        {record.hasPrescription && (
                          <Badge variant="outline" className="text-secondary border-secondary/30">
                            <Pill className="h-3 w-3 mr-1" />
                            Con receta
                          </Badge>
                        )}
                      </div>

                      {record.symptoms && record.symptoms.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1" data-testid={`symptoms-list-${record.id}`}>
                          {record.symptoms.slice(0, 3).map((symptom, i) => (
                            <Badge key={i} variant="secondary" className="text-xs" data-testid={`badge-symptom-${record.id}-${i}`}>
                              {symptom}
                            </Badge>
                          ))}
                          {record.symptoms.length > 3 && (
                            <Badge variant="secondary" className="text-xs" data-testid={`badge-symptoms-more-${record.id}`}>
                              +{record.symptoms.length - 3} más
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        ) : (
          <Card data-testid="records-empty-state">
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium text-lg mb-2">
                {searchTerm ? "No se encontraron registros" : "No tienes registros clínicos"}
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm 
                  ? "Intenta con otro término de búsqueda" 
                  : "Tus registros aparecerán aquí después de tus consultas"}
              </p>
              {!searchTerm && (
                <Button asChild data-testid="button-schedule-from-records">
                  <Link href="/appointments/new">Agendar Consulta</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
