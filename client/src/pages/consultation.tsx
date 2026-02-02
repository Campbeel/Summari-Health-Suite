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
import { useWebRTC } from "@/hooks/use-webrtc";
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
  Phone
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

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const transcriptionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const { data: consultation, isLoading } = useQuery<ConsultationData>({
    queryKey: ["/api/consultations", id],
  });

  const roomId = `consultation-${id}`;
  const userId = user?.id || '';

  const {
    localStream,
    remoteStream,
    isConnected,
    isConnecting,
    error: webrtcError,
    isMuted,
    isVideoEnabled,
    connect,
    disconnect,
    toggleMute,
    toggleVideo
  } = useWebRTC({
    roomId,
    userId,
    appointmentId: id,
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
    }
  });

  // Attach local stream to video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Attach remote stream to video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Show WebRTC errors
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
    disconnect();
    setHasJoinedCall(false);
    endConsultationMutation.mutate();
  };

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (transcriptionIntervalRef.current) {
        clearInterval(transcriptionIntervalRef.current);
      }
    };
  }, []);

  const endConsultationMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/consultations/${id}/end`, {
        transcription,
        notes,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      toast({
        title: "Consulta finalizada",
        description: "El registro clínico ha sido guardado",
      });
      navigate("/appointments");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo finalizar la consulta",
        variant: "destructive",
      });
    },
  });

  const transcribeAudio = useCallback(async (audioBlob: Blob) => {
    try {
      setIsTranscribing(true);
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1];
        try {
          const response = await apiRequest("POST", "/api/transcribe", {
            audioData: base64Audio,
          });
          const data = await response.json();
          if (data.transcript) {
            setTranscription(prev => prev + (prev ? " " : "") + data.transcript);
          }
        } catch (error) {
          console.error("Transcription error:", error);
        } finally {
          setIsTranscribing(false);
        }
      };
    } catch (error) {
      console.error("Error preparing audio for transcription:", error);
      setIsTranscribing(false);
    }
  }, []);

  const startRecording = useCallback(() => {
    if (!localStream) {
      toast({
        title: "Error",
        description: "Debes unirte a la llamada primero",
        variant: "destructive",
      });
      return;
    }

    try {
      const audioTracks = localStream.getAudioTracks();
      if (audioTracks.length === 0) {
        toast({
          title: "Error",
          description: "No se encontró micrófono activo",
          variant: "destructive",
        });
        return;
      }

      const audioStream = new MediaStream(audioTracks);
      const mediaRecorder = new MediaRecorder(audioStream, {
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

      transcriptionIntervalRef.current = setInterval(() => {
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          audioChunksRef.current = [];
          transcribeAudio(audioBlob);
        }
      }, 10000);

      toast({
        title: "Transcripción iniciada",
        description: "La consulta está siendo transcrita automáticamente",
      });
    } catch (error) {
      console.error("Error starting recording:", error);
      toast({
        title: "Error",
        description: "No se pudo iniciar la transcripción",
        variant: "destructive",
      });
    }
  }, [localStream, toast, transcribeAudio]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (transcriptionIntervalRef.current) {
      clearInterval(transcriptionIntervalRef.current);
      transcriptionIntervalRef.current = null;
    }
    
    if (audioChunksRef.current.length > 0) {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      audioChunksRef.current = [];
      transcribeAudio(audioBlob);
    }
    
    setIsRecording(false);
  }, [transcribeAudio]);

  const handleToggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

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
          <Button onClick={() => navigate("/appointments")}>Volver a consultas</Button>
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
          {/* Remote Video (Main) or Waiting State */}
          {!hasJoinedCall ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Avatar className="h-32 w-32 mx-auto mb-4">
                  <AvatarImage src={doctor.userImage} />
                  <AvatarFallback className="bg-primary/10 text-primary text-4xl">
                    {doctor.userName?.[0] || "DR"}
                  </AvatarFallback>
                </Avatar>
                <h3 className="text-xl font-semibold">{doctor.userName}</h3>
                <p className="text-muted-foreground mb-4">{doctor.specialty}</p>
                <Button 
                  size="lg" 
                  onClick={handleJoinCall}
                  data-testid="button-join-call"
                >
                  <Phone className="h-5 w-5 mr-2" />
                  Unirse a la videollamada
                </Button>
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
                  <AvatarImage src={doctor.userImage} />
                  <AvatarFallback className="bg-primary/10 text-primary text-4xl">
                    {doctor.userName?.[0] || "DR"}
                  </AvatarFallback>
                </Avatar>
                <h3 className="text-xl font-semibold">{doctor.userName}</h3>
                <p className="text-muted-foreground">{doctor.specialty}</p>
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
          {hasJoinedCall && (
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
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 py-4">
          <Button
            variant={isMuted ? "destructive" : "outline"}
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={toggleMute}
            disabled={!hasJoinedCall}
            data-testid="button-mute"
          >
            {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </Button>
          <Button
            variant={!isVideoEnabled ? "destructive" : "outline"}
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={toggleVideo}
            disabled={!hasJoinedCall}
            data-testid="button-video"
          >
            {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </Button>
          <Button
            variant={isRecording ? "default" : "outline"}
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={handleToggleRecording}
            data-testid="button-record"
          >
            <Activity className={`h-5 w-5 ${isRecording ? "animate-pulse" : ""}`} />
          </Button>
          <Button
            variant="destructive"
            size="icon"
            className="h-12 w-12 rounded-full"
            onClick={handleEndCall}
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
                        {patient.gender || "No especificado"} • {patient.bloodType || "Tipo de sangre no especificado"}
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
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  Transcripción
                  {isRecording && (
                    <Badge variant="outline" className="text-xs">
                      <span className="w-1.5 h-1.5 bg-destructive rounded-full mr-1 animate-pulse" />
                      En vivo
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <ScrollArea className="h-[calc(100%-4rem)]">
                <CardContent className="p-4">
                  {transcription || clinicalRecord?.transcription ? (
                    <p className="text-sm whitespace-pre-wrap" data-testid="text-transcription">
                      {transcription || clinicalRecord?.transcription}
                    </p>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground" data-testid="transcription-empty-state">
                      <Mic className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">
                        {isRecording 
                          ? "Escuchando..." 
                          : "Inicia la transcripción para capturar la consulta"}
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
