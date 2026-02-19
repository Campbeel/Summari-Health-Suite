import { useState, useEffect, useRef, useCallback } from 'react';

interface UseWebRTCOptions {
  roomId: string;
  userId: string;
  appointmentId?: string;
  isDoctor?: boolean;
  onRemoteStream?: (stream: MediaStream) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onError?: (error: string) => void;
  onWaitingPatient?: (patientId: string, patientName: string) => void;
}

interface SignalingMessage {
  type: string;
  from?: string;
  target?: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  participants?: string[];
  clientId?: string;
  message?: string;
  patientId?: string;
  patientName?: string;
}

export interface WaitingPatient {
  id: string;
  name: string;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ],
  iceCandidatePoolSize: 10
};

export function useWebRTC({ roomId, userId, appointmentId, isDoctor, onRemoteStream, onConnectionStateChange, onError, onWaitingPatient }: UseWebRTCOptions) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isWaiting, setIsWaiting] = useState(false);
  const [isDenied, setIsDenied] = useState(false);
  const [waitingPatients, setWaitingPatients] = useState<WaitingPatient[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteParticipantRef = useRef<string | null>(null);
  const disconnectedManuallyRef = useRef(false);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const maxReconnectAttempts = 10;

  const sendMessage = useCallback((message: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const createPeerConnection = useCallback((targetId: string) => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionRef.current = pc;
    remoteParticipantRef.current = targetId;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[WebRTC] Sending ICE candidate to:', targetId);
        sendMessage({
          type: 'ice-candidate',
          target: targetId,
          candidate: event.candidate.toJSON()
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE connection state:', pc.iceConnectionState);
    };

    pc.onicegatheringstatechange = () => {
      console.log('[WebRTC] ICE gathering state:', pc.iceGatheringState);
    };

    pc.ontrack = (event) => {
      console.log('[WebRTC] Received remote track:', event.track.kind);
      const [stream] = event.streams;
      setRemoteStream(stream);
      onRemoteStream?.(stream);
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log('[WebRTC] Connection state changed to:', state);
      onConnectionStateChange?.(state);
      
      if (state === 'connected') {
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        reconnectAttemptRef.current = 0;
      } else if (state === 'disconnected') {
        console.log('[WebRTC] Peer connection disconnected, waiting before retry...');
        setTimeout(() => {
          if (pc.connectionState === 'disconnected' && remoteParticipantRef.current) {
            console.log('[WebRTC] Still disconnected, attempting to restart...');
            setIsConnected(false);
            initiateCall(remoteParticipantRef.current);
          }
        }, 3000);
      } else if (state === 'failed') {
        setIsConnected(false);
        setIsConnecting(false);
        console.log('[WebRTC] Peer connection failed, attempting to restart...');
        if (remoteParticipantRef.current) {
          initiateCall(remoteParticipantRef.current);
        }
      }
    };

    return pc;
  }, [onRemoteStream, onConnectionStateChange, sendMessage]);

  const handleOffer = useCallback(async (from: string, sdp: RTCSessionDescriptionInit) => {
    const pc = createPeerConnection(from);
    
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      sendMessage({
        type: 'answer',
        target: from,
        sdp: pc.localDescription
      });
    } catch (err) {
      console.error('Error handling offer:', err);
      setError('Error al establecer la conexión');
    }
  }, [createPeerConnection, sendMessage]);

  const handleAnswer = useCallback(async (sdp: RTCSessionDescriptionInit) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    } catch (err) {
      console.error('Error handling answer:', err);
    }
  }, []);

  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    const pc = peerConnectionRef.current;
    if (!pc) return;

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error('Error adding ICE candidate:', err);
    }
  }, []);

  const initiateCall = useCallback(async (targetId: string) => {
    setIsConnecting(true);
    const pc = createPeerConnection(targetId);

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      sendMessage({
        type: 'offer',
        target: targetId,
        sdp: pc.localDescription
      });
    } catch (err) {
      console.error('Error creating offer:', err);
      setError('Error al iniciar la llamada');
      setIsConnecting(false);
    }
  }, [createPeerConnection, sendMessage]);

  const startMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.error('Error accessing media devices:', err);
      setError('No se pudo acceder a la cámara o micrófono. Verifica los permisos.');
      return null;
    }
  }, []);

  const admitPatient = useCallback((patientId: string) => {
    sendMessage({
      type: 'admit-patient',
      patientId,
      roomId,
      appointmentId
    });
    setWaitingPatients(prev => prev.filter(p => p.id !== patientId));
  }, [sendMessage, roomId, appointmentId]);

  const denyPatient = useCallback((patientId: string) => {
    sendMessage({
      type: 'deny-patient',
      patientId,
      roomId,
      appointmentId
    });
    setWaitingPatients(prev => prev.filter(p => p.id !== patientId));
  }, [sendMessage, roomId, appointmentId]);

  const connect = useCallback(async () => {
    console.log('[WebRTC] Attempting to connect...', { roomId, userId, appointmentId });
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[WebRTC] Already connected to WebSocket');
      return;
    }

    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    if (!userId) {
      console.error('[WebRTC] No userId provided');
      setError('Debes iniciar sesión para unirte a la videollamada');
      onError?.('Debes iniciar sesión para unirte a la videollamada');
      return;
    }

    if (!appointmentId) {
      console.error('[WebRTC] No appointmentId provided');
      setError('ID de cita requerido');
      onError?.('ID de cita requerido');
      return;
    }

    setIsConnecting(true);
    setError(null);
    disconnectedManuallyRef.current = false;

    let stream = localStreamRef.current;
    if (!stream || stream.getTracks().every(t => t.readyState === 'ended')) {
      console.log('[WebRTC] Requesting media access...');
      stream = await startMedia();
      if (!stream) {
        console.error('[WebRTC] Failed to get media stream');
        setIsConnecting(false);
        return;
      }
      console.log('[WebRTC] Media access granted');
    } else {
      console.log('[WebRTC] Reusing existing media stream');
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log('[WebRTC] Connecting to WebSocket:', wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WebRTC] WebSocket connected, joining room:', roomId);
      sendMessage({
        type: 'join',
        roomId,
        userId,
        appointmentId
      });
    };
    
    ws.onerror = (event) => {
      console.error('[WebRTC] WebSocket error:', event);
      setError('Error de conexión WebSocket');
      setIsConnecting(false);
    };

    ws.onmessage = (event) => {
      try {
        const message: SignalingMessage = JSON.parse(event.data);
        console.log('[WebRTC] Received message:', message.type, message);

        switch (message.type) {
          case 'error':
            console.error('[WebRTC] Server error:', message.message);
            setError(message.message || 'Error de conexión');
            onError?.(message.message || 'Error de conexión');
            setIsConnecting(false);
            break;

          case 'room-joined':
            console.log('[WebRTC] Joined room, existing participants:', message.participants);
            setIsWaiting(false);
            reconnectAttemptRef.current = 0;
            if (message.participants && message.participants.length > 0) {
              console.log('[WebRTC] Initiating call to:', message.participants[0]);
              initiateCall(message.participants[0]);
            } else {
              console.log('[WebRTC] No participants yet, waiting for others to join');
            }
            break;

          case 'waiting-room':
            console.log('[WebRTC] Placed in waiting room');
            setIsWaiting(true);
            setIsConnecting(false);
            break;

          case 'patient-waiting': {
            const patientId = message.patientId || '';
            const patientName = message.patientName || 'Paciente';
            console.log('[WebRTC] Patient waiting for admission:', patientId, patientName);
            setWaitingPatients(prev => {
              if (prev.find(p => p.id === patientId)) return prev;
              return [...prev, { id: patientId, name: patientName }];
            });
            onWaitingPatient?.(patientId, patientName);
            break;
          }

          case 'patient-admitted':
            console.log('[WebRTC] Patient has been admitted to the room');
            setIsWaiting(false);
            setIsConnecting(true);
            break;

          case 'patient-denied':
            console.log('[WebRTC] Patient was denied entry');
            setIsWaiting(false);
            setIsDenied(true);
            disconnectedManuallyRef.current = true;
            setError('El médico no ha autorizado tu ingreso a la consulta');
            onError?.('El médico no ha autorizado tu ingreso a la consulta');
            break;

          case 'doctor-disconnected':
            console.log('[WebRTC] Doctor disconnected from the room');
            setIsWaiting(false);
            setError('El médico se ha desconectado de la consulta');
            onError?.('El médico se ha desconectado de la consulta');
            break;

          case 'patient-left-waiting': {
            const leftId = message.patientId || '';
            setWaitingPatients(prev => prev.filter(p => p.id !== leftId));
            break;
          }

          case 'user-joined':
            console.log('[WebRTC] New user joined, waiting for their offer');
            break;

          case 'offer':
            console.log('[WebRTC] Received offer from:', message.from);
            if (message.from && message.sdp) {
              handleOffer(message.from, message.sdp);
            }
            break;

          case 'answer':
            console.log('[WebRTC] Received answer');
            if (message.sdp) {
              handleAnswer(message.sdp);
            }
            break;

          case 'ice-candidate':
            console.log('[WebRTC] Received ICE candidate');
            if (message.candidate) {
              handleIceCandidate(message.candidate);
            }
            break;

          case 'user-left':
            setRemoteStream(null);
            setIsConnected(false);
            if (peerConnectionRef.current) {
              peerConnectionRef.current.close();
              peerConnectionRef.current = null;
            }
            break;
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    ws.onclose = () => {
      console.log('[WebRTC] WebSocket closed');
      if (!disconnectedManuallyRef.current && roomId && userId && appointmentId) {
        if (reconnectAttemptRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(1.5, reconnectAttemptRef.current), 10000);
          reconnectAttemptRef.current += 1;
          console.log(`[WebRTC] Reconnecting in ${delay}ms (attempt ${reconnectAttemptRef.current}/${maxReconnectAttempts})`);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          setIsConnected(false);
          setError('Se perdió la conexión. Por favor recarga la página.');
        }
      } else {
        setIsConnected(false);
      }
    };
  }, [roomId, userId, appointmentId, startMedia, sendMessage, initiateCall, handleOffer, handleAnswer, handleIceCandidate]);

  const disconnect = useCallback(() => {
    disconnectedManuallyRef.current = true;
    reconnectAttemptRef.current = 0;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (wsRef.current) {
      sendMessage({ type: 'leave' });
      wsRef.current.close();
      wsRef.current = null;
    }

    setRemoteStream(null);
    setIsConnected(false);
    setIsConnecting(false);
    setIsWaiting(false);
    setIsDenied(false);
    setWaitingPatients([]);
  }, [sendMessage]);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    localStream,
    remoteStream,
    isConnected,
    isConnecting,
    error,
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
  };
}
