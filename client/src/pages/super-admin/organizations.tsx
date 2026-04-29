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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2, Building2, Plus, UserPlus, Trash2 } from "lucide-react";

interface OrgRow {
  id: string;
  name: string;
  rut: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  isActive: boolean;
  doctorCount: number;
  adminCount: number;
}

export default function SuperAdminOrganizationsPage() {
  const { toast } = useToast();
  const { data: orgs, isLoading } = useQuery<OrgRow[]>({ queryKey: ["/api/super-admin/organizations"] });

  const [createOpen, setCreateOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState<OrgRow | null>(null);
  const [deleteOpen, setDeleteOpen] = useState<OrgRow | null>(null);
  const [orgForm, setOrgForm] = useState({ name: "", rut: "", contactEmail: "", contactPhone: "", address: "" });
  const [adminForm, setAdminForm] = useState({ rut: "", firstName: "", lastName: "", email: "", password: "" });

  const createOrg = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/super-admin/organizations", orgForm),
    onSuccess: () => {
      toast({ title: "Organización creada" });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/organizations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/stats"] });
      setCreateOpen(false);
      setOrgForm({ name: "", rut: "", contactEmail: "", contactPhone: "", address: "" });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "No se pudo crear", variant: "destructive" }),
  });

  const createAdmin = useMutation({
    mutationFn: async () => {
      if (!adminOpen) throw new Error("No org");
      return apiRequest("POST", `/api/super-admin/organizations/${adminOpen.id}/admins`, adminForm);
    },
    onSuccess: () => {
      toast({ title: "Administrador creado" });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/organizations"] });
      setAdminOpen(null);
      setAdminForm({ rut: "", firstName: "", lastName: "", email: "", password: "" });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "No se pudo crear", variant: "destructive" }),
  });

  const deactivate = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/super-admin/organizations/${id}`),
    onSuccess: () => {
      toast({ title: "Organización desactivada" });
      queryClient.invalidateQueries({ queryKey: ["/api/super-admin/organizations"] });
      setDeleteOpen(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "No se pudo desactivar", variant: "destructive" }),
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
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-orgs-title">
            <Building2 className="h-7 w-7" /> Organizaciones
          </h1>
          <p className="text-muted-foreground">Gestiona organizaciones y sus administradores</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-org"><Plus className="h-4 w-4 mr-2" /> Nueva organización</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear organización</DialogTitle>
              <DialogDescription>Registra una nueva clínica u organización médica</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nombre *</Label>
                <Input value={orgForm.name} onChange={e => setOrgForm({ ...orgForm, name: e.target.value })} data-testid="input-org-name" />
              </div>
              <div>
                <Label>RUT</Label>
                <Input value={orgForm.rut} onChange={e => setOrgForm({ ...orgForm, rut: e.target.value })} data-testid="input-org-rut" />
              </div>
              <div>
                <Label>Email de contacto</Label>
                <Input type="email" value={orgForm.contactEmail} onChange={e => setOrgForm({ ...orgForm, contactEmail: e.target.value })} data-testid="input-org-email" />
              </div>
              <div>
                <Label>Teléfono</Label>
                <Input value={orgForm.contactPhone} onChange={e => setOrgForm({ ...orgForm, contactPhone: e.target.value })} data-testid="input-org-phone" />
              </div>
              <div>
                <Label>Dirección</Label>
                <Input value={orgForm.address} onChange={e => setOrgForm({ ...orgForm, address: e.target.value })} data-testid="input-org-address" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button onClick={() => createOrg.mutate()} disabled={!orgForm.name || createOrg.isPending} data-testid="button-create-org">
                {createOrg.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Crear
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listado de organizaciones</CardTitle>
          <CardDescription>{orgs?.length ?? 0} organización(es) registradas</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead className="text-right">Médicos</TableHead>
                <TableHead className="text-right">Admins</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgs?.map(org => (
                <TableRow key={org.id} data-testid={`row-org-${org.id}`}>
                  <TableCell>
                    <div className="font-medium">{org.name}</div>
                    {org.rut && <div className="text-xs text-muted-foreground">{org.rut}</div>}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{org.contactEmail || "—"}</div>
                    <div className="text-xs text-muted-foreground">{org.contactPhone || ""}</div>
                  </TableCell>
                  <TableCell className="text-right">{org.doctorCount}</TableCell>
                  <TableCell className="text-right">{org.adminCount}</TableCell>
                  <TableCell>
                    <Badge variant={org.isActive ? "default" : "secondary"}>{org.isActive ? "Activa" : "Inactiva"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setAdminOpen(org)} data-testid={`button-add-admin-${org.id}`}>
                      <UserPlus className="h-3 w-3 mr-1" /> Admin
                    </Button>
                    {org.isActive && (
                      <Button variant="ghost" size="icon" onClick={() => setDeleteOpen(org)} data-testid={`button-delete-org-${org.id}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {orgs && orgs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No hay organizaciones</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add admin dialog */}
      <Dialog open={!!adminOpen} onOpenChange={(o) => !o && setAdminOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear administrador</DialogTitle>
            <DialogDescription>Para {adminOpen?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>RUT *</Label><Input value={adminForm.rut} onChange={e => setAdminForm({ ...adminForm, rut: e.target.value })} placeholder="12345678-9" data-testid="input-admin-rut" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Nombre *</Label><Input value={adminForm.firstName} onChange={e => setAdminForm({ ...adminForm, firstName: e.target.value })} data-testid="input-admin-firstname" /></div>
              <div><Label>Apellido *</Label><Input value={adminForm.lastName} onChange={e => setAdminForm({ ...adminForm, lastName: e.target.value })} data-testid="input-admin-lastname" /></div>
            </div>
            <div><Label>Email *</Label><Input type="email" value={adminForm.email} onChange={e => setAdminForm({ ...adminForm, email: e.target.value })} data-testid="input-admin-email" /></div>
            <div><Label>Contraseña *</Label><Input type="password" value={adminForm.password} onChange={e => setAdminForm({ ...adminForm, password: e.target.value })} data-testid="input-admin-password" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdminOpen(null)}>Cancelar</Button>
            <Button onClick={() => createAdmin.mutate()} disabled={createAdmin.isPending || !adminForm.rut || !adminForm.email} data-testid="button-create-admin">
              {createAdmin.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Crear administrador
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteOpen} onOpenChange={(o) => !o && setDeleteOpen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar organización?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteOpen?.name}" será marcada como inactiva. Sus médicos y admins seguirán existiendo pero no podrá recibir nuevas operaciones.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteOpen && deactivate.mutate(deleteOpen.id)} data-testid="button-confirm-delete-org">
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
