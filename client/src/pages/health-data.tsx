import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef, useEffect } from "react";
import {
  Heart,
  Footprints,
  Moon,
  Droplets,
  Thermometer,
  Scale,
  Flame,
  Activity,
  Plus,
  Upload,
  TrendingUp,
  TrendingDown,
  Minus,
  Trash2,
  FileSpreadsheet,
  RefreshCw,
  Loader2,
  Check,
  Unplug,
  Watch,
  AlertTriangle,
} from "lucide-react";
import {
  ChartContainer,
  ChartConfig,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, AreaChart, Area } from "recharts";
import { format, subDays, parseISO } from "date-fns";
import { es } from "date-fns/locale";

const METRIC_TYPES = [
  { value: "heart_rate", label: "Frecuencia Cardíaca", unit: "bpm", icon: Heart, color: "hsl(0 70% 50%)" },
  { value: "steps", label: "Pasos", unit: "pasos", icon: Footprints, color: "hsl(210 70% 50%)" },
  { value: "sleep_duration", label: "Duración del Sueño", unit: "horas", icon: Moon, color: "hsl(260 70% 50%)" },
  { value: "spo2", label: "Saturación O₂", unit: "%", icon: Droplets, color: "hsl(180 70% 50%)" },
  { value: "bp_systolic", label: "Presión Sistólica", unit: "mmHg", icon: Activity, color: "hsl(340 70% 50%)" },
  { value: "bp_diastolic", label: "Presión Diastólica", unit: "mmHg", icon: Activity, color: "hsl(20 70% 50%)" },
  { value: "weight", label: "Peso", unit: "kg", icon: Scale, color: "hsl(140 70% 50%)" },
  { value: "temperature", label: "Temperatura", unit: "°C", icon: Thermometer, color: "hsl(30 70% 50%)" },
  { value: "calories", label: "Calorías", unit: "kcal", icon: Flame, color: "hsl(50 70% 50%)" },
];

function getMetricInfo(type: string) {
  return METRIC_TYPES.find(m => m.value === type) || { value: type, label: type, unit: "", icon: Activity, color: "hsl(0 0% 50%)" };
}

function getMetricIcon(type: string) {
  const info = getMetricInfo(type);
  const Icon = info.icon;
  return <Icon className="h-4 w-4" />;
}

function getNormalRange(type: string): { min: number; max: number } | null {
  switch (type) {
    case "heart_rate": return { min: 60, max: 100 };
    case "spo2": return { min: 95, max: 100 };
    case "bp_systolic": return { min: 90, max: 140 };
    case "bp_diastolic": return { min: 60, max: 90 };
    case "temperature": return { min: 36.0, max: 37.5 };
    default: return null;
  }
}

function isOutOfRange(type: string, value: number): boolean {
  const range = getNormalRange(type);
  if (!range) return false;
  return value < range.min || value > range.max;
}

interface WearableMetric {
  id: number;
  patientId: number;
  metricType: string;
  value: string;
  unit: string;
  source: string;
  deviceName: string | null;
  recordedAt: string;
  notes: string | null;
  createdAt: string;
}

interface MetricSummary {
  metricType: string;
  avg: number;
  min: number;
  max: number;
  count: number;
  latestValue: string;
  unit: string;
}

