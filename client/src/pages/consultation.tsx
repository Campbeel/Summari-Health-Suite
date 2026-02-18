import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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
  ShieldCheck
} from "lucide-react";

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

export default function ConsultationPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [notes, setNotes] = useState("");
  const [hasJoinedCall, setHasJoinedCall] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const isTranscribingRef = useRef(false);
  const transcriptionQueueRef = useRef<Blob[]>([]);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const transcriptionIntervalRef = useRef<NodeJS.Timeout | null>(null);
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
    denyPatient
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
    }
  });

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

  const handleEndCall = () => {
    if (isRecording) {
      stopRecording();
    }
    autoStartedRef.current = false;
    disconnect();
    setHasJoinedCall(false);
    if (isDoctor) {
      endConsultationMutation.mutate();
    }
  };

  const endConsultationMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/consultations/${id}/end`, {
        transcription,
        notes,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      toast({
        title: "Consulta finalizada",
        description: "Revisa y valida la información clínica generada",
      });
      navigate(`/doctor/consultation/${id}/validate`);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo finalizar la consulta",
        variant: "destructive",
      });
    },
  });

  const processTranscriptionQueue = useCallback(async () => {
    if (isTranscribingRef.current || transcriptionQueueRef.current.length === 0) return;

    const audioBlob = transcriptionQueueRef.current.shift()!;
    if (audioBlob.size < 1000) {
      console.log("[Transcription] Audio blob too small, skipping:", audioBlob.size);
      if (transcriptionQueueRef.current.length > 0) {
        processTranscriptionQueue();
      }
      return;
    }

    try {
      setIsTranscribing(true);
      isTranscribingRef.current = true;
      const base64Audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

      const response = await apiRequest("POST", "/api/transcribe", {
        audioData: base64Audio,
      });
      const data = await response.json();
      if (data.transcript && data.transcript.trim()) {
        setTranscription(prev => prev + (prev ? " " : "") + data.transcript.trim());
      }
    } catch (error) {
      console.error("Transcription error:", error);
    } finally {
      setIsTranscribing(false);
      isTranscribingRef.current = false;
      if (transcriptionQueueRef.current.length > 0) {
        processTranscriptionQueue();
      }
    }
  }, []);

  const createMixedAudioStream = useCallback(async (local: MediaStream, remote: MediaStream | null): Promise<MediaStream> => {
    if (audioContextRef.current) {
      await audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    try {
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

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

  const startRecording = useCallback(async () => {
    if (!localStream) {
      console.log("[Transcription] No local stream available");
      return;
    }

    try {
      const localAudioTracks = localStream.getAudioTracks();
      if (localAudioTracks.length === 0) {
        console.log("[Transcription] No local audio tracks");
        return;
      }

      const mixedStream = await createMixedAudioStream(localStream, remoteStream);

      const mediaRecorder = new MediaRecorder(mixedStream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(5000);
      setIsRecording(true);
      console.log("[Transcription] Recording started successfully");

      transcriptionIntervalRef.current = setInterval(() => {
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          audioChunksRef.current = [];
          transcriptionQueueRef.current.push(audioBlob);
          processTranscriptionQueue();
        }
      }, 10000);

    } catch (error) {
      console.error("Error starting recording:", error);
    }
  }, [localStream, remoteStream, createMixedAudioStream, processTranscriptionQueue]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (transcriptionIntervalRef.current) {
      clearInterval(transcriptionIntervalRef.current);
      transcriptionIntervalRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    mixedStreamRef.current = null;
    
    if (audioChunksRef.current.length > 0) {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      audioChunksRef.current = [];
      transcriptionQueueRef.current.push(audioBlob);
      processTranscriptionQueue();
    }
    
    setIsRecording(false);
  }, [processTranscriptionQueue]);

  const restartRecordingWithRemote = useCallback(() => {
    if (!isRecording || !remoteStream) return;
    const remoteAudioTracks = remoteStream.getAudioTracks();
    if (remoteAudioTracks.length === 0) return;

    console.log("[Transcription] Remote audio available, restarting recorder with mixed audio");
    stopRecording();
    setTimeout(() => startRecording(), 500);
  }, [isRecording, remoteStream, stopRecording, startRecording]);

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
    restartRecordingWithRemote();
  }, [restartRecordingWithRemote]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (transcriptionIntervalRef.current) {
        clearInterval(transcriptionIntervalRef.current);
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

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-4">
      {/* Main Video Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Video Container */}
        <div className="flex-1 bg-muted rounded-xl relative overflow-hidden min-h-[300px]">
          {/* Denied State for Patient */}
          {isDenied ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center max-w-md px-6">
                <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
                  <UserX className="h-10 w-10 text-destructive" />
                </div>
                <h3 className="text-xl font-semibold mb-2" data-testid="text-denied-title">Ingreso no autorizado</h3>
                <p className="text-muted-foreground mb-6" data-testid="text-denied-message">
                  El médico no ha autorizado tu ingreso a esta consulta. Si crees que es un error, contacta a tu médico.
                </p>
                <Button variant="outline" onClick={() => navigate("/appointments")} data-testid="button-back-from-denied">
                  Volver a mis consultas
                </Button>
              </div>
            </div>
          ) : isWaiting ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center max-w-md px-6">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                  <ShieldCheck className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2" data-testid="text-waiting-room-title">Sala de espera</h3>
                <p className="text-muted-foreground mb-6" data-testid="text-waiting-room-message">
                  Estás en la sala de espera. El Dr. {doctor.userName} debe autorizar tu ingreso a la consulta.
                </p>
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Esperando autorización...</span>
                </div>
              </div>
            </div>
          ) : !hasJoinedCall ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Avatar className="h-32 w-32 mx-auto mb-4">
                  <AvatarImage src={isDoctor ? patient.userImage : doctor.userImage} />
                  <AvatarFallback className="bg-primary/10 text-primary text-4xl">
                    {isDoctor ? (patient.userName?.[0] || "P") : (doctor.userName?.[0] || "DR")}
                  </AvatarFallback>
                </Avatar>
                <h3 className="text-xl font-semibold">{isDoctor ? patient.userName : doctor.userName}</h3>
                <p className="text-muted-foreground mb-4">{isDoctor ? "Paciente" : doctor.specialty}</p>
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
              <div className="text-center">
                <Avatar className="h-32 w-32 mx-auto mb-4">
                  <AvatarImage src={isDoctor ? patient.userImage : doctor.userImage} />
                  <AvatarFallback className="bg-primary/10 text-primary text-4xl">
                    {isDoctor ? (patient.userName?.[0] || "P") : (doctor.userName?.[0] || "DR")}
                  </AvatarFallback>
                </Avatar>
                <h3 className="text-xl font-semibold">{isDoctor ? patient.userName : doctor.userName}</h3>
                <p className="text-muted-foreground">{isDoctor ? "Paciente" : doctor.specialty}</p>
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
          <div className="absolute bottom-4 right-4 w-40 h-28 bg-background rounded-lg border overflow-hidden shadow-lg">
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

          {/* Recording Indicator */}
          {isRecording && (
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-destructive/90 text-destructive-foreground px-3 py-1.5 rounded-full text-sm" data-testid="status-recording">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              Transcribiendo
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
        <div className="flex items-center justify-center gap-4 py-4">
          <Button
            variant={isMuted ? "destructive" : "outline"}
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={toggleMute}
            disabled={!hasJoinedCall || isWaiting}
            data-testid="button-mute"
          >
            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
          <Button
            variant={!isVideoEnabled ? "destructive" : "outline"}
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={toggleVideo}
            disabled={!hasJoinedCall || isWaiting}
            data-testid="button-video"
          >
            {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </Button>
          {isDoctor && (
            <Button
              variant={isRecording ? "default" : "outline"}
              size="icon"
              className="h-12 w-12 rounded-full"
              onClick={handleToggleRecording}
              data-testid="button-record"
            >
              <Activity className={`h-5 w-5 ${isRecording ? "animate-pulse" : ""}`} />
            </Button>
          )}
          <Button
            variant="destructive"
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={handleEndCall}
            disabled={!hasJoinedCall || isWaiting}
            data-testid="button-end-call"
          >
            <PhoneOff className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Sidebar - Clinical Information */}
      <div className="w-full lg:w-96 flex flex-col min-h-0">
        <Tabs defaultValue="patient" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="patient" data-testid="tab-patient">
              <User className="h-4 w-4 mr-1" />
              Paciente
            </TabsTrigger>
            <TabsTrigger value="notes" data-testid="tab-notes">
              <FileText className="h-4 w-4 mr-1" />
              Notas
            </TabsTrigger>
            <TabsTrigger value="transcript" data-testid="tab-transcript">
              <Mic className="h-4 w-4 mr-1" />
              Transcripción
            </TabsTrigger>
          </TabsList>

          <TabsContent value="patient" className="flex-1 mt-4 min-h-0">
            <Card className="h-full">
              <ScrollArea className="h-full">
                <CardContent className="p-4 space-y-4">
                  {/* Patient Info */}
                  <div className="flex items-center gap-3 pb-4 border-b" data-testid="patient-info">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={patient.userImage} />
                      <AvatarFallback className="bg-secondary/10 text-secondary">
                        {patient.userName?.[0] || "P"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold" data-testid="text-patient-name">{patient.userName}</h3>
                      <p className="text-sm text-muted-foreground" data-testid="text-patient-details">
                        {patient.gender || "No especificado"} {patient.bloodType ? `\u2022 ${patient.bloodType}` : ""}
                      </p>
                    </div>
                  </div>

                  {/* Allergies */}
                  {patient.allergies && patient.allergies.length > 0 && (
                    <div data-testid="patient-allergies">
                      <h4 className="text-sm font-medium text-destructive mb-2 flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" />
                        Alergias
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {patient.allergies.map((allergy, i) => (
                          <Badge key={i} variant="destructive" className="text-xs" data-testid={`badge-allergy-${i}`}>
                            {allergy}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Medical History */}
                  {patient.medicalHistory && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Historial Médico</h4>
                      <p className="text-sm text-muted-foreground">{patient.medicalHistory}</p>
                    </div>
                  )}

                  {/* Chief Complaint */}
                  {appointment.notes && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Motivo de Consulta</h4>
                      <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                        {appointment.notes}
                      </p>
                    </div>
                  )}
                </CardContent>
              </ScrollArea>
            </Card>
          </TabsContent>

          <TabsContent value="notes" className="flex-1 mt-4 min-h-0">
            <Card className="h-full flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Notas de Consulta</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-4 pb-4">
                <Textarea
                  placeholder="Escribe tus notas aquí..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="flex-1 min-h-[200px] resize-none"
                  data-testid="input-consultation-notes"
                />
                <Button className="w-full" data-testid="button-save-notes">
                  <Send className="h-4 w-4 mr-2" />
                  Guardar notas
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transcript" className="flex-1 mt-4 min-h-0">
            <Card className="h-full">
              <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  Transcripción
                  {isRecording && (
                    <Badge variant="outline" className="text-xs">
                      <span className="w-1.5 h-1.5 bg-destructive rounded-full mr-1 animate-pulse" />
                      En vivo
                    </Badge>
                  )}
                  {isTranscribing && (
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  )}
                </CardTitle>
              </CardHeader>
              <ScrollArea className="h-[calc(100%-4rem)]">
                <CardContent className="p-4">
                  {transcription || clinicalRecord?.transcription ? (
                    <div>
                      <p className="text-sm whitespace-pre-wrap" data-testid="text-transcription">
                        {transcription || clinicalRecord?.transcription}
                      </p>
                      {isRecording && isTranscribing && (
                        <span className="inline-block mt-1 text-xs text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin inline mr-1" />
                          Procesando audio...
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground" data-testid="transcription-empty-state">
                      <Mic className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">
                        {isRecording 
                          ? "Escuchando... la transcripción aparecerá pronto" 
                          : isDoctor
                            ? "La transcripción se inicia automáticamente al unirse a la consulta"
                            : "El médico controla la transcripción de la consulta"}
                      </p>
                    </div>
                  )}
                </CardContent>
              </ScrollArea>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
