import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAdmin } from "@/hooks/use-admin";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Shield, UserPlus, Stethoscope, User, Loader2 } from "lucide-react";

interface UserWithDoctorStatus {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  isAdmin: boolean;
  isDoctor: boolean;
  doctorId: number | null;
  specialty: string | null;
  createdAt: string;
}

export default function AdminUsersPage() {
  const { isAdmin, isLoading: isAdminLoading } = useAdmin();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [selectedUser, setSelectedUser] = useState<UserWithDoctorStatus | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    specialty: "",
    licenseNumber: "",
    bio: "",
    consultationFee: 25000,
  });
  const [formErrors, setFormErrors] = useState<{ specialty?: string; licenseNumber?: string }>({});

  const { data: users, isLoading } = useQuery<UserWithDoctorStatus[]>({
    queryKey: ["/api/admin/users"],
    enabled: isAdmin,
  });

  const promoteMutation = useMutation({
    mutationFn: async (data: {
      userId: string;
      specialty: string;
      licenseNumber: string;
      bio?: string;
      consultationFee: number;
    }) => {
      return await apiRequest("POST", "/api/admin/promote-to-doctor", data);
    },
    onSuccess: () => {
      toast({
        title: "Usuario promovido",
        description: "El usuario ahora es médico y puede acceder al portal médico.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setIsDialogOpen(false);
      setSelectedUser(null);
      setFormData({
        specialty: "",
        licenseNumber: "",
        bio: "",
        consultationFee: 25000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo promover al usuario",
        variant: "destructive",
      });
    },
  });

  if (isAdminLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        <Shield className="h-16 w-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Acceso Restringido</h1>
        <p className="text-muted-foreground text-center">
          No tienes permisos de administrador para acceder a esta página.
        </p>
        <Button onClick={() => navigate("/")}>Volver al Inicio</Button>
      </div>
    );
  }

  const handlePromoteClick = (user: UserWithDoctorStatus) => {
    setSelectedUser(user);
    setFormErrors({});
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    const errors: { specialty?: string; licenseNumber?: string } = {};
    if (!formData.specialty.trim()) errors.specialty = "La especialidad es obligatoria";
    if (!formData.licenseNumber.trim()) errors.licenseNumber = "El número de licencia es obligatorio";
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});

    promoteMutation.mutate({
      userId: selectedUser.id,
      specialty: formData.specialty,
      licenseNumber: formData.licenseNumber,
      bio: formData.bio || undefined,
      consultationFee: formData.consultationFee,
    });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Panel de Administración</h1>
          <p className="text-muted-foreground">Gestiona usuarios y médicos</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usuarios Registrados</CardTitle>
          <CardDescription>
            Lista de todos los usuarios. Puedes promover pacientes a médicos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Especialidad</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((user) => (
                  <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {user.isDoctor ? (
                          <Stethoscope className="h-4 w-4 text-primary" />
                        ) : (
                          <User className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="font-medium">
                          {user.firstName && user.lastName
                            ? `${user.firstName} ${user.lastName}`
                            : user.email || "Usuario"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{user.email || "-"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {user.isAdmin && (
                          <Badge variant="default" data-testid={`badge-admin-${user.id}`}>
                            Admin
                          </Badge>
                        )}
                        {user.isDoctor && (
                          <Badge variant="secondary" data-testid={`badge-doctor-${user.id}`}>
                            Médico
                          </Badge>
                        )}
                        {!user.isDoctor && !user.isAdmin && (
                          <Badge variant="outline" data-testid={`badge-patient-${user.id}`}>
                            Paciente
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{user.specialty || "-"}</TableCell>
                    <TableCell>
                      {!user.isDoctor && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePromoteClick(user)}
                          data-testid={`button-promote-${user.id}`}
                        >
                          <UserPlus className="h-4 w-4 mr-1" />
                          Hacer Médico
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Promover a Médico</DialogTitle>
            <DialogDescription>
              Ingresa los datos profesionales para{" "}
              {selectedUser?.firstName && selectedUser?.lastName
                ? `${selectedUser.firstName} ${selectedUser.lastName}`
                : selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="specialty">Especialidad *</Label>
              <Input
                id="specialty"
                value={formData.specialty}
                onChange={(e) => { setFormData({ ...formData, specialty: e.target.value }); setFormErrors(prev => ({ ...prev, specialty: undefined })); }}
                placeholder="Ej: Medicina General, Cardiología"
                className={formErrors.specialty ? "border-destructive" : ""}
                data-testid="input-specialty"
              />
              {formErrors.specialty && (
                <p className="text-sm text-destructive" data-testid="error-specialty">{formErrors.specialty}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="licenseNumber">Número de Licencia *</Label>
              <Input
                id="licenseNumber"
                value={formData.licenseNumber}
                onChange={(e) => { setFormData({ ...formData, licenseNumber: e.target.value }); setFormErrors(prev => ({ ...prev, licenseNumber: undefined })); }}
                placeholder="Ej: MED-2024-001"
                className={formErrors.licenseNumber ? "border-destructive" : ""}
                data-testid="input-license"
              />
              {formErrors.licenseNumber && (
                <p className="text-sm text-destructive" data-testid="error-license">{formErrors.licenseNumber}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Biografía</Label>
              <Input
                id="bio"
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                placeholder="Breve descripción profesional"
                data-testid="input-bio"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="consultationFee">Tarifa por Consulta (centavos)</Label>
              <Input
                id="consultationFee"
                type="number"
                value={formData.consultationFee}
                onChange={(e) => setFormData({ ...formData, consultationFee: parseInt(e.target.value) || 0 })}
                placeholder="25000"
                data-testid="input-fee"
              />
              <p className="text-xs text-muted-foreground">
                ${(formData.consultationFee / 100).toFixed(2)} USD
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={promoteMutation.isPending} data-testid="button-confirm-promote">
                {promoteMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  "Confirmar"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
