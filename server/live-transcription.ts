import { speechToText } from "./replit_integrations/audio";
import type { LiveTranscriptDelta } from "@shared/models/live-assist";

interface TranscriptChunk {
  index: number;
  text: string;
  timestamp: number;
}

export class LiveTranscriptionSession {
  private appointmentId: number;
  private chunks: TranscriptChunk[] = [];
  private pendingChunks: Map<number, Promise<void>> = new Map();
  private nextExpectedIndex = 0;
  private isActive = true;
  private onDelta: (delta: LiveTranscriptDelta) => void;
  private processedIndexes: Set<number> = new Set();

  constructor(
    appointmentId: number,
    onDelta: (delta: LiveTranscriptDelta) => void
  ) {
    this.appointmentId = appointmentId;
    this.onDelta = onDelta;
  }

  async processChunk(chunkIndex: number, audioBase64: string, mimeType: string): Promise<void> {
    if (!this.isActive) return;
    if (this.processedIndexes.has(chunkIndex)) return;

    this.processedIndexes.add(chunkIndex);

    const processPromise = (async () => {
      try {
        const audioBuffer = Buffer.from(audioBase64, "base64");

        if (audioBuffer.length < 500) {
          return;
        }

        const format = mimeType.includes("webm") ? "webm" : "wav";
        const text = await speechToText(audioBuffer, format);

        if (!text || text.trim().length === 0) return;

        const chunk: TranscriptChunk = {
          index: chunkIndex,
          text: text.trim(),
          timestamp: Date.now(),
        };

        this.chunks.push(chunk);
        this.chunks.sort((a, b) => a.index - b.index);

        if (this.isActive) {
          this.onDelta({
            type: "live_transcript_delta",
            appointmentId: this.appointmentId,
            chunkIndex,
            text: chunk.text,
            cumulativeText: this.getCumulativeTranscript(),
            timestamp: chunk.timestamp,
          });
        }
      } catch (error) {
        console.error(`[LiveTranscription] Error processing chunk ${chunkIndex} for appointment ${this.appointmentId}:`, error);
      } finally {
        this.pendingChunks.delete(chunkIndex);
      }
    })();

    this.pendingChunks.set(chunkIndex, processPromise);
  }

  getCumulativeTranscript(): string {
    return this.chunks
      .sort((a, b) => a.index - b.index)
      .map(c => c.text)
      .join(" ");
  }

  getChunkCount(): number {
    return this.chunks.length;
  }

  getLastChunkTimestamp(): number {
    if (this.chunks.length === 0) return 0;
    return this.chunks[this.chunks.length - 1].timestamp;
  }

  async stop(): Promise<string> {
    this.isActive = false;
    await Promise.allSettled(Array.from(this.pendingChunks.values()));
    return this.getCumulativeTranscript();
  }

  destroy(): void {
    this.isActive = false;
    this.chunks = [];
    this.pendingChunks.clear();
    this.processedIndexes.clear();
  }
}

const activeSessions = new Map<number, LiveTranscriptionSession>();

export function createLiveTranscriptionSession(
  appointmentId: number,
  onDelta: (delta: LiveTranscriptDelta) => void
): LiveTranscriptionSession {
  const existing = activeSessions.get(appointmentId);
  if (existing) {
    existing.destroy();
  }

  const session = new LiveTranscriptionSession(appointmentId, onDelta);
  activeSessions.set(appointmentId, session);
  console.log(`[LiveTranscription] Session created for appointment ${appointmentId}`);
  return session;
}

export function getLiveTranscriptionSession(appointmentId: number): LiveTranscriptionSession | undefined {
  return activeSessions.get(appointmentId);
}

export async function stopLiveTranscriptionSession(appointmentId: number): Promise<string> {
  const session = activeSessions.get(appointmentId);
  if (!session) return "";

  const transcript = await session.stop();
  activeSessions.delete(appointmentId);
  console.log(`[LiveTranscription] Session stopped for appointment ${appointmentId}, transcript length: ${transcript.length}`);
  return transcript;
}
