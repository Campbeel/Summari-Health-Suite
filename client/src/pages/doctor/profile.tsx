import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Save, DollarSign, Clock, Camera, FileText, Plus, Pencil, Trash2, Star, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReportTemplate } from "@shared/schema";

const DAYS_OF_WEEK = [
  { key: "monday", label: "Lunes" },
  { key: "tuesday", label: "Martes" },
  { key: "wednesday", label: "Miércoles" },
  { key: "thursday", label: "Jueves" },
  { key: "friday", label: "Viernes" },
  { key: "saturday", label: "Sábado" },
  { key: "sunday", label: "Domingo" },
];

interface DayAvailability {
  enabled: boolean;
  startTime: string;
  endTime: string;
}

interface WeeklyAvailability {
  monday: DayAvailability;
  tuesday: DayAvailability;
  wednesday: DayAvailability;
  thursday: DayAvailability;
  friday: DayAvailability;
  saturday: DayAvailability;
  sunday: DayAvailability;
}

// API returns availability in a different format
interface ApiAvailability {
  [day: string]: { start: string; end: string }[] | undefined;
}

interface DoctorProfile {
  id: number;
  specialty: string;
  bio?: string;
  consultationFee: number; // in cents from API
  consultationDuration: number;
  availability?: ApiAvailability;
}

// Transform API availability format to UI format
function transformAvailability(apiAvailability?: ApiAvailability): WeeklyAvailability {
  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
  const result = { ...defaultAvailability };
  
  if (!apiAvailability) return result;
  
  days.forEach((day) => {
    const slots = apiAvailability[day];
    if (slots && slots.length > 0) {
      result[day] = {
        enabled: true,
        startTime: slots[0].start || "09:00",
        endTime: slots[0].end || "17:00",
      };
    } else {
      result[day] = {
        enabled: false,
        startTime: "09:00",
        endTime: "17:00",
      };
    }
  });
  
  return result;
}

// Transform UI availability format back to API format
function transformToApiFormat(uiAvailability: WeeklyAvailability): ApiAvailability {
  const result: ApiAvailability = {};
  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
  
  days.forEach((day) => {
    const dayData = uiAvailability[day];
    if (dayData.enabled) {
      result[day] = [{ start: dayData.startTime, end: dayData.endTime }];
    }
  });
  
  return result;
}