interface WearableConnectionInfo {
  id: number;
  provider: string;
  providerUserId: string | null;
  scopes: string | null;
  lastSyncAt: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function HealthData() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedMetricType, setSelectedMetricType] = useState<string>("heart_rate");
  const [chartMetric, setChartMetric] = useState<string>("heart_rate");
  const [newValue, setNewValue] = useState("");
  const [newDate, setNewDate] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fitbitStatus = params.get("fitbit");
    if (fitbitStatus === "connected") {
      toast({ title: "Fitbit conectado exitosamente", description: "Ahora puedes sincronizar tus datos." });
      window.history.replaceState({}, "", "/health-data");
      queryClient.invalidateQueries({ queryKey: ["/api/fitbit/connections"] });
    } else if (fitbitStatus === "error") {
      toast({ title: "Error al conectar Fitbit", description: "Intenta nuevamente.", variant: "destructive" });
      window.history.replaceState({}, "", "/health-data");
    }
  }, []);

  const { data: connections } = useQuery<WearableConnectionInfo[]>({
    queryKey: ["/api/fitbit/connections"],
  });

  const fitbitConnection = connections?.find(c => c.provider === "fitbit" && c.isActive);

  const connectFitbitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/fitbit/authorize");
      return res.json();
    },
    onSuccess: (data: { authUrl: string }) => {
      window.location.href = data.authUrl;
    },
    onError: (error: any) => {
      toast({ title: "Error al conectar Fitbit", description: error.message || "Verifica la configuración.", variant: "destructive" });
    },
  });

  const syncFitbitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/fitbit/sync");
      return res.json();
    },
    onSuccess: (data: { synced: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/wearable-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wearable-metrics/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wearable-metrics/latest"] });
      queryClient.invalidateQueries({ queryKey: ["/api/fitbit/connections"] });
      toast({ title: `${data.synced} métricas sincronizadas desde Fitbit` });
    },
    onError: () => {
      toast({ title: "Error al sincronizar Fitbit", variant: "destructive" });
    },
  });

  const disconnectFitbitMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/fitbit/disconnect");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fitbit/connections"] });
      toast({ title: "Fitbit desconectado" });
    },
  });

  const { data: summary, isLoading: summaryLoading } = useQuery<MetricSummary[]>({
    queryKey: ["/api/wearable-metrics/summary"],
  });

  const { data: latest, isLoading: latestLoading } = useQuery<WearableMetric[]>({
    queryKey: ["/api/wearable-metrics/latest"],
  });

  const thirtyDaysAgo = format(subDays(new Date(), 30), "yyyy-MM-dd");
  const { data: chartData, isLoading: chartLoading } = useQuery<WearableMetric[]>({
    queryKey: [`/api/wearable-metrics?metricType=${chartMetric}&from=${thirtyDaysAgo}`],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/wearable-metrics/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wearable-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wearable-metrics/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wearable-metrics/latest"] });
      toast({ title: "Métrica eliminada" });
    },
  });

  const chartConfig: ChartConfig = {
    value: {
      label: getMetricInfo(chartMetric).label,
      color: getMetricInfo(chartMetric).color,
    },
  };

  const processedChartData = (chartData || [])
    .slice()
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())
    .map(m => ({
      date: format(new Date(m.recordedAt), "dd/MM", { locale: es }),
      value: parseFloat(m.value),
      fullDate: format(new Date(m.recordedAt), "dd MMM yyyy HH:mm", { locale: es }),
    }));

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-health-title">Datos de Salud (Fitbit)</h1>
          <p className="text-muted-foreground text-sm">Monitorea tus métricas sincronizadas directamente desde tu dispositivo Fitbit</p>
        </div>
      </div>

      {summaryLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : summary && summary.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {summary.map(s => {
            const info = getMetricInfo(s.metricType);
            const Icon = info.icon;
            const val = parseFloat(s.latestValue);
            const outOfRange = isOutOfRange(s.metricType, val);
            return (
              <Card key={s.metricType} data-testid={`card-metric-${s.metricType}`}>
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {info.label} ({info.unit})
                  </CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Prom: {s.avg.toFixed(1)}</span>
                    <span>Min: {s.min}</span>
                    <span>Max: {s.max}</span>
                    <span>{s.count} registros</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Sin datos de Fitbit</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Conecta tu cuenta de Fitbit para comenzar a ver tus métricas de salud automáticamente.
            </p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="chart" className="space-y-4">
        <TabsList data-testid="tabs-health-view">
          <TabsTrigger value="chart" data-testid="tab-chart">Gráfico</TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">Historial</TabsTrigger>
          <TabsTrigger value="sync" data-testid="tab-sync">Sincronizar Dispositivos</TabsTrigger>
        </TabsList>

        <TabsContent value="chart" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-base">Tendencia - Últimos 30 días</CardTitle>
              <Select value={chartMetric} onValueChange={setChartMetric}>
                <SelectTrigger className="w-[200px]" data-testid="select-chart-metric">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METRIC_TYPES.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {chartLoading ? (
                <Skeleton className="h-[300px]" />
              ) : processedChartData.length === 0 ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground text-sm">
                  No hay datos para este tipo de métrica en los últimos 30 días
                </div>
              ) : (
                <ChartContainer config={chartConfig} className="h-[300px] w-full">
                  <AreaChart data={processedChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 12 }} />
                    <YAxis className="text-xs" tick={{ fontSize: 12 }} />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          labelFormatter={(_, payload) => {
                            if (payload?.[0]?.payload?.fullDate) return payload[0].payload.fullDate;
                            return "";
                          }}
                        />
                      }
                    />
                    <defs>
                      <linearGradient id="fillValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={getMetricInfo(chartMetric).color} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={getMetricInfo(chartMetric).color} stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={getMetricInfo(chartMetric).color}
                      fill="url(#fillValue)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </AreaChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <HistoryTable
            chartMetric={chartMetric}
            setChartMetric={setChartMetric}
            onDelete={(id) => deleteMutation.mutate(id)}
            deleteLoading={deleteMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="sync" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Conectar Dispositivos Wearables</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className={`p-4 ${fitbitConnection ? "" : "border-dashed"}`}>
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-teal-100 dark:bg-teal-900 rounded-lg">
                      <Watch className="h-6 w-6 text-teal-600 dark:text-teal-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">Fitbit</h3>
                        {fitbitConnection && (
                          <Badge variant="default" className="text-xs" data-testid="badge-fitbit-connected">
                            <Check className="h-3 w-3 mr-1" /> Conectado
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        {fitbitConnection
                          ? `Última sincronización: ${fitbitConnection.lastSyncAt ? format(new Date(fitbitConnection.lastSyncAt), "dd MMM yyyy HH:mm", { locale: es }) : "Nunca"}`
                          : "Sincroniza pasos, frecuencia cardíaca, sueño, peso, SpO2 y más."}
                      </p>
                      {fitbitConnection ? (
                        <div className="flex gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            className="flex-1"
                            onClick={() => syncFitbitMutation.mutate()}
                            disabled={syncFitbitMutation.isPending}
                            data-testid="button-sync-fitbit"
                          >
                            {syncFitbitMutation.isPending ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4 mr-1" />
                            )}
                            Sincronizar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => disconnectFitbitMutation.mutate()}
                            disabled={disconnectFitbitMutation.isPending}
                            data-testid="button-disconnect-fitbit"
                          >
                            <Unplug className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="default"
                          size="sm"
                          className="w-full"
                          onClick={() => connectFitbitMutation.mutate()}
                          disabled={connectFitbitMutation.isPending}
                          data-testid="button-connect-fitbit"
                        >
                          {connectFitbitMutation.isPending ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : (
                            <Watch className="h-4 w-4 mr-1" />
                          )}
                          Conectar Fitbit
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>

                <Card className="p-4 border-dashed">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                      <AlertTriangle className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">Otros Dispositivos</h3>
                      <p className="text-xs text-muted-foreground mb-3">Actualmente solo soportamos sincronización directa con Fitbit. Próximamente agregaremos más integraciones.</p>
                      <Badge variant="outline" className="mb-3">Próximamente</Badge>
                    </div>
                  </div>
                </Card>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg border">
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  ¿Por qué integrar mis wearables?
                </h4>
                <ul className="text-xs space-y-2 text-muted-foreground list-disc pl-4">
                  <li>Permite a tu médico ver tendencias reales entre consultas.</li>
                  <li>Detección temprana de anomalías en frecuencia cardíaca o sueño.</li>
                  <li>Análisis automático mediante nuestra IA para sugerencias preventivas.</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function HistoryTable({
  chartMetric,
  setChartMetric,
  onDelete,
  deleteLoading,
}: {
  chartMetric: string;
  setChartMetric: (v: string) => void;
  onDelete: (id: number) => void;
  deleteLoading: boolean;
}) {
  const { data: metrics, isLoading } = useQuery<WearableMetric[]>({
    queryKey: [`/api/wearable-metrics?metricType=${chartMetric}`],
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base">Historial de registros</CardTitle>
        <Select value={chartMetric} onValueChange={setChartMetric}>
          <SelectTrigger className="w-[200px]" data-testid="select-history-metric">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {METRIC_TYPES.map(m => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : !metrics || metrics.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sin registros para esta métrica</p>
        ) : (
          <div className="space-y-1">
            {metrics.slice(0, 50).map(m => {
              const val = parseFloat(m.value);
              const outOfRange = isOutOfRange(m.metricType, val);
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-2 py-2 border-b last:border-b-0"
                  data-testid={`row-metric-${m.id}`}
                >
                  <div className="flex items-center gap-3">
                    {getMetricIcon(m.metricType)}
                    <div>
                      <span className={`font-medium ${outOfRange ? "text-destructive" : ""}`}>{m.value} {m.unit}</span>
                      {outOfRange && <Badge variant="destructive" className="ml-2 text-xs">Alerta</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(m.recordedAt), "dd MMM yyyy HH:mm", { locale: es })}
                    </span>
                    <Badge variant="outline" className="text-xs">{m.source}</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(m.id)}
                      disabled={deleteLoading}
                      data-testid={`button-delete-metric-${m.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}