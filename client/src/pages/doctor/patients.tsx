import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Users, Calendar, Phone, Mail, Droplets, AlertTriangle } from "lucide-react";

type PatientListItem = {
  id: number;
  userId: string;
  rut: string | null;
  email: string | null;
  whatsapp: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  bloodType: string | null;
  allergies: string[] | null;
  medicalHistory: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  lastAppointmentDate: string | null;
  totalAppointments: number;
};

function getAge(dateOfBirth: string | null): string {
  if (!dateOfBirth) return "";
  const today = new Date();
  const birth = new Date(dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return `${age} años`;
}

function getInitials(first: string | null, last: string | null): string {
  return `${(first || "")[0] || ""}${(last || "")[0] || ""}`.toUpperCase() || "P";
}

export default function DoctorPatientsPage() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");

  const { data: patients, isLoading } = useQuery<PatientListItem[]>({
    queryKey: ["/api/doctors/me/patients"],
  });

  const filtered = patients?.filter((p) => {
    if (!search.trim()) return true;
    const term = search.trim().toLowerCase();
    const name = `${p.firstName || ""} ${p.lastName || ""}`.toLowerCase();
    const rut = (p.rut || "").toLowerCase();
    const email = (p.email || "").toLowerCase();
    return name.includes(term) || rut.includes(term) || email.includes(term);
  });

  return (
    <div className="container mx-auto py-6 px-4 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <Users className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Residentes</h1>
        {patients && (
          <Badge variant="secondary" data-testid="badge-patient-count">
            {patients.length} {patients.length === 1 ? "residente" : "residentes"}
          </Badge>
        )}
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por RUT (ej: 12345678-9), nombre o email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
          data-testid="input-search-patients"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3" data-testid="loading-skeleton">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : !filtered || filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-muted-foreground" data-testid="text-no-patients">
              {search.trim() ? "No se encontraron residentes con ese criterio" : "No hay residentes registrados"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2" data-testid="patient-list">
          {filtered.map((patient) => (
            <Card
              key={patient.id}
              role="button"
              tabIndex={0}
              className="cursor-pointer hover:ring-2 hover:ring-primary/30 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none transition-all"
              onClick={() => navigate(`/staff/patients/${patient.id}`)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/staff/patients/${patient.id}`); }}}
              aria-label={`Ver ficha de ${patient.firstName} ${patient.lastName}`}
              data-testid={`patient-card-${patient.id}`}
            >
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12 flex-shrink-0">
                    <AvatarImage src={patient.profileImageUrl || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary font-medium">
                      {getInitials(patient.firstName, patient.lastName)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm" data-testid={`text-patient-name-${patient.id}`}>
                        {patient.firstName} {patient.lastName}
                      </span>
                      {patient.rut && (
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {patient.rut}
                        </Badge>
                      )}
                      {patient.bloodType && (
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          <Droplets className="h-3 w-3" />
                          {patient.bloodType}
                        </Badge>
                      )}
                      {patient.allergies && patient.allergies.length > 0 && (
                        <Badge variant="destructive" className="text-[10px] gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          {patient.allergies.length} alergia{patient.allergies.length > 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                      {patient.dateOfBirth && (
                        <span>{getAge(patient.dateOfBirth)} · {patient.gender || "—"}</span>
                      )}
                      {patient.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {patient.email}
                        </span>
                      )}
                      {patient.whatsapp && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {patient.whatsapp}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0 hidden sm:block">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{patient.totalAppointments} cita{patient.totalAppointments !== 1 ? "s" : ""}</span>
                    </div>
                    {patient.lastAppointmentDate && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Última: {new Date(patient.lastAppointmentDate).toLocaleDateString("es-CL")}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
