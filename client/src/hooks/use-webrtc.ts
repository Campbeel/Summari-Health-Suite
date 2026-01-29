import { useState, useEffect, useRef, useCallback } from 'react';

interface UseWebRTCOptions {
  roomId: string;
  userId: string;
  onRemoteStream?: (stream: MediaStream) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
}

interface SignalingMessage {
  type: string;
  from?: string;
  target?: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  participants?: string[];
  clientId?: string;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
};

export function useWebRTC({ roomId, userId, onRemoteStream, onConnectionStateChange }: UseWebRTCOptions) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);

  const wsRef = useRef<WebSocket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteParticipantRef = useRef<string | null>(null);

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

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendMessage({
          type: 'ice-candidate',
          target: targetId,
          candidate: event.candidate.toJSON()
        });
      }
    };

    // Handle remote stream
    pc.ontrack = (event) => {
      const [stream] = event.streams;
      setRemoteStream(stream);
      onRemoteStream?.(stream);
    };

    // Handle connection state
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      onConnectionStateChange?.(state);
      
      if (state === 'connected') {
        setIsConnected(true);
        setIsConnecting(false);
      } else if (state === 'disconnected' || state === 'failed') {
        setIsConnected(false);
        setIsConnecting(false);
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

  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    // First get media access
    const stream = await startMedia();
    if (!stream) return;

    // Connect to signaling server
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      sendMessage({
        type: 'join',
        roomId,
        clientId: userId
      });
    };

    ws.onmessage = (event) => {
      try {
        const message: SignalingMessage = JSON.parse(event.data);

        switch (message.type) {
          case 'room-joined':
            // If there are existing participants, initiate call to them
            if (message.participants && message.participants.length > 0) {
              initiateCall(message.participants[0]);
            }
            break;

          case 'user-joined':
            // New user joined, they will initiate the call
            break;

          case 'offer':
            if (message.from && message.sdp) {
              handleOffer(message.from, message.sdp);
            }
            break;

          case 'answer':
            if (message.sdp) {
              handleAnswer(message.sdp);
            }
            break;

          case 'ice-candidate':
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

    ws.onerror = () => {
      setError('Error de conexión con el servidor de señalización');
    };

    ws.onclose = () => {
      setIsConnected(false);
    };
  }, [roomId, userId, startMedia, sendMessage, initiateCall, handleOffer, handleAnswer, handleIceCandidate]);

  const disconnect = useCallback(() => {
    // Stop local media
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Close WebSocket
    if (wsRef.current) {
      sendMessage({ type: 'leave' });
      wsRef.current.close();
      wsRef.current = null;
    }

    setRemoteStream(null);
    setIsConnected(false);
    setIsConnecting(false);
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

  // Cleanup on unmount
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
    connect,
    disconnect,
    toggleMute,
    toggleVideo
  };
}
