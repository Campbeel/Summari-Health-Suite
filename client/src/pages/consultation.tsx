import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useWebRTC, WaitingPatient } from "@/hooks/use-webrtc";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  PhoneOff, 
  FileText, 
  Pill,
  Clock,
  User,
  Activity,
  AlertCircle,
  Send,
  Loader2,
  Phone,
  UserCheck,
  UserX,
  ShieldCheck,
  MessageCircle,
  Paperclip,
  Download,
  File,
  Image,
  X,
  ArrowLeft
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { ClinicalAssistant } from "@/components/clinical-assistant";
import { Bot } from "lucide-react";

interface ConsultationData {
  appointment: {
    id: number;
    scheduledDate: string;
    scheduledTime: string;
    status: string;
    consultationType: string;
    notes?: string;
  };
  doctor: {
    id: number;
    specialty: string;
    userName: string;
    userImage?: string;
    userId: string;
  };
  patient: {
    id: number;
    dateOfBirth?: string;
    gender?: string;
    bloodType?: string;
    allergies?: string[];
    medicalHistory?: string;
    userName: string;
    userImage?: string;
  };
  clinicalRecord?: {
    id: number;
    chiefComplaint?: string;
    symptoms?: string[];
    diagnosis?: string;
    notes?: string;
    transcription?: string;
  };
}

interface ChatMessage {
  id: number;
  appointmentId: number;
  senderUserId: string;
  senderRole: string;
  senderName: string;
  content: string | null;
  fileName: string | null;
  fileUrl: string | null;
  fileType: string | null;
  fileSize: number | null;
  createdAt: string;
}

