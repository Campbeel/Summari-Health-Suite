import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, Trash2, Stethoscope, Shield, Users } from "lucide-react";

interface OrgUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  rut: string | null;
  role: string;
  doctorId: number | null;
  specialty: string | null;
  licenseNumber: string | null;
  consultationFee: number | null;
}

const empty = {
  rut: "", firstName: "", lastName: "", email: "", password: "",
  specialty: "", licenseNumber: "", consultationFee: 25000, bio: "",
};

export default function AdminUsersPage() {
  const { toast } = useToast();
  const { data: orgUsers, isLoading } = useQuery<OrgUser[]>({ queryKey: ["/api/admin/users"] });
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteUser, setDeleteUser] = useState<OrgUser | null>(null);
  const [form, setForm] = useState(empty);

  const createDoctor = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/admin/doctors", {
      ...form,
      consultationFee: Number(form.consultationFee),
    }),
    onSuccess: () => {
      toast({ title: "Médico creado" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/doctors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setCreateOpen(false);
      setForm(empty);
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "No se pudo crear", variant: "destructive" }),
  });

  const removeUser = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/users/${id}`),
    onSuccess: () => {
      toast({ title: "Usuario eliminado" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/doctors"] });
      setDeleteUser(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "No se pudo eliminar", variant: "destructive" }),
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-users-title">
            <Users className="h-7 w-7" /> Cuentas y permisos
          </h1>
          <p className="text-muted-foreground">Administra los usuarios de tu organización</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-doctor"><Plus className="h-4 w-4 mr-2" /> Nuevo médico</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear médico</DialogTitle>
              <DialogDescription>Se creará una cuenta y un perfil profesional asociados a tu organización</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              <div><Label>RUT *</Label><Input value={form.rut} onChange={e => setForm({ ...form, rut: e.target.value })} placeholder="12345678-9" data-testid="input-doctor-rut" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Nombre *</Label><Input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} data-testid="input-doctor-firstname" /></div>
                <div><Label>Apellido *</Label><Input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} data-testid="input-doctor-lastname" /></div>
              </div>
              <div><Label>Email *</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} data-testid="input-doctor-email" /></div>
              <div><Label>Contraseña *</Label><Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} data-testid="input-doctor-password" /></div>
              <div><Label>Especialidad *</Label><Input value={form.specialty} onChange={e => setForm({ ...form, specialty: e.target.value })} placeholder="Medicina General" data-testid="input-doctor-specialty" /></div>
              <div><Label>Nº de licencia *</Label><Input value={form.licenseNumber} onChange={e => setForm({ ...form, licenseNumber: e.target.value })} data-testid="input-doctor-license" /></div>
              <div><Label>Tarifa (CLP)</Label><Input type="number" value={form.consultationFee} onChange={e => setForm({ ...form, consultationFee: parseInt(e.target.value) || 0 })} data-testid="input-doctor-fee" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button onClick={() => createDoctor.mutate()} disabled={createDoctor.isPending || !form.rut || !form.specialty} data-testid="button-create-doctor">
                {createDoctor.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Crear médico
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usuarios de tu organización</CardTitle>
          <CardDescription>{orgUsers?.length ?? 0} usuario(s)</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>RUT / Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Especialidad</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgUsers?.map(u => (
                <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                  <TableCell>
                    <div className="font-medium">{u.firstName} {u.lastName}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{u.rut || "—"}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </TableCell>
                  <TableCell>
                    {u.role === "admin" ? (
                      <Badge variant="default" className="gap-1"><Shield className="h-3 w-3" /> Administrador</Badge>
                    ) : u.role === "doctor" ? (
                      <Badge variant="secondary" className="gap-1"><Stethoscope className="h-3 w-3" /> Médico</Badge>
                    ) : (
                      <Badge variant="outline">{u.role}</Badge>
                    )}
                  </TableCell>
                  <TableCell>{u.specialty || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setDeleteUser(u)} data-testid={`button-delete-user-${u.id}`}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {orgUsers && orgUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No hay usuarios en tu organización</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteUser} onOpenChange={(o) => !o && setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Si es un médico, será desactivado y no podrá recibir nuevas consultas. Si es admin, su cuenta será eliminada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteUser && removeUser.mutate(deleteUser.id)} data-testid="button-confirm-delete-user">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
