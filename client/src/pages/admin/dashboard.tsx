import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, DollarSign, CalendarCheck, CalendarX, CheckCircle2, Stethoscope, Users, Building2 } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface AdminStats {
  totalRevenue: number;
  scheduled: number;
  paid: number;
  lost: number;
  completed: number;
  totalAppointments: number;
  doctorCount: number;
  patientCount: number;
  revenueByDay: { date: string; amount: number }[];
  statusBreakdown: { status: string; count: number }[];
  byDoctor: {
    id: number;
    name: string;
    specialty: string;
    consultationFee: number;
    revenue: number;
    count: number;
    completed: number;
  }[];
}

interface OrgInfo {
  id: string;
  name: string;
  rut: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
}

const fmtCLP = (n: number) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);

export default function AdminDashboardPage() {
  const { data: stats, isLoading } = useQuery<AdminStats>({ queryKey: ["/api/admin/stats"] });
  const { data: org } = useQuery<OrgInfo>({ queryKey: ["/api/admin/me/organization"] });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!stats) {
    return <div className="p-6">No hay estadísticas disponibles</div>;
  }

  const maxRevenue = Math.max(1, ...stats.revenueByDay.map(d => d.amount));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-admin-title">Dashboard Administración</h1>
        {org && (
          <p className="text-muted-foreground flex items-center gap-2 mt-1" data-testid="text-org-name">
            <Building2 className="h-4 w-4" /> {org.name}
          </p>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-revenue">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><DollarSign className="h-4 w-4" /> Ingresos totales</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="stat-revenue">{fmtCLP(stats.totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card data-testid="card-scheduled">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><CalendarCheck className="h-4 w-4" /> Consultas agendadas</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="stat-scheduled">{stats.scheduled}</p>
          </CardContent>
        </Card>
        <Card data-testid="card-paid">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Consultas pagadas</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="stat-paid">{stats.paid}</p>
          </CardContent>
        </Card>
        <Card data-testid="card-lost">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><CalendarX className="h-4 w-4" /> Consultas perdidas</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="stat-lost">{stats.lost}</p>
          </CardContent>
        </Card>
        <Card data-testid="card-completed">
          <CardHeader className="pb-2">
            <CardDescription>Completadas</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="stat-completed">{stats.completed}</p>
          </CardContent>
        </Card>
        <Card data-testid="card-total-appts">
          <CardHeader className="pb-2">
            <CardDescription>Total de consultas</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="stat-total-appts">{stats.totalAppointments}</p>
          </CardContent>
        </Card>
        <Card data-testid="card-doctors">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><Stethoscope className="h-4 w-4" /> Médicos</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="stat-doctors">{stats.doctorCount}</p>
          </CardContent>
        </Card>
        <Card data-testid="card-patients">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><Users className="h-4 w-4" /> Pacientes únicos</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="stat-patients">{stats.patientCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue chart */}
      <Card>
        <CardHeader>
          <CardTitle>Ingresos por día</CardTitle>
          <CardDescription>Suma de tarifas pagadas por fecha de consulta</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.revenueByDay.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Sin datos suficientes</p>
          ) : (
            <div className="space-y-2">
              {stats.revenueByDay.map(d => (
                <div key={d.date} className="flex items-center gap-3" data-testid={`row-revenue-${d.date}`}>
                  <span className="text-xs w-24 text-muted-foreground">{d.date}</span>
                  <div className="flex-1 bg-muted rounded h-6 relative">
                    <div
                      className="absolute inset-y-0 left-0 bg-primary rounded"
                      style={{ width: `${(d.amount / maxRevenue) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-24 text-right">{fmtCLP(d.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-doctor breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Desempeño por médico</CardTitle>
          <CardDescription>Ingresos y consultas por profesional</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Médico</TableHead>
                <TableHead>Especialidad</TableHead>
                <TableHead className="text-right">Tarifa</TableHead>
                <TableHead className="text-right">Consultas</TableHead>
                <TableHead className="text-right">Completadas</TableHead>
                <TableHead className="text-right">Ingresos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.byDoctor.map(d => (
                <TableRow key={d.id} data-testid={`row-doctor-${d.id}`}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell><Badge variant="secondary">{d.specialty}</Badge></TableCell>
                  <TableCell className="text-right">{fmtCLP(d.consultationFee)}</TableCell>
                  <TableCell className="text-right">{d.count}</TableCell>
                  <TableCell className="text-right">{d.completed}</TableCell>
                  <TableCell className="text-right font-semibold">{fmtCLP(d.revenue)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