function DoctorPresenceIndicator({ appointmentId }: { appointmentId: number }) {
  const { data } = useQuery<{ doctorOnline: boolean }>({
    queryKey: ["/api/appointments", appointmentId, "presence"],
    queryFn: async () => {
      const res = await fetch(`/api/appointments/${appointmentId}/presence`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      return res.json();
    },
    refetchInterval: 10000,
  });

  const isOnline = data?.doctorOnline ?? false;

  return (
    <div className="flex items-center gap-2" data-testid="doctor-presence-indicator">
      {isOnline ? (
        <>
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          <span className="text-sm text-green-600 dark:text-green-400 font-medium">Doctor en línea</span>
        </>
      ) : (
        <>
          <span className="relative flex h-3 w-3">
            <span className="relative inline-flex rounded-full h-3 w-3 bg-gray-400"></span>
          </span>
          <span className="text-sm text-muted-foreground font-medium">Doctor desconectado</span>
        </>
      )}
    </div>
  );
}

export default function ConsultationPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const [isRecording, setIsRecording] = useState(false);
  const [notes, setNotes] = useState("");
  const [hasJoinedCall, setHasJoinedCall] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatFile, setChatFile] = useState<globalThis.File | null>(null);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mixedStreamRef = useRef<MediaStream | null>(null);

  const { data: consultation, isLoading } = useQuery<ConsultationData>({
    queryKey: ["/api/consultations", id],
  });

  const roomId = `consultation-${id}`;
  const userId = user?.id || '';
  const isDoctor = consultation ? consultation.doctor.userId === userId : false;

  const {
    localStream,
    remoteStream,
    isConnected,
    isConnecting,
    error: webrtcError,
    isMuted,
    isVideoEnabled,
    isWaiting,
    isDenied,
    waitingPatients,
    connect,
    disconnect,
    toggleMute,
    toggleVideo,
    admitPatient,
    denyPatient,
  } = useWebRTC({
    roomId,
    userId,
    appointmentId: id,
    isDoctor,
    onError: (error) => {
      toast({
        title: "Error de videollamada",
        description: error,
        variant: "destructive",
      });
    },
    onConnectionStateChange: (state) => {
      if (state === 'connected') {
        toast({
          title: "Conectado",
          description: "La videollamada se ha establecido correctamente",
        });
      } else if (state === 'disconnected' || state === 'failed') {
        toast({
          title: "Desconectado",
          description: "La conexión de video se ha interrumpido",
          variant: "destructive",
        });
      }
    },
    onWaitingPatient: (patientId, patientName) => {
      toast({
        title: "Paciente en sala de espera",
        description: `${patientName} está esperando para ingresar a la consulta`,
      });
    },
    onChatMessage: (message: ChatMessage) => {
      setChatMessages(prev => {
        if (prev.find(m => m.id === message.id)) return prev;
        return [...prev, message];
      });
    },
    onDoctorDisconnected: () => {
      if (!isDoctor) {
        setTimeout(() => {
          navigate(`/consultation/${id}/feedback`);
        }, 2000);
      }
    },
  });

  useEffect(() => {
    if (!isDoctor && id) {
      try {
        const ended = JSON.parse(localStorage.getItem("ended_consultations") || "[]");
        if (ended.includes(Number(id))) {
          navigate(`/consultation/${id}/feedback`);
        }
      } catch {}
    }
  }, [isDoctor, id, navigate]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (webrtcError) {
      toast({
        title: "Error de videollamada",
        description: webrtcError,
        variant: "destructive",
      });
    }
  }, [webrtcError, toast]);

  const handleJoinCall = async () => {
    setHasJoinedCall(true);
    await connect();
  };

  const handleEndCall = async () => {
    let audioBase64: string | null = null;

    if (isRecording && mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        const recorder = mediaRecorderRef.current!;
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
            console.log(`[Recording] Final chunk received: ${event.data.size} bytes`);
          }
        };
        recorder.onstop = () => resolve();
        try { recorder.requestData(); } catch {}
        recorder.stop();
      });
    }

    console.log(`[Recording] End call: ${audioChunksRef.current.length} chunks collected`);
    if (audioChunksRef.current.length > 0) {
      const fullBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      console.log(`[Recording] Combined blob size: ${fullBlob.size} bytes (${(fullBlob.size / 1024 / 1024).toFixed(2)} MB)`);
      audioChunksRef.current = [];
      audioBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(fullBlob);
      });
    } else {
      console.log("[Recording] No audio chunks collected - recording may not have started properly");
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    mixedStreamRef.current = null;
    setIsRecording(false);

    autoStartedRef.current = false;
    hasRestartedWithRemoteRef.current = false;
    disconnect();
    setHasJoinedCall(false);

    if (isDoctor) {
      endConsultationMutation.mutate(audioBase64);
    } else {
      try {
        const ended = JSON.parse(localStorage.getItem("ended_consultations") || "[]");
        if (!ended.includes(Number(id))) {
          ended.push(Number(id));
          localStorage.setItem("ended_consultations", JSON.stringify(ended));
        }
      } catch {}
      navigate(`/consultation/${id}/feedback`);
    }
  };

  const endConsultationMutation = useMutation({
    mutationFn: async (audioData: string | null) => {
      setIsProcessing(true);
      const response = await apiRequest("POST", `/api/consultations/${id}/end`, {
        audioData,
        notes,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setIsProcessing(false);
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      toast({
        title: "Consulta finalizada",
        description: "Revisa y valida la información clínica generada",
      });
      navigate(`/doctor/consultation/${id}/validate`);
    },
    onError: () => {
      setIsProcessing(false);
      toast({
        title: "Error",
        description: "No se pudo finalizar la consulta",
        variant: "destructive",
      });
    },
  });

  const createMixedAudioStream = useCallback(async (local: MediaStream, remote: MediaStream | null): Promise<MediaStream> => {
    if (audioContextRef.current) {
      await audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    try {
      const audioContext = new AudioContext({ sampleRate: 48000 });
      audioContextRef.current = audioContext;

      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      console.log(`[Recording] AudioContext state: ${audioContext.state}, sampleRate: ${audioContext.sampleRate}`);

      const destination = audioContext.createMediaStreamDestination();

      const localAudioTracks = local.getAudioTracks();
      if (localAudioTracks.length > 0) {
        const localSource = audioContext.createMediaStreamSource(new MediaStream(localAudioTracks));
        localSource.connect(destination);
      }

      if (remote) {
        const remoteAudioTracks = remote.getAudioTracks();
        if (remoteAudioTracks.length > 0) {
          const remoteSource = audioContext.createMediaStreamSource(new MediaStream(remoteAudioTracks));
          remoteSource.connect(destination);
        }
      }

      mixedStreamRef.current = destination.stream;
      return destination.stream;
    } catch (error) {
      console.error("[Transcription] Error creating mixed stream, falling back to local:", error);
      if (audioContextRef.current) {
        await audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      return new MediaStream(local.getAudioTracks());
    }
  }, []);

  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const hasRestartedWithRemoteRef = useRef(false);

  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);
  useEffect(() => { remoteStreamRef.current = remoteStream; }, [remoteStream]);

  const startRecording = useCallback(async (preserveChunks = false) => {
    const currentLocal = localStreamRef.current;
    if (!currentLocal) {
      console.log("[Transcription] No local stream available");
      return;
    }

    try {
      const localAudioTracks = currentLocal.getAudioTracks();
      if (localAudioTracks.length === 0) {
        console.log("[Transcription] No local audio tracks");
        return;
      }

      const currentRemote = remoteStreamRef.current;
      const mixedStream = await createMixedAudioStream(currentLocal, currentRemote);

      const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
      let selectedMime = '';
      for (const mime of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mime)) {
          selectedMime = mime;
          break;
        }
      }
      console.log(`[Recording] Selected MIME type: ${selectedMime || 'browser default'}`);

      const recorderOptions: MediaRecorderOptions = selectedMime ? { mimeType: selectedMime } : {};
      const mediaRecorder = new MediaRecorder(mixedStream, recorderOptions);
      
      mediaRecorderRef.current = mediaRecorder;
      if (!preserveChunks) {
        audioChunksRef.current = [];
      }

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          console.log(`[Recording] Chunk received: ${event.data.size} bytes, total chunks: ${audioChunksRef.current.length}`);
        }
      };

      mediaRecorder.onerror = (event: any) => {
        console.error("[Recording] MediaRecorder error:", event.error?.name, event.error?.message);
        toast({
          title: "Error en la grabación",
          description: "Se detectó un problema con la transcripción. Intenta reanudarla.",
          variant: "destructive",
        });
        setIsRecording(false);
      };

      // Monitor local audio track for unexpected loss (mic unplugged, permissions revoked)
      const localTrack = localAudioTracks[0];
      if (localTrack) {
        localTrack.onended = () => {
          console.warn("[Recording] Local audio track ended unexpectedly");
          toast({
            title: "Micrófono desconectado",
            description: "Se perdió el acceso al micrófono. Verifica los permisos.",
            variant: "destructive",
          });
          setIsRecording(false);
        };
        localTrack.onmute = () => {
          console.warn("[Recording] Local audio track muted by system");
        };
      }

      mediaRecorder.start(5000);
      setIsRecording(true);

      console.log(`[Recording] Recording started (preserveChunks=${preserveChunks}, existing chunks: ${audioChunksRef.current.length}, state: ${mediaRecorder.state})`);

    } catch (error: any) {
      console.error("Error starting recording:", error);
      const isPermission = error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError";
      toast({
        title: isPermission ? "Permiso de micrófono denegado" : "No se pudo iniciar la grabación",
        description: isPermission
          ? "Permite el acceso al micrófono para transcribir la consulta."
          : "Ocurrió un error al iniciar la transcripción. Intenta nuevamente.",
        variant: "destructive",
      });
      setIsRecording(false);
    }
  }, [createMixedAudioStream, toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    mixedStreamRef.current = null;
    setIsRecording(false);
  }, []);

  const restartRecordingWithRemote = useCallback(() => {
    if (!isRecording || !remoteStreamRef.current || hasRestartedWithRemoteRef.current) return;
    const remoteAudioTracks = remoteStreamRef.current.getAudioTracks();
    if (remoteAudioTracks.length === 0) return;

    hasRestartedWithRemoteRef.current = true;
    console.log(`[Transcription] Remote audio available, restarting recorder with mixed audio (preserving ${audioChunksRef.current.length} chunks)`);
    stopRecording();
    setTimeout(() => startRecording(true), 500);
  }, [isRecording, stopRecording, startRecording]);

  const handleToggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
      toast({
        title: "Transcripción detenida",
        description: "La grabación ha sido pausada",
      });
    } else {
      startRecording();
      toast({
        title: "Transcripción iniciada",
        description: "La consulta está siendo transcrita automáticamente",
      });
    }
  }, [isRecording, startRecording, stopRecording, toast]);

  // Auto-start transcription when doctor joins the call
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (isDoctor && hasJoinedCall && localStream && !isRecording && !autoStartedRef.current) {
      autoStartedRef.current = true;
      console.log("[Transcription] Auto-starting transcription for doctor");
      const timer = setTimeout(() => startRecording(), 1500);
      return () => clearTimeout(timer);
    }
  }, [isDoctor, hasJoinedCall, localStream, isRecording, startRecording]);

  // Restart recording when remote audio becomes available to include patient audio
  useEffect(() => {
    if (remoteStream && isRecording && !hasRestartedWithRemoteRef.current) {
      restartRecordingWithRemote();
    }
  }, [remoteStream, isRecording, restartRecordingWithRemote]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  const handleAdmitPatient = (patientId: string) => {
    admitPatient(patientId);
    toast({
      title: "Paciente admitido",
      description: "El paciente ha sido autorizado para ingresar a la consulta",
    });
  };

  const handleDenyPatient = (patientId: string) => {
    denyPatient(patientId);
    toast({
      title: "Ingreso denegado",
      description: "Se ha denegado el ingreso del paciente",
      variant: "destructive",
    });
  };

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    fetch(`/api/consultations/${id}/messages`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.ok ? res.json() : [])
      .then(msgs => setChatMessages(msgs))
      .catch(() => {});
  }, [id]);


  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const sendChatMessage = async () => {
    if ((!chatInput.trim() && !chatFile) || isSendingChat) return;
    setIsSendingChat(true);
    try {
      const token = localStorage.getItem('auth_token');
      const formData = new FormData();
      if (chatInput.trim()) formData.append('content', chatInput.trim());
      if (chatFile) formData.append('file', chatFile);

      const res = await fetch(`/api/consultations/${id}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      if (!res.ok) throw new Error('Failed to send');
      const msg = await res.json();
      setChatMessages(prev => {
        if (prev.find(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setChatInput("");
      setChatFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch {
      toast({
        title: "Error",
        description: "No se pudo enviar el mensaje",
        variant: "destructive",
      });
    } finally {
      setIsSendingChat(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isImageFile = (type: string | null) => type?.startsWith('image/');
  const getAuthFileUrl = (url: string | null) => {
    if (!url) return '';
    const token = localStorage.getItem('auth_token');
    if (!token) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}token=${encodeURIComponent(token)}`;
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!consultation) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Consulta no encontrada</h2>
          <Button onClick={() => navigate("/appointments")} data-testid="button-back-appointments">Volver a consultas</Button>
        </div>
      </div>
    );
  }

  const { appointment, doctor, patient, clinicalRecord } = consultation;

  if (isProcessing) {
    return (
      <div className="h-screen flex items-center justify-center" data-testid="processing-overlay">
        <div className="text-center max-w-md px-6">
          <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-6" />
          <h2 className="text-xl font-semibold mb-2">Procesando consulta</h2>
          <p className="text-muted-foreground mb-4">
            Transcribiendo el audio de la consulta y generando sugerencias clínicas con IA. Esto puede tomar unos momentos...
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Activity className="h-4 w-4 animate-pulse" />
            <span>No cierres esta ventana</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-4 py-2 border-b bg-background/80 backdrop-blur-md shrink-0 z-10">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(isDoctor ? "/doctor/appointments" : "/appointments")}
            data-testid="button-back-consultation"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver
          </Button>
          <div className="hidden sm:block text-sm">
            <span className="font-medium">Consulta</span>
            <span className="text-muted-foreground ml-1">
              — {isDoctor ? patient.userName : `Dr. ${doctor.userName}`}
            </span>
          </div>
        </div>
        <ThemeToggle />
      </header>
      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 overflow-y-auto lg:overflow-hidden">
      {/* Main Video Area */}
      <div className="flex-none lg:flex-1 flex flex-col min-h-0">
        {/* Video Container */}
        <div className="flex-1 bg-muted rounded-xl relative overflow-hidden min-h-[200px] sm:min-h-[300px]">
          {/* Denied State for Patient */}
          {isDenied ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center max-w-md px-4 sm:px-6">
                <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-3 sm:mb-6">
                  <UserX className="h-7 w-7 sm:h-10 sm:w-10 text-destructive" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold mb-2" data-testid="text-denied-title">Ingreso no autorizado</h3>
                <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6" data-testid="text-denied-message">
                  El médico no ha autorizado tu ingreso a esta consulta. Si crees que es un error, contacta a tu médico.
                </p>
                <Button variant="outline" onClick={() => navigate("/appointments")} data-testid="button-back-from-denied">
                  Volver a mis consultas
                </Button>
              </div>
            </div>
          ) : isWaiting ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center max-w-md px-4 sm:px-6">
                <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3 sm:mb-6">
                  <ShieldCheck className="h-7 w-7 sm:h-10 sm:w-10 text-primary" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold mb-2" data-testid="text-waiting-room-title">Sala de espera</h3>
                <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6" data-testid="text-waiting-room-message">
                  Estás en la sala de espera. El Dr. {doctor.userName} debe autorizar tu ingreso a la consulta.
                </p>
                <div className="flex flex-col items-center gap-3">
                  <DoctorPresenceIndicator appointmentId={parseInt(id)} />
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Esperando autorización...</span>
                  </div>
                </div>
              </div>
            </div>
          ) : !hasJoinedCall ? (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="text-center px-4">
                <Avatar className="h-20 w-20 sm:h-32 sm:w-32 mx-auto mb-3 sm:mb-4">
                  <AvatarImage src={isDoctor ? patient.userImage : doctor.userImage} />
                  <AvatarFallback className="bg-primary/10 text-primary text-2xl sm:text-4xl">
                    {isDoctor ? (patient.userName?.[0] || "P") : (doctor.userName?.[0] || "DR")}
                  </AvatarFallback>
                </Avatar>
                <h3 className="text-lg sm:text-xl font-semibold">{isDoctor ? patient.userName : doctor.userName}</h3>
                <p className="text-sm sm:text-base text-muted-foreground mb-3 sm:mb-4">{isDoctor ? "Paciente" : doctor.specialty}</p>
                <Button 
                  size="lg" 
                  onClick={handleJoinCall}
                  data-testid="button-join-call"
                >
                  <Phone className="h-5 w-5 mr-2" />
                  {isDoctor ? "Iniciar consulta" : "Unirse a la consulta"}
                </Button>
                {!isDoctor && (
                  <p className="text-xs text-muted-foreground mt-3">
                    Deberás esperar a que el médico autorice tu ingreso
                  </p>
                )}
              </div>
            </div>
          ) : remoteStream ? (
            <video 
              ref={remoteVideoRef}
              autoPlay 
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
              data-testid="video-remote"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center px-4">
                <Avatar className="h-20 w-20 sm:h-32 sm:w-32 mx-auto mb-3 sm:mb-4">
                  <AvatarImage src={isDoctor ? patient.userImage : doctor.userImage} />
                  <AvatarFallback className="bg-primary/10 text-primary text-2xl sm:text-4xl">
                    {isDoctor ? (patient.userName?.[0] || "P") : (doctor.userName?.[0] || "DR")}
                  </AvatarFallback>
                </Avatar>
                <h3 className="text-lg sm:text-xl font-semibold">{isDoctor ? patient.userName : doctor.userName}</h3>
                <p className="text-sm sm:text-base text-muted-foreground">{isDoctor ? "Paciente" : doctor.specialty}</p>
                {isConnecting && (
                  <div className="flex items-center justify-center gap-2 mt-4 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Esperando al otro participante...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Local Video (Picture-in-Picture) */}
          <div className="absolute bottom-2 right-2 w-24 h-16 sm:bottom-4 sm:right-4 sm:w-40 sm:h-28 bg-background rounded-lg border overflow-hidden shadow-lg">
            {localStream ? (
              <video 
                ref={localVideoRef}
                autoPlay 
                playsInline 
                muted
                className={`w-full h-full object-cover ${!isVideoEnabled ? 'hidden' : ''}`}
                data-testid="video-local"
              />
            ) : null}
            {(!localStream || !isVideoEnabled) && (
              <div className="h-full flex items-center justify-center bg-muted">
                <User className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
          </div>

          {isRecording && (
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-destructive/90 text-destructive-foreground px-3 py-1.5 rounded-full text-sm" data-testid="status-recording">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              Grabando
            </div>
          )}

          {/* Connection Status */}
          {hasJoinedCall && !isWaiting && (
            <div className="absolute top-4 left-4 flex items-center gap-2">
              {isConnected ? (
                <Badge variant="default" className="bg-green-500" data-testid="badge-connected">
                  <span className="w-2 h-2 bg-white rounded-full mr-1.5" />
                  Conectado
                </Badge>
              ) : isConnecting ? (
                <Badge variant="outline" className="bg-background/80 backdrop-blur-sm" data-testid="badge-connecting">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Conectando...
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-background/80 backdrop-blur-sm" data-testid="badge-waiting">
                  <Clock className="h-3 w-3 mr-1" />
                  Esperando...
                </Badge>
              )}
            </div>
          )}

          {/* Status Badge */}
          <div className="absolute top-4 right-4">
            <Badge variant="outline" className="bg-background/80 backdrop-blur-sm" data-testid="badge-consultation-time">
              <Clock className="h-3 w-3 mr-1" />
              {appointment.scheduledTime.slice(0, 5)}
            </Badge>
          </div>

          {/* Waiting Patients Banner (for Doctor) */}
          {isDoctor && waitingPatients.length > 0 && (
            <div className="absolute bottom-16 left-4 right-4 z-10" data-testid="waiting-patients-banner">
              <Card className="bg-background/95 backdrop-blur-sm border-primary/30">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <User className="h-4 w-4 text-primary" />
                    <span>Pacientes en sala de espera ({waitingPatients.length})</span>
                  </div>
                  {waitingPatients.map((wp) => (
                    <div key={wp.id} className="flex items-center justify-between gap-2 bg-muted/50 rounded-md p-2" data-testid={`waiting-patient-${wp.id}`}>
                      <span className="text-sm font-medium truncate">{wp.name}</span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleAdmitPatient(wp.id)}
                          data-testid={`button-admit-${wp.id}`}
                        >
                          <UserCheck className="h-4 w-4 mr-1" />
                          Admitir
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDenyPatient(wp.id)}
                          data-testid={`button-deny-${wp.id}`}
                        >
                          <UserX className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3 sm:gap-4 py-2 sm:py-4">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isMuted ? "destructive" : "outline"}
                  size="icon"
                  className="h-10 w-10 sm:h-12 sm:w-12 rounded-full"
                  onClick={toggleMute}
                  disabled={!hasJoinedCall || isWaiting}
                  data-testid="button-mute"
                >
                  {isMuted ? <MicOff className="h-4 w-4 sm:h-5 sm:w-5" /> : <Mic className="h-4 w-4 sm:h-5 sm:w-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {isMuted ? "Activar micrófono" : "Silenciar micrófono"}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={!isVideoEnabled ? "destructive" : "outline"}
                  size="icon"
                  className="h-10 w-10 sm:h-12 sm:w-12 rounded-full"
                  onClick={toggleVideo}
                  disabled={!hasJoinedCall || isWaiting}
                  data-testid="button-video"
                >
                  {isVideoEnabled ? <Video className="h-4 w-4 sm:h-5 sm:w-5" /> : <VideoOff className="h-4 w-4 sm:h-5 sm:w-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {isVideoEnabled ? "Desactivar cámara" : "Activar cámara"}
              </TooltipContent>
            </Tooltip>

            {isDoctor && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={isRecording ? "default" : "outline"}
                    size="icon"
                    className="h-10 w-10 sm:h-12 sm:w-12 rounded-full"
                    onClick={handleToggleRecording}
                    data-testid="button-record"
                  >
                    <Activity className={`h-4 w-4 sm:h-5 sm:w-5 ${isRecording ? "animate-pulse" : ""}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {isRecording ? "Detener grabación" : "Iniciar grabación"}
                </TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-10 w-10 sm:h-12 sm:w-12 rounded-full"
                  onClick={handleEndCall}
                  disabled={!hasJoinedCall || isWaiting}
                  data-testid="button-end-call"
                >
                  <PhoneOff className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Terminar consulta
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Sidebar - Clinical Information */}
      <div className="w-full lg:w-96 flex flex-col min-h-[300px] lg:min-h-0">
        <Tabs defaultValue={isDoctor ? "assistant" : "chat"} className="flex-1 flex flex-col min-h-0">
          <TabsList className={`grid ${isDoctor ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {isDoctor && (
              <TabsTrigger value="assistant" data-testid="tab-assistant">
                <Bot className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Asistente</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="chat" data-testid="tab-chat">
              <MessageCircle className="h-4 w-4 mr-1" />
              Chat
            </TabsTrigger>
            {isDoctor && (
              <TabsTrigger value="notes" data-testid="tab-notes">
                <FileText className="h-4 w-4 mr-1" />
                Notas
              </TabsTrigger>
            )}
            {!isDoctor && (
              <TabsTrigger value="info" data-testid="tab-info">
                <User className="h-4 w-4 mr-1" />
                Médico
              </TabsTrigger>
            )}
          </TabsList>

          {/* Assistant Tab (Doctor only) */}
          {isDoctor && (
            <TabsContent value="assistant" className="flex-1 mt-4 min-h-0 data-[state=inactive]:hidden" forceMount>
              <Card className="h-full flex flex-col">
                <ClinicalAssistant appointmentId={id!} className="flex-1 min-h-[400px]" />
              </Card>
            </TabsContent>
          )}

          {/* Chat Tab */}
          <TabsContent value="chat" className="flex-1 mt-4 min-h-0">
            <Card className="h-full flex flex-col">
              <CardContent className="flex-1 flex flex-col p-0 min-h-0">
                <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-3 space-y-3" data-testid="chat-messages">
                  {chatMessages.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Envía un mensaje o archivo para iniciar la conversación</p>
                    </div>
                  )}
                  {chatMessages.map((msg) => {
                    const isOwn = msg.senderUserId === userId;
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                        data-testid={`chat-message-${msg.id}`}
                      >
                        <div className={`max-w-[80%] rounded-lg p-2.5 ${isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                          <p className={`text-xs font-medium mb-1 ${isOwn ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                            {msg.senderName}
                            {msg.senderRole === 'doctor' && <Badge variant="outline" className="ml-1 text-[10px] py-0 px-1 border-current">Dr.</Badge>}
                          </p>
                          {msg.content && (
                            <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                          )}
                          {msg.fileUrl && (
                            <div className="mt-1.5">
                              {isImageFile(msg.fileType) ? (
                                <a href={getAuthFileUrl(msg.fileUrl)} target="_blank" rel="noopener noreferrer">
                                  <img
                                    src={getAuthFileUrl(msg.fileUrl)}
                                    alt={msg.fileName || 'imagen'}
                                    className="max-w-full rounded-md max-h-48 object-cover"
                                    data-testid={`chat-image-${msg.id}`}
                                  />
                                </a>
                              ) : (
                                <a
                                  href={getAuthFileUrl(msg.fileUrl)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`flex items-center gap-2 p-2 rounded-md ${isOwn ? 'bg-primary-foreground/10' : 'bg-background'}`}
                                  data-testid={`chat-file-${msg.id}`}
                                >
                                  <File className="h-4 w-4 flex-shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-medium truncate">{msg.fileName}</p>
                                    {msg.fileSize && <p className="text-[10px] opacity-70">{formatFileSize(msg.fileSize)}</p>}
                                  </div>
                                  <Download className="h-3.5 w-3.5 flex-shrink-0" />
                                </a>
                              )}
                            </div>
                          )}
                          <p className={`text-[10px] mt-1 ${isOwn ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                            {new Date(msg.createdAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {chatFile && (
                  <div className="mx-3 mb-1 flex items-center gap-2 bg-muted rounded-md px-2 py-1.5 text-sm">
                    <Paperclip className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="truncate flex-1 text-xs">{chatFile.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => { setChatFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                      data-testid="button-remove-file"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                <div className="flex items-center gap-2 p-3 border-t">
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={(e) => { if (e.target.files?.[0]) setChatFile(e.target.files[0]); }}
                    data-testid="input-chat-file"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="button-attach-file"
                  >
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Input
                    placeholder="Escribe un mensaje..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
                    className="flex-1 h-8 text-sm"
                    data-testid="input-chat-message"
                  />
                  <Button
                    size="icon"
                    className="h-8 w-8 flex-shrink-0"
                    onClick={sendChatMessage}
                    disabled={isSendingChat || (!chatInput.trim() && !chatFile)}
                    data-testid="button-send-chat"
                  >
                    {isSendingChat ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>


          {/* Doctor Info Tab (Patient only) */}
          {!isDoctor && (
            <TabsContent value="info" className="flex-1 mt-4 min-h-0">
              <Card className="h-full">
                <ScrollArea className="h-full">
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center gap-3 pb-4 border-b" data-testid="doctor-info">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={doctor.userImage} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {doctor.userName?.[0] || "DR"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold" data-testid="text-doctor-name">Dr. {doctor.userName}</h3>
                        <p className="text-sm text-muted-foreground" data-testid="text-doctor-specialty">{doctor.specialty}</p>
                      </div>
                    </div>
                    {appointment.notes && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Motivo de Consulta</h4>
                        <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                          {appointment.notes}
                        </p>
                      </div>
                    )}
                    <div>
                      <h4 className="text-sm font-medium mb-2">Detalles de la cita</h4>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p><Clock className="h-3.5 w-3.5 inline mr-1" />{appointment.scheduledDate} a las {appointment.scheduledTime.slice(0, 5)}</p>
                      </div>
                    </div>
                  </CardContent>
                </ScrollArea>
              </Card>
            </TabsContent>
          )}

          {/* Notes Tab (Doctor only) */}
          {isDoctor && (
            <TabsContent value="notes" className="flex-1 mt-4 min-h-0">
              <Card className="h-full flex flex-col">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Notas de Consulta</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Estas notas se guardan al finalizar la consulta y estarán disponibles en la validación post-consulta. Úsalas para anotar observaciones, recordatorios o detalles relevantes durante la atención.
                  </p>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-4 pb-4">
                  <Textarea
                    placeholder="Escribe tus notas aquí..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="flex-1 min-h-[200px] resize-none"
                    data-testid="input-consultation-notes"
                  />
                </CardContent>
              </Card>
            </TabsContent>
          )}

        </Tabs>
      </div>
    </div>
    </div>
  );
}
