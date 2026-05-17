import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Stethoscope, UserMinus, Search } from "lucide-react";

interface UserRow {
  id: string;
  rut: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: "patient" | "doctor" | "admin" | "superAdmin";
  organizationId: string | null;
  doctor: {
    id: number;
    specialty: string;
    licenseNumber: string;
    consultationFee: number;
    organizationId: string | null;
    isActive: boolean;
  } | null;
}

function roleBadge(role: UserRow["role"]) {
  switch (role) {
    case "doctor":
      return <Badge variant="default">Médico</Badge>;
    case "admin":
      return <Badge variant="secondary">Admin org</Badge>;
    case "superAdmin":
      return <Badge variant="destructive">Super Admin</Badge>;
    default:
      return <Badge variant="outline">Paciente</Badge>;
  }
}

export default function SuperAdminUsersPage() {
  const { toast } = useToast();
  const { data: users, isLoading } = useQuery<UserRow[]>({ queryKey: ["/api/super-admin/users"] });

  const [search, setSearch] = useState("");
  const [promoteTarget, setPromoteTarget] = useState<UserRow | null>(null);
  const [demoteTarget, setDemoteTarget] = useState<UserRow | null>(null);
  const [promoteForm, setPromoteForm] = useState({
    specialty: "",
    licenseNumber: "",
    consultationFee: "25000",
    bio: "",
  });

  const filtered = useMemo(() => {
    if (!users) return [];
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const name = `${u.firstName || ""} ${u.lastName || ""}`.toLowerCase();
      return (
        name.includes(q) ||
        (u.rut || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q)
      );
    });
  }, [users, search]);

  const promote = useMutation({
    mutationFn: async () => {
      if (!promoteTarget) throw new Error("No target");
      return apiRequest("POST", `/api/super-admin/users/${promoteTarget.id}/promote-doctor`, {
        specialty: promoteForm.specialty,
        licenseNumber: promoteForm.licenseNumber,
        consultationFee: parseInt(promoteForm.consultationFee, 10) || 25000,
        bio: promoteForm.bio || null,
      });
    },
    onSuccess: () => {
      toast({ title: "Usuario promovido", description: "Ahora tiene rol de médico." });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/stats"] });
      setPromoteTarget(null);
      setPromoteForm({ specialty: "", licenseNumber: "", consultationFee: "25000", bio: "" });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e?.message || "No se pudo promover", variant: "destructive" }),
  });

  const demote = useMutation({
    mutationFn: async (userId: string) => apiRequest("DELETE", `/api/super-admin/users/${userId}/promote-doctor`),
    onSuccess: () => {
      toast({ title: "Rol médico revocado" });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/stats"] });
      setDemoteTarget(null);
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e?.message || "No se pudo revocar", variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Usuarios de la plataforma</CardTitle>
          <CardDescription>
            Promueve a un paciente a médico para que pueda atender consultas. El administrador de cada
            organización podrá luego agregarlo a su equipo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por nombre, RUT o email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-users"
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>RUT</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Organización</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Sin resultados
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((u) => {
                  const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || "Sin nombre";
                  const inOrg = !!u.doctor?.organizationId || !!u.organizationId;
                  return (
                    <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                      <TableCell className="font-medium">{name}</TableCell>
                      <TableCell>{u.rut || "—"}</TableCell>
                      <TableCell>{u.email || "—"}</TableCell>
                      <TableCell>{roleBadge(u.role)}</TableCell>
                      <TableCell>
                        {u.doctor?.organizationId
                          ? <Badge variant="secondary">Asignado</Badge>
                          : u.role === "doctor"
                            ? <Badge variant="outline">Sin asignar</Badge>
                            : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {u.role === "patient" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPromoteTarget(u)}
                            data-testid={`button-promote-${u.id}`}
                          >
                            <Stethoscope className="h-4 w-4 mr-2" />
                            Promover a médico
                          </Button>
                        ) : u.role === "doctor" ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDemoteTarget(u)}
                            disabled={inOrg}
                            title={inOrg ? "Primero el admin debe desvincularlo de la organización" : undefined}
                            data-testid={`button-demote-${u.id}`}
                          >
                            <UserMinus className="h-4 w-4 mr-2" />
                            Quitar rol médico
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Promote dialog */}
      <Dialog open={!!promoteTarget} onOpenChange={(open) => !open && setPromoteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Promover a médico</DialogTitle>
            <DialogDescription>
              {promoteTarget &&
                `Configura los datos profesionales de ${[promoteTarget.firstName, promoteTarget.lastName].filter(Boolean).join(" ") || promoteTarget.email}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="specialty">Especialidad</Label>
              <Input
                id="specialty"
                value={promoteForm.specialty}
                onChange={(e) => setPromoteForm((f) => ({ ...f, specialty: e.target.value }))}
                placeholder="Medicina general"
                data-testid="input-promote-specialty"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="license">Nº de registro / licencia</Label>
              <Input
                id="license"
                value={promoteForm.licenseNumber}
                onChange={(e) => setPromoteForm((f) => ({ ...f, licenseNumber: e.target.value }))}
                placeholder="123456"
                data-testid="input-promote-license"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fee">Tarifa por consulta (CLP)</Label>
              <Input
                id="fee"
                type="number"
                value={promoteForm.consultationFee}
                onChange={(e) => setPromoteForm((f) => ({ ...f, consultationFee: e.target.value }))}
                data-testid="input-promote-fee"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio (opcional)</Label>
              <Textarea
                id="bio"
                value={promoteForm.bio}
                onChange={(e) => setPromoteForm((f) => ({ ...f, bio: e.target.value }))}
                rows={3}
                data-testid="input-promote-bio"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPromoteTarget(null)}>Cancelar</Button>
            <Button
              onClick={() => promote.mutate()}
              disabled={promote.isPending || !promoteForm.specialty || !promoteForm.licenseNumber}
              data-testid="button-confirm-promote"
            >
              {promote.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Promover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Demote confirmation */}
      <AlertDialog open={!!demoteTarget} onOpenChange={(open) => !open && setDemoteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar rol médico?</AlertDialogTitle>
            <AlertDialogDescription>
              {demoteTarget &&
                `Este usuario volverá a ser sólo paciente. Las consultas históricas se mantienen, pero no podrá atender nuevas citas.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => demoteTarget && demote.mutate(demoteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-demote"
            >
              Quitar rol médico
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
