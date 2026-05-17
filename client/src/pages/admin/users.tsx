import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { Loader2, Plus, Trash2, Pencil, Stethoscope, Shield, Users, UserPlus, UserMinus } from "lucide-react";

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
  bio?: string | null;
  isActive?: boolean;
}

interface AvailableDoctor {
  id: number;
  userId: string;
  specialty: string;
  licenseNumber: string;
  consultationFee: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  rut: string | null;
}

interface EditForm {
  specialty: string;
  licenseNumber: string;
  consultationFee: number;
  bio: string;
  isActive: boolean;
}

export default function AdminUsersPage() {
  const { toast } = useToast();
  const { data: orgUsers, isLoading } = useQuery<OrgUser[]>({ queryKey: ["/api/admin/users"] });
  const [addOpen, setAddOpen] = useState(false);
  const [detachUser, setDetachUser] = useState<OrgUser | null>(null);
  const [deleteAdmin, setDeleteAdmin] = useState<OrgUser | null>(null);
  const [editingUser, setEditingUser] = useState<OrgUser | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    specialty: "", licenseNumber: "", consultationFee: 0, bio: "", isActive: true,
  });

  const { data: availableDoctors, isLoading: loadingAvailable } = useQuery<AvailableDoctor[]>({
    queryKey: ["/api/admin/doctors/available"],
    enabled: addOpen,
  });

  const attachDoctor = useMutation({
    mutationFn: async (doctorId: number) => apiRequest("POST", `/api/admin/doctors/${doctorId}/attach`),
    onSuccess: () => {
      toast({ title: "Médico agregado a tu organización" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/doctors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/doctors/available"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setAddOpen(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "No se pudo agregar", variant: "destructive" }),
  });

  const detachDoctor = useMutation({
    mutationFn: async (doctorId: number) => apiRequest("DELETE", `/api/admin/doctors/${doctorId}/attach`),
    onSuccess: () => {
      toast({ title: "Médico desvinculado", description: "Vuelve al pool de médicos disponibles." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/doctors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/doctors/available"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setDetachUser(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "No se pudo desvincular", variant: "destructive" }),
  });

  const updateDoctor = useMutation({
    mutationFn: async ({ doctorId, data }: { doctorId: number; data: Partial<EditForm> }) =>
      apiRequest("PUT", `/api/admin/doctors/${doctorId}`, data),
    onSuccess: () => {
      toast({ title: "Médico actualizado" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/doctors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setEditingUser(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "No se pudo actualizar", variant: "destructive" }),
  });

  const removeAdmin = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/users/${id}`),
    onSuccess: () => {
      toast({ title: "Administrador eliminado" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setDeleteAdmin(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "No se pudo eliminar", variant: "destructive" }),
  });

  const openEdit = (u: OrgUser) => {
    setEditingUser(u);
    setEditForm({
      specialty: u.specialty || "",
      licenseNumber: u.licenseNumber || "",
      consultationFee: u.consultationFee || 0,
      bio: u.bio || "",
      isActive: u.isActive ?? true,
    });
  };

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
            <Users className="h-7 w-7" /> Doctor@s
          </h1>
          <p className="text-muted-foreground">
            Agrega médicos previamente promovidos por el super administrador a tu organización
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-doctor">
              <UserPlus className="h-4 w-4 mr-2" /> Agregar médico
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Agregar médico a tu organización</DialogTitle>
              <DialogDescription>
                Estos son los médicos promovidos por el super administrador que aún no pertenecen a ninguna organización.
                Si no ves al médico que buscas, pídele al super administrador que lo promueva primero.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto">
              {loadingAvailable ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !availableDoctors || availableDoctors.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No hay médicos disponibles para agregar.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Especialidad</TableHead>
                      <TableHead>RUT</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {availableDoctors.map((d) => (
                      <TableRow key={d.id} data-testid={`row-available-doctor-${d.id}`}>
                        <TableCell>
                          <div className="font-medium">
                            {[d.firstName, d.lastName].filter(Boolean).join(" ") || "Sin nombre"}
                          </div>
                          <div className="text-xs text-muted-foreground">{d.email}</div>
                        </TableCell>
                        <TableCell>{d.specialty}</TableCell>
                        <TableCell>{d.rut || "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => attachDoctor.mutate(d.id)}
                            disabled={attachDoctor.isPending}
                            data-testid={`button-attach-doctor-${d.id}`}
                          >
                            {attachDoctor.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Agregar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Doctor@s de tu organización</CardTitle>
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
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgUsers?.map((u) => (
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
                  <TableCell>
                    {u.doctorId ? (
                      u.isActive === false ? (
                        <Badge variant="outline" className="text-muted-foreground">Inactivo</Badge>
                      ) : (
                        <Badge variant="secondary">Activo</Badge>
                      )
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {u.doctorId && (
                        <>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(u)} data-testid={`button-edit-user-${u.id}`} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDetachUser(u)}
                            data-testid={`button-detach-user-${u.id}`}
                            title="Quitar de la organización"
                          >
                            <UserMinus className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                      {u.role === "admin" && (
                        <Button variant="ghost" size="icon" onClick={() => setDeleteAdmin(u)} data-testid={`button-delete-user-${u.id}`} title="Eliminar admin">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {orgUsers && orgUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No hay usuarios en tu organización</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editingUser} onOpenChange={(o) => !o && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar médico</DialogTitle>
            <DialogDescription>
              {editingUser?.firstName} {editingUser?.lastName} — {editingUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <Label>Especialidad</Label>
              <Input
                value={editForm.specialty}
                onChange={e => setEditForm({ ...editForm, specialty: e.target.value })}
                data-testid="input-edit-doctor-specialty"
              />
            </div>
            <div>
              <Label>Nº de licencia</Label>
              <Input
                value={editForm.licenseNumber}
                onChange={e => setEditForm({ ...editForm, licenseNumber: e.target.value })}
                data-testid="input-edit-doctor-license"
              />
            </div>
            <div>
              <Label>Tarifa (CLP)</Label>
              <Input
                type="number"
                value={editForm.consultationFee}
                onChange={e => setEditForm({ ...editForm, consultationFee: parseInt(e.target.value) || 0 })}
                data-testid="input-edit-doctor-fee"
              />
            </div>
            <div>
              <Label>Biografía</Label>
              <Textarea
                value={editForm.bio}
                onChange={e => setEditForm({ ...editForm, bio: e.target.value })}
                rows={3}
                data-testid="input-edit-doctor-bio"
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label className="text-base">Médico activo</Label>
                <p className="text-sm text-muted-foreground">
                  Si está inactivo, no recibirá nuevas consultas.
                </p>
              </div>
              <Switch
                checked={editForm.isActive}
                onCheckedChange={(v) => setEditForm({ ...editForm, isActive: v })}
                data-testid="switch-edit-doctor-active"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>Cancelar</Button>
            <Button
              onClick={() => editingUser?.doctorId && updateDoctor.mutate({
                doctorId: editingUser.doctorId,
                data: editForm,
              })}
              disabled={updateDoctor.isPending}
              data-testid="button-save-doctor"
            >
              {updateDoctor.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!detachUser} onOpenChange={(o) => !o && setDetachUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar de la organización?</AlertDialogTitle>
            <AlertDialogDescription>
              El médico será desvinculado de tu organización y volverá al pool de médicos disponibles.
              Su perfil profesional y consultas históricas se mantienen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => detachUser?.doctorId && detachDoctor.mutate(detachUser.doctorId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-detach"
            >
              Quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteAdmin} onOpenChange={(o) => !o && setDeleteAdmin(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar administrador?</AlertDialogTitle>
            <AlertDialogDescription>
              Su cuenta de administrador será eliminada. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAdmin && removeAdmin.mutate(deleteAdmin.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-user"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
