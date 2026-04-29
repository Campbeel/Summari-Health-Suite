import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Trash2, Save, CalendarClock } from "lucide-react";

type Slot = { start: string; end: string };
type Availability = Record<string, Slot[]>;

interface AdminDoctor {
  id: number;
  userId: string;
  organizationId: string | null;
  specialty: string;
  licenseNumber: string;
  consultationFee: number;
  consultationDuration: number;
  availability: Availability | null;
  isActive: boolean;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}

const DAYS = [
  { key: "monday", label: "Lunes" },
  { key: "tuesday", label: "Martes" },
  { key: "wednesday", label: "Miércoles" },
  { key: "thursday", label: "Jueves" },
  { key: "friday", label: "Viernes" },
  { key: "saturday", label: "Sábado" },
  { key: "sunday", label: "Domingo" },
];

export default function AdminSchedulesPage() {
  const { toast } = useToast();
  const { data: doctors, isLoading } = useQuery<AdminDoctor[]>({ queryKey: ["/api/admin/doctors"] });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Availability>({});

  const selected = doctors?.find(d => d.id === selectedId) || null;

  useEffect(() => {
    if (doctors && doctors.length > 0 && selectedId === null) {
      setSelectedId(doctors[0].id);
    }
  }, [doctors, selectedId]);

  useEffect(() => {
    if (selected) {
      setDraft(selected.availability || {});
    }
  }, [selectedId, selected]);

  const saveMutation = useMutation({
    mutationFn: async (avail: Availability) => {
      if (!selected) throw new Error("No doctor selected");
      return apiRequest("PUT", `/api/admin/doctors/${selected.id}/availability`, { availability: avail });
    },
    onSuccess: () => {
      toast({ title: "Disponibilidad guardada" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/doctors"] });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e?.message || "No se pudo guardar", variant: "destructive" });
    },
  });

  const addSlot = (day: string) => {
    setDraft(prev => ({
      ...prev,
      [day]: [...(prev[day] || []), { start: "09:00", end: "13:00" }],
    }));
  };

  const removeSlot = (day: string, idx: number) => {
    setDraft(prev => {
      const next = { ...prev };
      next[day] = (next[day] || []).filter((_, i) => i !== idx);
      if (next[day].length === 0) delete next[day];
      return next;
    });
  };

  const updateSlot = (day: string, idx: number, field: "start" | "end", value: string) => {
    setDraft(prev => {
      const next = { ...prev };
      next[day] = (next[day] || []).map((s, i) => i === idx ? { ...s, [field]: value } : s);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!doctors || doctors.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Edición de agendas</CardTitle>
          <CardDescription>No hay médicos en su organización</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-schedules-title">
          <CalendarClock className="h-7 w-7" /> Edición de agendas
        </h1>
        <p className="text-muted-foreground mt-1">Configura las horas disponibles de cada médico de tu organización.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle>Selecciona un médico</CardTitle>
              <CardDescription>{selected ? `${selected.firstName || ""} ${selected.lastName || ""} — ${selected.specialty}` : ""}</CardDescription>
            </div>
            <Select value={String(selectedId ?? "")} onValueChange={(v) => setSelectedId(parseInt(v))}>
              <SelectTrigger className="w-72" data-testid="select-doctor">
                <SelectValue placeholder="Médico" />
              </SelectTrigger>
              <SelectContent>
                {doctors.map(d => (
                  <SelectItem key={d.id} value={String(d.id)} data-testid={`option-doctor-${d.id}`}>
                    {d.firstName} {d.lastName} — {d.specialty}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
      </Card>

      {selected && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Disponibilidad semanal</CardTitle>
                <CardDescription>Define los bloques de atención por día</CardDescription>
              </div>
              <Button onClick={() => saveMutation.mutate(draft)} disabled={saveMutation.isPending} data-testid="button-save-availability">
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Guardar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {DAYS.map(day => {
              const slots = draft[day.key] || [];
              return (
                <div key={day.key} className="border rounded-md p-4" data-testid={`section-day-${day.key}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{day.label}</span>
                      <Badge variant="secondary">{slots.length} bloques</Badge>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => addSlot(day.key)} data-testid={`button-add-slot-${day.key}`}>
                      <Plus className="h-3 w-3 mr-1" /> Añadir bloque
                    </Button>
                  </div>
                  {slots.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin disponibilidad</p>
                  ) : (
                    <div className="space-y-2">
                      {slots.map((slot, idx) => (
                        <div key={idx} className="flex items-center gap-2" data-testid={`slot-${day.key}-${idx}`}>
                          <Label className="text-xs w-12">Inicio</Label>
                          <Input
                            type="time"
                            value={slot.start}
                            onChange={(e) => updateSlot(day.key, idx, "start", e.target.value)}
                            className="w-32"
                            data-testid={`input-start-${day.key}-${idx}`}
                          />
                          <Label className="text-xs w-12">Fin</Label>
                          <Input
                            type="time"
                            value={slot.end}
                            onChange={(e) => updateSlot(day.key, idx, "end", e.target.value)}
                            className="w-32"
                            data-testid={`input-end-${day.key}-${idx}`}
                          />
                          <Button variant="ghost" size="icon" onClick={() => removeSlot(day.key, idx)} data-testid={`button-remove-slot-${day.key}-${idx}`}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
