import { useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Upload, CheckCircle2, FileSignature, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type DocStatus = { exists: boolean; signed: boolean; signedAt: string | null };
type SigningStatus = {
  prescription: DocStatus;
  instructions: DocStatus;
  exams: DocStatus;
};

type DocTypeKey = "prescription" | "instructions" | "exams";

const docLabels: Record<DocTypeKey, string> = {
  prescription: "Receta médica",
  instructions: "Indicaciones médicas",
  exams: "Órdenes de exámenes",
};

export function SigningPanel({
  appointmentId,
  onSignedChange,
}: {
  appointmentId: string | number;
  onSignedChange?: (status: SigningStatus) => void;
}) {
  const { data: status, refetch } = useQuery<SigningStatus>({
    queryKey: ["/api/consultations", appointmentId, "signing-status"],
    enabled: !!appointmentId,
  });

  const docs: DocTypeKey[] = ["prescription", "instructions", "exams"];
  const existing = docs.filter((d) => status?.[d]?.exists);

  if (existing.length === 0) return null;

  return (
    <div className="space-y-3" data-testid="signing-panel">
      <div className="flex items-center gap-2">
        <FileSignature className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-base">Firma de documentos</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Descarga cada documento, fírmalo (manual o digitalmente) y súbelo firmado antes de enviar al paciente.
      </p>
      <div className="space-y-2">
        {existing.map((docType) => (
          <DocRow
            key={docType}
            appointmentId={appointmentId}
            docType={docType}
            status={status![docType]}
            onUploaded={async () => {
              const next = await refetch();
              if (next.data) onSignedChange?.(next.data);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function DocRow({
  appointmentId,
  docType,
  status,
  onUploaded,
}: {
  appointmentId: string | number;
  docType: DocTypeKey;
  status: DocStatus;
  onUploaded: () => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [downloading, setDownloading] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: async (base64: string) => {
      const res = await apiRequest(
        "POST",
        `/api/consultations/${appointmentId}/signed-pdf/${docType}`,
        { pdfBase64: base64 }
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/consultations", appointmentId, "signing-status"],
      });
      toast({ title: "PDF firmado subido", description: "El documento ha sido marcado como firmado." });
      onUploaded();
    },
    onError: (e: any) => {
      toast({
        title: "Error al subir",
        description: e?.message || "No se pudo subir el PDF firmado",
        variant: "destructive",
      });
    },
  });

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(
        `/api/consultations/${appointmentId}/unsigned-pdf/${docType}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error("No se pudo generar el PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${docType}_sin_firmar.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast({
        title: "Error",
        description: e?.message || "No se pudo descargar el PDF",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  const handleFilePick = (file: File) => {
    if (file.type !== "application/pdf") {
      toast({
        title: "Archivo inválido",
        description: "El archivo debe ser un PDF.",
        variant: "destructive",
      });
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast({
        title: "Archivo demasiado grande",
        description: "El PDF no puede superar los 15 MB.",
        variant: "destructive",
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      if (base64) uploadMutation.mutate(base64);
    };
    reader.readAsDataURL(file);
  };

  return (
    <Card data-testid={`signing-row-${docType}`}>
      <CardContent className="py-3 px-4 flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{docLabels[docType]}</p>
            {status.signed ? (
              <Badge variant="default" className="gap-1 text-[10px]" data-testid={`badge-signed-${docType}`}>
                <CheckCircle2 className="h-3 w-3" /> Firmado
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]" data-testid={`badge-pending-${docType}`}>
                Pendiente de firma
              </Badge>
            )}
          </div>
          {status.signed && status.signedAt && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Firmado el {new Date(status.signedAt).toLocaleString("es-CL")}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={downloading}
            data-testid={`button-download-${docType}`}
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-1.5" />
            )}
            Descargar sin firmar
          </Button>
          <Button
            variant={status.signed ? "outline" : "default"}
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={uploadMutation.isPending}
            data-testid={`button-upload-${docType}`}
          >
            {uploadMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-1.5" />
            )}
            {status.signed ? "Reemplazar PDF firmado" : "Subir PDF firmado"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFilePick(file);
              e.target.value = "";
            }}
            data-testid={`input-file-${docType}`}
          />
        </div>
      </CardContent>
    </Card>
  );
}
