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
  onChatMessage?: (message: any) => void;
  onDoctorDisconnected?: () => void;
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

export function useWebRTC({ roomId, userId, appointmentId, isDoctor, onRemoteStream, onConnectionStateChange, onError, onWaitingPatient, onChatMessage, onDoctorDisconnected }: UseWebRTCOptions) {
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
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const onRemoteStreamRef = useRef(onRemoteStream);
  const onConnectionStateChangeRef = useRef(onConnectionStateChange);
  const onErrorRef = useRef(onError);
  const onWaitingPatientRef = useRef(onWaitingPatient);
  const onDoctorDisconnectedRef = useRef(onDoctorDisconnected);
  const onChatMessageRef = useRef(onChatMessage);

  useEffect(() => { onRemoteStreamRef.current = onRemoteStream; }, [onRemoteStream]);
  useEffect(() => { onConnectionStateChangeRef.current = onConnectionStateChange; }, [onConnectionStateChange]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  useEffect(() => { onWaitingPatientRef.current = onWaitingPatient; }, [onWaitingPatient]);
  useEffect(() => { onDoctorDisconnectedRef.current = onDoctorDisconnected; }, [onDoctorDisconnected]);
  useEffect(() => { onChatMessageRef.current = onChatMessage; }, [onChatMessage]);

  const sendMessage = useCallback((message: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const flushPendingIceCandidates = useCallback(async (pc: RTCPeerConnection) => {
    const pending = pendingIceCandidatesRef.current;
    pendingIceCandidatesRef.current = [];
    for (const candidate of pending) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('[WebRTC] Flushed queued ICE candidate');
      } catch (err) {
        console.error('[WebRTC] Error adding queued ICE candidate:', err);
      }
    }
  }, []);

  const cleanupPeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.onconnectionstatechange = null;
      peerConnectionRef.current.oniceconnectionstatechange = null;
      peerConnectionRef.current.onicegatheringstatechange = null;
      try { peerConnectionRef.current.close(); } catch {}
      peerConnectionRef.current = null;
    }
    pendingIceCandidatesRef.current = [];
  }, []);

  const createPeerConnection = useCallback((targetId: string) => {
    cleanupPeerConnection();

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
      onRemoteStreamRef.current?.(stream);
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log('[WebRTC] Connection state changed to:', state);
      onConnectionStateChangeRef.current?.(state);

      if (state === 'connected') {
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        reconnectAttemptRef.current = 0;
      } else if (state === 'disconnected') {
        console.log('[WebRTC] Peer disconnected, waiting 5s before considering failed...');
        setTimeout(() => {
          if (peerConnectionRef.current === pc && pc.connectionState === 'disconnected') {
            console.log('[WebRTC] Still disconnected after timeout');
            setIsConnected(false);
          }
        }, 5000);
      } else if (state === 'failed') {
        setIsConnected(false);
        setIsConnecting(false);
        console.log('[WebRTC] Peer connection failed');
        setError('La conexión falló. Intenta reconectarte.');
      }
    };

    return pc;
  }, [cleanupPeerConnection, sendMessage]);

  const initiateCall = useCallback(async (targetId: string) => {
    setIsConnecting(true);
    const pc = createPeerConnection(targetId);

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await pc.setLocalDescription(offer);

      sendMessage({
        type: 'offer',
        target: targetId,
        sdp: pc.localDescription
      });
      console.log('[WebRTC] Offer sent to:', targetId);
    } catch (err) {
      console.error('[WebRTC] Error creating offer:', err);
      setError('Error al iniciar la llamada');
      setIsConnecting(false);
    }
  }, [createPeerConnection, sendMessage]);

  const handleOffer = useCallback(async (from: string, sdp: RTCSessionDescriptionInit) => {
    console.log('[WebRTC] Handling offer from:', from);
    const pc = createPeerConnection(from);

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await flushPendingIceCandidates(pc);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      sendMessage({
        type: 'answer',
        target: from,
        sdp: pc.localDescription
      });
      console.log('[WebRTC] Answer sent to:', from);
    } catch (err) {
      console.error('[WebRTC] Error handling offer:', err);
      setError('Error al establecer la conexión');
    }
  }, [createPeerConnection, sendMessage, flushPendingIceCandidates]);

  const handleAnswer = useCallback(async (sdp: RTCSessionDescriptionInit) => {
    const pc = peerConnectionRef.current;
    if (!pc) {
      console.warn('[WebRTC] No peer connection for answer');
      return;
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      console.log('[WebRTC] Remote description set from answer');
      await flushPendingIceCandidates(pc);
    } catch (err) {
      console.error('[WebRTC] Error handling answer:', err);
    }
  }, [flushPendingIceCandidates]);

  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    const pc = peerConnectionRef.current;
    if (!pc) {
      console.log('[WebRTC] Queuing ICE candidate (no peer connection yet)');
      pendingIceCandidatesRef.current.push(candidate);
      return;
    }

    if (!pc.remoteDescription) {
      console.log('[WebRTC] Queuing ICE candidate (remote description not set yet)');
      pendingIceCandidatesRef.current.push(candidate);
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error('[WebRTC] Error adding ICE candidate:', err);
    }
  }, []);

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
      console.error('[WebRTC] Error accessing media devices:', err);
      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true
        });
        localStreamRef.current = audioOnly;
        setLocalStream(audioOnly);
        setIsVideoEnabled(false);
        return audioOnly;
      } catch (audioErr) {
        console.error('[WebRTC] Error accessing audio:', audioErr);
        setError('No se pudo acceder a la cámara o micrófono. Verifica los permisos.');
        return null;
      }
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

  const startPingInterval = useCallback(() => {
    if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    pingIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25000);
  }, []);

  const stopPingInterval = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  const initiateCallRef = useRef(initiateCall);
  const handleOfferRef = useRef(handleOffer);
  const handleAnswerRef = useRef(handleAnswer);
  const handleIceCandidateRef = useRef(handleIceCandidate);

  useEffect(() => { initiateCallRef.current = initiateCall; }, [initiateCall]);
  useEffect(() => { handleOfferRef.current = handleOffer; }, [handleOffer]);
  useEffect(() => { handleAnswerRef.current = handleAnswer; }, [handleAnswer]);
  useEffect(() => { handleIceCandidateRef.current = handleIceCandidate; }, [handleIceCandidate]);

  const connectRef = useRef<() => Promise<void>>();

  const connect = useCallback(async () => {
    console.log('[WebRTC] Attempting to connect...', { roomId, userId, appointmentId });

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[WebRTC] Already connected to WebSocket');
      return;
    }

    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    if (!userId) {
      console.error('[WebRTC] No userId provided');
      setError('Debes iniciar sesión para unirte a la videollamada');
      onErrorRef.current?.('Debes iniciar sesión para unirte a la videollamada');
      return;
    }

    if (!appointmentId) {
      console.error('[WebRTC] No appointmentId provided');
      setError('ID de cita requerido');
      onErrorRef.current?.('ID de cita requerido');
      return;
    }

    setIsConnecting(true);
    setError(null);
    disconnectedManuallyRef.current = false;
    pendingIceCandidatesRef.current = [];

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
      ws.send(JSON.stringify({
        type: 'join',
        roomId,
        userId,
        appointmentId
      }));
      startPingInterval();
    };

    ws.onerror = (event) => {
      console.error('[WebRTC] WebSocket error:', event);
    };

    ws.onmessage = (event) => {
      try {
        const message: SignalingMessage = JSON.parse(event.data);

        if (message.type === 'pong') return;

        console.log('[WebRTC] Received message:', message.type);

        switch (message.type) {
          case 'error':
            console.error('[WebRTC] Server error:', message.message);
            setError(message.message || 'Error de conexión');
            onErrorRef.current?.(message.message || 'Error de conexión');
            setIsConnecting(false);
            break;

          case 'room-joined':
            console.log('[WebRTC] Joined room, existing participants:', message.participants);
            setIsWaiting(false);
            reconnectAttemptRef.current = 0;
            if (message.participants && message.participants.length > 0) {
              const targetPeer = message.participants[0];
              console.log('[WebRTC] Initiating call to:', targetPeer);
              setTimeout(() => {
                initiateCallRef.current(targetPeer);
              }, 100);
            } else {
              console.log('[WebRTC] No participants yet, waiting for others to join');
              setIsConnecting(false);
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
            console.log('[WebRTC] Patient waiting:', patientId, patientName);
            setWaitingPatients(prev => {
              if (prev.find(p => p.id === patientId)) return prev;
              return [...prev, { id: patientId, name: patientName }];
            });
            onWaitingPatientRef.current?.(patientId, patientName);
            break;
          }

          case 'patient-admitted':
            console.log('[WebRTC] Patient has been admitted');
            setIsWaiting(false);
            setIsConnecting(true);
            break;

          case 'patient-denied':
            console.log('[WebRTC] Patient was denied entry');
            setIsWaiting(false);
            setIsDenied(true);
            disconnectedManuallyRef.current = true;
            setError('El médico no ha autorizado tu ingreso a la consulta');
            onErrorRef.current?.('El médico no ha autorizado tu ingreso a la consulta');
            break;

          case 'doctor-disconnected':
            console.log('[WebRTC] Doctor disconnected');
            setIsWaiting(false);
            setError('El médico se ha desconectado de la consulta');
            onErrorRef.current?.('El médico se ha desconectado de la consulta');
            onDoctorDisconnectedRef.current?.();
            break;

          case 'patient-left-waiting': {
            const leftId = message.patientId || '';
            setWaitingPatients(prev => prev.filter(p => p.id !== leftId));
            break;
          }

          case 'user-joined':
            console.log('[WebRTC] New user joined room');
            break;

          case 'offer':
            if (message.from && message.sdp) {
              console.log('[WebRTC] Received offer from:', message.from);
              handleOfferRef.current(message.from, message.sdp);
            }
            break;

          case 'answer':
            if (message.sdp) {
              console.log('[WebRTC] Received answer');
              handleAnswerRef.current(message.sdp);
            }
            break;

          case 'ice-candidate':
            if (message.candidate) {
              handleIceCandidateRef.current(message.candidate);
            }
            break;

          case 'user-left':
            console.log('[WebRTC] User left room');
            setRemoteStream(null);
            setIsConnected(false);
            cleanupPeerConnection();
            break;

          case 'chat-message':
            if (message.message) {
              onChatMessageRef.current?.(message.message);
            }
            break;
        }
      } catch (err) {
        console.error('[WebRTC] Error parsing message:', err);
      }
    };

    ws.onclose = (event) => {
      console.log('[WebRTC] WebSocket closed, code:', event.code, 'reason:', event.reason);
      stopPingInterval();

      if (!disconnectedManuallyRef.current && roomId && userId && appointmentId) {
        if (reconnectAttemptRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(1.5, reconnectAttemptRef.current), 10000);
          reconnectAttemptRef.current += 1;
          console.log(`[WebRTC] Reconnecting in ${delay}ms (attempt ${reconnectAttemptRef.current}/${maxReconnectAttempts})`);
          reconnectTimeoutRef.current = setTimeout(() => {
            connectRef.current?.();
          }, delay);
        } else {
          setIsConnected(false);
          setIsConnecting(false);
          setError('Se perdió la conexión. Por favor recarga la página.');
        }
      } else {
        setIsConnected(false);
        setIsConnecting(false);
      }
    };
  }, [roomId, userId, appointmentId, startMedia, sendMessage, cleanupPeerConnection, startPingInterval, stopPingInterval]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const disconnect = useCallback(() => {
    disconnectedManuallyRef.current = true;
    reconnectAttemptRef.current = 0;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    stopPingInterval();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }

    cleanupPeerConnection();

    if (wsRef.current) {
      sendMessage({ type: 'leave' });
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    setRemoteStream(null);
    setIsConnected(false);
    setIsConnecting(false);
    setIsWaiting(false);
    setIsDenied(false);
    setWaitingPatients([]);
  }, [sendMessage, cleanupPeerConnection, stopPingInterval]);

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