const profileSchema = z.object({
  bio: z.string().optional(),
  consultationFee: z.number().min(0, "La tarifa no puede ser negativa"),
  consultationDuration: z.number().min(5, "La duración mínima es de 5 minutos").max(120, "La duración máxima es de 120 minutos"),
  profileImageUrl: z.string().url("URL de imagen inválida").optional().or(z.literal("")),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface DoctorProfile {
  id: number;
  specialty: string;
  bio?: string;
  consultationFee: number; // in cents from API
  consultationDuration: number;
  userImage?: string;
  availability?: ApiAvailability;
}

const defaultAvailability: WeeklyAvailability = {
  monday: { enabled: true, startTime: "09:00", endTime: "17:00" },
  tuesday: { enabled: true, startTime: "09:00", endTime: "17:00" },
  wednesday: { enabled: true, startTime: "09:00", endTime: "17:00" },
  thursday: { enabled: true, startTime: "09:00", endTime: "17:00" },
  friday: { enabled: true, startTime: "09:00", endTime: "17:00" },
  saturday: { enabled: false, startTime: "09:00", endTime: "13:00" },
  sunday: { enabled: false, startTime: "09:00", endTime: "13:00" },
};

function formatCurrency(amount: number): string {
  return amount.toString();
}

function parseCurrency(value: string): number {
  const parsed = parseInt(value);
  if (isNaN(parsed)) return 0;
  return parsed;
}

export default function DoctorProfilePage() {
  const { toast } = useToast();

  const { data: profile, isLoading } = useQuery<DoctorProfile>({
    queryKey: ["/api/doctors/me"],
  });

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      bio: "",
      consultationFee: 0,
    },
  });

  const availability = transformAvailability(profile?.availability);

  useEffect(() => {
    if (profile) {
      form.reset({
        bio: profile.bio || "",
        consultationFee: profile.consultationFee || 0,
        consultationDuration: profile.consultationDuration || 30,
        profileImageUrl: profile.userImage || "",
      });
    }
  }, [profile, form]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormValues) => {
      const response = await apiRequest("PATCH", "/api/doctors/me/profile", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctors/me"] });
      toast({
        title: "Perfil actualizado",
        description: "Tu información profesional ha sido guardada correctamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el perfil",
        variant: "destructive",
      });
    },
  });

  const updateAvailabilityMutation = useMutation({
    mutationFn: async (data: WeeklyAvailability) => {
      // Transform to API format before sending
      const apiAvailability = transformToApiFormat(data);
      const response = await apiRequest("PATCH", "/api/doctors/me/availability", { availability: apiAvailability });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctors/me"] });
      toast({
        title: "Horario actualizado",
        description: "Tu disponibilidad ha sido guardada correctamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar la disponibilidad",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ProfileFormValues) => {
    updateProfileMutation.mutate(data);
  };

  const handleAvailabilityChange = (
    day: keyof WeeklyAvailability,
    field: keyof DayAvailability,
    value: boolean | string
  ) => {
    const newAvailability = {
      ...availability,
      [day]: {
        ...availability[day],
        [field]: value,
      },
    };
    updateAvailabilityMutation.mutate(newAvailability);
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-8 w-64" />
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold" data-testid="text-page-title">
          Mi Perfil Profesional
        </h1>
        <p className="text-muted-foreground mt-1">
          Gestiona tu información profesional y horarios
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información Profesional</CardTitle>
          <CardDescription>
            Esta información será visible para tus pacientes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-6 items-start">
                <FormField
                  control={form.control}
                  name="profileImageUrl"
                  render={({ field }) => (
                    <FormItem className="flex-shrink-0">
                      <FormLabel>Foto de Perfil</FormLabel>
                      <div className="mt-2 flex flex-col items-center gap-4">
                        <Avatar className="h-24 w-24 border">
                          <AvatarImage src={field.value} />
                          <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                            {profile?.specialty?.[0] || "DR"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="w-full max-w-[200px]">
                          <FormControl>
                            <div className="relative">
                              <Camera className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                placeholder="URL de la imagen"
                                className="pl-9 text-xs"
                                data-testid="input-profile-image"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormDescription className="text-[10px] mt-1">
                            Pega la URL de tu foto
                          </FormDescription>
                          <FormMessage />
                        </div>
                      </div>
                    </FormItem>
                  )}
                />

                <div className="flex-1 space-y-6 w-full">
                  <div>
                    <FormLabel>Especialidad</FormLabel>
                    <div className="mt-2">
                      <Badge variant="secondary" className="text-base px-3 py-1" data-testid="text-specialty">
                        {profile?.specialty || "No especificada"}
                      </Badge>
                    </div>
                    <FormDescription className="mt-1">
                      Contacta al administrador para cambiar tu especialidad
                    </FormDescription>
                  </div>

                  <FormField
                    control={form.control}
                    name="bio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Biografía Profesional</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Escribe una breve descripción sobre tu experiencia y formación..."
                            className="min-h-[120px] resize-none"
                            data-testid="input-bio"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Máximo 500 caracteres
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <FormField
                control={form.control}
                name="consultationFee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tarifa de Consulta</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          placeholder="0"
                          className="pl-9"
                          data-testid="input-consultation-fee"
                          value={formatCurrency(field.value)}
                          onChange={(e) => field.onChange(parseCurrency(e.target.value))}
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      Tarifa en CLP para cada consulta
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="consultationDuration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duración de Consulta (minutos)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="number"
                          step="5"
                          min="5"
                          max="120"
                          className="pl-9"
                          data-testid="input-consultation-duration"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      Tiempo asignado para cada consulta (entre 5 y 120 minutos)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                disabled={updateProfileMutation.isPending}
                data-testid="button-save-profile"
              >
                <Save className="h-4 w-4 mr-2" />
                {updateProfileMutation.isPending ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Horario de Disponibilidad</CardTitle>
          <CardDescription>
            Configura los días y horas en los que estás disponible para consultas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {DAYS_OF_WEEK.map(({ key, label }) => {
              const dayKey = key as keyof WeeklyAvailability;
              const dayAvailability = availability[dayKey];
              
              return (
                <div 
                  key={key} 
                  className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-lg border"
                  data-testid={`availability-${key}`}
                >
                  <div className="flex items-center gap-3 min-w-[140px]">
                    <Switch
                      checked={dayAvailability.enabled}
                      onCheckedChange={(checked) => 
                        handleAvailabilityChange(dayKey, "enabled", checked)
                      }
                      data-testid={`switch-${key}`}
                    />
                    <span className={`font-medium ${!dayAvailability.enabled ? "text-muted-foreground" : ""}`}>
                      {label}
                    </span>
                  </div>
                  
                  {dayAvailability.enabled && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Input
                        type="time"
                        value={dayAvailability.startTime}
                        onChange={(e) => 
                          handleAvailabilityChange(dayKey, "startTime", e.target.value)
                        }
                        className="w-[130px]"
                        data-testid={`input-start-${key}`}
                      />
                      <span className="text-muted-foreground">a</span>
                      <Input
                        type="time"
                        value={dayAvailability.endTime}
                        onChange={(e) => 
                          handleAvailabilityChange(dayKey, "endTime", e.target.value)
                        }
                        className="w-[130px]"
                        data-testid={`input-end-${key}`}
                      />
                    </div>
                  )}
                  
                  {!dayAvailability.enabled && (
                    <span className="text-sm text-muted-foreground">No disponible</span>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <ReportTemplatesSection />
    </div>
  );
}

function ReportTemplatesSection() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ReportTemplate | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templatePrompt, setTemplatePrompt] = useState("");
  const [templateIsDefault, setTemplateIsDefault] = useState(false);
  const [loadingDefaultPrompt, setLoadingDefaultPrompt] = useState(false);

  const { data: templates, isLoading } = useQuery<ReportTemplate[]>({
    queryKey: ["/api/doctors/me/report-templates"],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/doctors/me/report-templates", {
        name: templateName,
        prompt: templatePrompt,
        isDefault: templateIsDefault,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctors/me/report-templates"] });
      setDialogOpen(false);
      resetForm();
      toast({ title: "Plantilla creada", description: "La plantilla se ha guardado exitosamente" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo crear la plantilla", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingTemplate) return;
      const res = await apiRequest("PUT", `/api/doctors/me/report-templates/${editingTemplate.id}`, {
        name: templateName,
        prompt: templatePrompt,
        isDefault: templateIsDefault,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctors/me/report-templates"] });
      setDialogOpen(false);
      resetForm();
      toast({ title: "Plantilla actualizada", description: "Los cambios se han guardado" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo actualizar la plantilla", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/doctors/me/report-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/doctors/me/report-templates"] });
      toast({ title: "Plantilla eliminada" });
    },
    onError: () => {
      toast({ title: "Error", description: "No se pudo eliminar la plantilla", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setTemplateName("");
    setTemplatePrompt("");
    setTemplateIsDefault(false);
    setEditingTemplate(null);
  };

  const handleNew = async () => {
    resetForm();
    setLoadingDefaultPrompt(true);
    try {
      const res = await apiRequest("GET", "/api/doctors/me/report-templates/default-prompt");
      const data = await res.json();
      setTemplatePrompt(data.prompt);
    } catch {
      setTemplatePrompt("");
    }
    setLoadingDefaultPrompt(false);
    setDialogOpen(true);
  };

  const handleEdit = (template: ReportTemplate) => {
    setEditingTemplate(template);
    setTemplateName(template.name);
    setTemplatePrompt(template.prompt);
    setTemplateIsDefault(template.isDefault);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (editingTemplate) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Plantillas de Informe Médico
              </CardTitle>
              <CardDescription className="mt-1">
                Personaliza cómo se genera el informe médico al final de cada consulta. La plantilla marcada como predeterminada se usará automáticamente.
              </CardDescription>
            </div>
            <Button onClick={handleNew} size="sm" data-testid="button-new-template">
              <Plus className="h-4 w-4 mr-1" />
              Nueva
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : !templates?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No tienes plantillas personalizadas.</p>
              <p className="text-xs mt-1">Se usará la plantilla predeterminada del sistema.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  data-testid={`template-row-${template.id}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{template.name}</p>
                        {template.isDefault && (
                          <Badge variant="secondary" className="text-[10px] shrink-0">
                            <Star className="h-3 w-3 mr-0.5 fill-current" />
                            Predeterminada
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {template.prompt.substring(0, 80)}...
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleEdit(template)}
                      data-testid={`button-edit-template-${template.id}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate(template.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-template-${template.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } else setDialogOpen(true); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Editar plantilla" : "Nueva plantilla de informe"}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? "Modifica el nombre o las instrucciones de la plantilla."
                : "Crea una plantilla personalizada para generar informes médicos."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">Nombre de la plantilla</label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Ej: Consulta general, Pediatría, Dermatología..."
                className="mt-1.5"
                data-testid="input-template-name"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={templateIsDefault}
                onCheckedChange={setTemplateIsDefault}
                data-testid="switch-template-default"
              />
              <label className="text-sm">Usar como plantilla predeterminada</label>
            </div>
            <div>
              <label className="text-sm font-medium">Instrucciones para la IA</label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-1.5">
                Describe las secciones, formato y estilo que deseas en el informe. La IA seguirá estas instrucciones al procesar la transcripción de la consulta.
              </p>
              {loadingDefaultPrompt ? (
                <div className="flex items-center justify-center h-[300px] border rounded-md">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Textarea
                  value={templatePrompt}
                  onChange={(e) => setTemplatePrompt(e.target.value)}
                  className="min-h-[300px] text-sm font-mono resize-y"
                  placeholder="Instrucciones para generar el informe médico..."
                  data-testid="input-template-prompt"
                />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={!templateName.trim() || !templatePrompt.trim() || isSaving}
              data-testid="button-save-template"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              {editingTemplate ? "Guardar cambios" : "Crear plantilla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
