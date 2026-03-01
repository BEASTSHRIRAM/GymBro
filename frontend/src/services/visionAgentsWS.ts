/**
 * Vision Agents WebSocket Service
 * Real-time streaming of camera frames to backend for AI pose detection + coaching
 * + Voice query support via microphone recording
 */

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.29.188:8000';
const WS_BASE_URL = API_BASE_URL.replace('http', 'ws');

export interface FrameMessage {
  type: 'frame';
  frame_base64: string;
  timestamp: number;
}

export interface VoiceQueryMessage {
  type: 'voice_query';
  audio_base64: string;
  timestamp: number;
}

export interface AnalysisResponse {
  type: 'analysis';
  rep_count: number;
  form_score: number;
  faults: string[];
  feedback: string;
  audio_base64: string;
  timestamp: number;
}

export interface VoiceResponse {
  type: 'voice_response';
  transcript: string;
  response: string;
  audio_base64: string;
}

export interface SessionStartedResponse {
  type: 'session_started';
  session_id: string;
  message: string;
  audio_base64?: string;
}

export interface SessionEndedResponse {
  type: 'session_ended';
  total_reps: number;
  avg_form_score: number;
  feedback: string;
}

export type VisionAgentsMessage =
  | AnalysisResponse
  | VoiceResponse
  | SessionStartedResponse
  | SessionEndedResponse;

class VisionAgentsWSService {
  private ws: WebSocket | null = null;
  private sessionId: string = '';
  private userId: string = '';
  private exercise: string = '';
  private onMessage: ((msg: VisionAgentsMessage) => void) | null = null;
  private onError: ((err: Error) => void) | null = null;

  connect(
    sessionId: string,
    userId: string,
    exercise: string,
    onMessage: (msg: VisionAgentsMessage) => void,
    onError: (err: Error) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.sessionId = sessionId;
      this.userId = userId;
      this.exercise = exercise;
      this.onMessage = onMessage;
      this.onError = onError;

      const wsUrl = `${WS_BASE_URL}/ws/vision-agents/${sessionId}/${userId}/${exercise}`;
      console.log('[VisionAgentsWS] Connecting to:', wsUrl);

      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('[VisionAgentsWS] Connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data) as VisionAgentsMessage;
            if (this.onMessage) {
              this.onMessage(msg);
            }
          } catch (e) {
            console.error('[VisionAgentsWS] Parse error:', e);
          }
        };

        this.ws.onerror = (event) => {
          const error = new Error('WebSocket error');
          console.error('[VisionAgentsWS] Error:', error);
          if (this.onError) {
            this.onError(error);
          }
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('[VisionAgentsWS] Disconnected');
          this.ws = null;
        };
      } catch (e) {
        reject(e);
      }
    });
  }

  sendFrame(frameBase64: string, timestamp: number = Date.now()): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[VisionAgentsWS] WebSocket not connected');
      return;
    }

    const message: FrameMessage = {
      type: 'frame',
      frame_base64: frameBase64,
      timestamp,
    };

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Send a voice query (recorded audio) to the backend for STT + AI response.
   */
  sendVoiceQuery(audioBase64: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[VisionAgentsWS] WebSocket not connected, cannot send voice query');
      return;
    }

    const message: VoiceQueryMessage = {
      type: 'voice_query',
      audio_base64: audioBase64,
      timestamp: Date.now(),
    };

    console.log(`[VisionAgentsWS] Sending voice query (${audioBase64.length} bytes)`);
    this.ws.send(JSON.stringify(message));
  }

  endSession(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      this.ws.send(JSON.stringify({ type: 'end_session' }));
    } catch (e) {
      console.error('[VisionAgentsWS] Error sending end_session:', e);
    }
  }

  disconnect(): void {
    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.close();
        }
      } catch (e) {
        console.error('[VisionAgentsWS] Error closing WebSocket:', e);
      }
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

export const visionAgentsWS = new VisionAgentsWSService();
