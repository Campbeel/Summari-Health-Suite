import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Building2, Stethoscope, Users, DollarSign, ShieldCheck, ArrowRight } from "lucide-react";

interface PlatformStats {
  organizations: number;
  doctors: number;
  patients: number;
  users: number;
  appointments: number;
  totalRevenue: number;
}

const fmtCLP = (n: number) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);

export default function SuperAdminDashboardPage() {
  const { data: stats, isLoading } = useQuery<PlatformStats>({ queryKey: ["/api/super-admin/stats"] });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-super-admin-title">
            <ShieldCheck className="h-7 w-7" /> Plataforma Summari
          </h1>
          <p className="text-muted-foreground">Estadísticas globales y gestión de organizaciones</p>
        </div>
        <Button asChild data-testid="button-go-organizations">
          <Link href="/super-admin/organizations">
            Gestionar organizaciones <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card data-testid="card-orgs">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Organizaciones</CardDescription>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold" data-testid="stat-orgs">{stats?.organizations ?? 0}</p></CardContent>
        </Card>
        <Card data-testid="card-doctors">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><Stethoscope className="h-4 w-4" /> Médicos</CardDescription>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold" data-testid="stat-doctors">{stats?.doctors ?? 0}</p></CardContent>
        </Card>
        <Card data-testid="card-patients">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><Users className="h-4 w-4" /> Pacientes</CardDescription>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold" data-testid="stat-patients">{stats?.patients ?? 0}</p></CardContent>
        </Card>
        <Card data-testid="card-users">
          <CardHeader className="pb-2">
            <CardDescription>Usuarios totales</CardDescription>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold" data-testid="stat-users">{stats?.users ?? 0}</p></CardContent>
        </Card>
        <Card data-testid="card-appts">
          <CardHeader className="pb-2">
            <CardDescription>Consultas totales</CardDescription>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold" data-testid="stat-appts">{stats?.appointments ?? 0}</p></CardContent>
        </Card>
        <Card data-testid="card-revenue">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2"><DollarSign className="h-4 w-4" /> Ingresos plataforma</CardDescription>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold" data-testid="stat-revenue">{fmtCLP(stats?.totalRevenue ?? 0)}</p></CardContent>
        </Card>
      </div>
    </div>
  );
}
