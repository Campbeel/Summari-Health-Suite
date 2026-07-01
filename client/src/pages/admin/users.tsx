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

import { Loader2, Trash2, Pencil, Shield, Users, UserPlus, UserMinus } from "lucide-react";



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

  bio?: string | null;

  isActive?: boolean;

}



interface EditForm {

  specialty: string;

  licenseNumber: string;

  bio: string;

  isActive: boolean;

}



export default function AdminUsersPage() {

  const { toast } = useToast();

  const { data: orgUsers, isLoading } = useQuery<OrgUser[]>({ queryKey: ["/api/admin/users"] });

  const [addOpen, setAddOpen] = useState(false);

  const [newStaff, setNewStaff] = useState({

    rut: "",

    firstName: "",

    lastName: "",

    email: "",

    password: "",

    specialty: "Cuidado de residentes",

    licenseNumber: "",

  });

  const [detachUser, setDetachUser] = useState<OrgUser | null>(null);

  const [deleteAdmin, setDeleteAdmin] = useState<OrgUser | null>(null);

  const [editingUser, setEditingUser] = useState<OrgUser | null>(null);

  const [editForm, setEditForm] = useState<EditForm>({

    specialty: "", licenseNumber: "", bio: "", isActive: true,

  });



  const createStaff = useMutation({

    mutationFn: async () => {

      const res = await apiRequest("POST", "/api/admin/staff", newStaff);

      return res.json();

    },

    onSuccess: () => {

      toast({ title: "Personal creado" });

      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });

      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });

      setAddOpen(false);

      setNewStaff({

        rut: "",

        firstName: "",

        lastName: "",

        email: "",

        password: "",

        specialty: "Cuidado de residentes",

        licenseNumber: "",

      });

    },

    onError: (e: any) => toast({ title: "Error", description: e?.message || "No se pudo crear", variant: "destructive" }),

  });



  const detachStaff = useMutation({

    mutationFn: async (doctorId: number) => apiRequest("DELETE", `/api/admin/doctors/${doctorId}/attach`),

    onSuccess: () => {

      toast({ title: "Personal desvinculado del hogar" });

      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });

      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });

      setDetachUser(null);

    },

    onError: (e: any) => toast({ title: "Error", description: e?.message || "No se pudo desvincular", variant: "destructive" }),

  });



  const updateStaff = useMutation({

    mutationFn: async ({ doctorId, data }: { doctorId: number; data: Partial<EditForm> }) =>

      apiRequest("PUT", `/api/admin/doctors/${doctorId}`, data),

    onSuccess: () => {

      toast({ title: "Personal actualizado" });

      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });

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

      bio: u.bio || "",

      isActive: u.isActive ?? true,

    });

  };



  const staffUsers = orgUsers?.filter((u) => u.role === "staff" || u.role === "doctor") ?? [];



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

            <Users className="h-7 w-7" /> Personal del hogar

          </h1>

          <p className="text-muted-foreground">

            Crea y administra las cuentas del equipo de cuidado

          </p>

        </div>

        <Dialog open={addOpen} onOpenChange={setAddOpen}>

          <DialogTrigger asChild>

            <Button data-testid="button-add-staff">

              <UserPlus className="h-4 w-4 mr-2" /> Nuevo personal

            </Button>

          </DialogTrigger>

          <DialogContent className="max-w-lg">

            <DialogHeader>

              <DialogTitle>Crear personal de cuidado</DialogTitle>

              <DialogDescription>

                Podrá acceder al panel de tareas y residentes con estas credenciales.

              </DialogDescription>

            </DialogHeader>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">

              <div className="grid grid-cols-2 gap-3">

                <div>

                  <Label>RUT</Label>

                  <Input value={newStaff.rut} onChange={(e) => setNewStaff({ ...newStaff, rut: e.target.value })} placeholder="12.345.678-9" />

                </div>

                <div>

                  <Label>Contraseña inicial</Label>

                  <Input type="password" value={newStaff.password} onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })} />

                </div>

              </div>

              <div className="grid grid-cols-2 gap-3">

                <div>

                  <Label>Nombre</Label>

                  <Input value={newStaff.firstName} onChange={(e) => setNewStaff({ ...newStaff, firstName: e.target.value })} />

                </div>

                <div>

                  <Label>Apellido</Label>

                  <Input value={newStaff.lastName} onChange={(e) => setNewStaff({ ...newStaff, lastName: e.target.value })} />

                </div>

              </div>

              <div>

                <Label>Correo</Label>

                <Input type="email" value={newStaff.email} onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })} />

              </div>

              <div className="grid grid-cols-2 gap-3">

                <div>

                  <Label>Área de trabajo</Label>

                  <Input value={newStaff.specialty} onChange={(e) => setNewStaff({ ...newStaff, specialty: e.target.value })} placeholder="Ej: Turno día, Enfermería" />

                </div>

                <div>

                  <Label>ID interno (opcional)</Label>

                  <Input value={newStaff.licenseNumber} onChange={(e) => setNewStaff({ ...newStaff, licenseNumber: e.target.value })} />

                </div>

              </div>

            </div>

            <DialogFooter>

              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>

              <Button

                onClick={() => createStaff.mutate()}

                disabled={createStaff.isPending || !newStaff.rut || !newStaff.password || !newStaff.firstName || !newStaff.email}

              >

                {createStaff.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}

                Crear

              </Button>

            </DialogFooter>

          </DialogContent>

        </Dialog>

      </div>



      <Card>

        <CardHeader>

          <CardTitle>Equipo del hogar</CardTitle>

          <CardDescription>{staffUsers.length} personal de cuidado · {orgUsers?.length ?? 0} usuarios en total</CardDescription>

        </CardHeader>

        <CardContent>

          <Table>

            <TableHeader>

              <TableRow>

                <TableHead>Nombre</TableHead>

                <TableHead>RUT / Email</TableHead>

                <TableHead>Rol</TableHead>

                <TableHead>Área</TableHead>

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

                    ) : u.role === "staff" || u.role === "doctor" ? (

                      <Badge variant="secondary" className="gap-1"><Users className="h-3 w-3" /> Staff</Badge>

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

                            title="Quitar del hogar"

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

                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No hay usuarios en el hogar</TableCell>

                </TableRow>

              )}

            </TableBody>

          </Table>

        </CardContent>

      </Card>



      <Dialog open={!!editingUser} onOpenChange={(o) => !o && setEditingUser(null)}>

        <DialogContent>

          <DialogHeader>

            <DialogTitle>Editar personal</DialogTitle>

            <DialogDescription>

              {editingUser?.firstName} {editingUser?.lastName} — {editingUser?.email}

            </DialogDescription>

          </DialogHeader>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">

            <div>

              <Label>Área de trabajo</Label>

              <Input

                value={editForm.specialty}

                onChange={e => setEditForm({ ...editForm, specialty: e.target.value })}

                data-testid="input-edit-staff-area"

              />

            </div>

            <div>

              <Label>ID interno (opcional)</Label>

              <Input

                value={editForm.licenseNumber}

                onChange={e => setEditForm({ ...editForm, licenseNumber: e.target.value })}

                data-testid="input-edit-staff-id"

              />

            </div>

            <div>

              <Label>Notas</Label>

              <Textarea

                value={editForm.bio}

                onChange={e => setEditForm({ ...editForm, bio: e.target.value })}

                rows={3}

                data-testid="input-edit-staff-bio"

              />

            </div>

            <div className="flex items-center justify-between rounded-md border p-3">

              <div>

                <Label className="text-base">Cuenta activa</Label>

                <p className="text-sm text-muted-foreground">

                  Si está inactivo, no podrá ingresar al sistema.

                </p>

              </div>

              <Switch

                checked={editForm.isActive}

                onCheckedChange={(v) => setEditForm({ ...editForm, isActive: v })}

                data-testid="switch-edit-staff-active"

              />

            </div>

          </div>

          <DialogFooter>

            <Button variant="outline" onClick={() => setEditingUser(null)}>Cancelar</Button>

            <Button

              onClick={() => editingUser?.doctorId && updateStaff.mutate({

                doctorId: editingUser.doctorId,

                data: editForm,

              })}

              disabled={updateStaff.isPending}

              data-testid="button-save-staff"

            >

              {updateStaff.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Guardar cambios

            </Button>

          </DialogFooter>

        </DialogContent>

      </Dialog>



      <AlertDialog open={!!detachUser} onOpenChange={(o) => !o && setDetachUser(null)}>

        <AlertDialogContent>

          <AlertDialogHeader>

            <AlertDialogTitle>¿Quitar del hogar?</AlertDialogTitle>

            <AlertDialogDescription>

              Esta persona dejará de pertenecer al equipo del hogar y no podrá acceder con su cuenta actual.

            </AlertDialogDescription>

          </AlertDialogHeader>

          <AlertDialogFooter>

            <AlertDialogCancel>Cancelar</AlertDialogCancel>

            <AlertDialogAction

              onClick={() => detachUser?.doctorId && detachStaff.mutate(detachUser.doctorId)}

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


