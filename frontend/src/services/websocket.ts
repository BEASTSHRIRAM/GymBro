// GymBro — WebSocket Service
// Manages real-time connection to /ws/form-check WebSocket endpoint

const BASE_WS_URL = process.env.EXPO_PUBLIC_API_URL?.replace('http', 'ws') ?? 'ws://localhost:8000';

type MessageHandler = (data: FormAnalysisResult) => void;
type ErrorHandler = (error: string) => void;

export interface FormAnalysisResult {
    rep_count: number;
    form_score: number;
    faults: string[];
    joint_angles: Record<string, number>;
    feedback: string;
    audio: string; // base64 MP3 or ""
}

class FormCheckerSocket {
    private ws: WebSocket | null = null;
    private sessionId: string = '';
    private onMessage: MessageHandler | null = null;
    private onError: ErrorHandler | null = null;

    connect(
        sessionId: string,
        userId: string,
        exercise: string,
        onMessage: MessageHandler,
        onError: ErrorHandler
    ): void {
        this.sessionId = sessionId;
        this.onMessage = onMessage;
        this.onError = onError;

        const url = `${BASE_WS_URL}/ws/form-check/${sessionId}?user_id=${userId}&exercise=${encodeURIComponent(exercise)}`;
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            console.log('[WS] Form checker connected:', sessionId);
        };

        this.ws.onmessage = (event) => {
            try {
                const data: FormAnalysisResult = JSON.parse(event.data);
                this.onMessage?.(data);
            } catch (e) {
                console.error('[WS] Parse error:', e);
            }
        };

        this.ws.onerror = (e) => {
            console.error('[WS] Error:', e);
            this.onError?.('WebSocket connection error');
        };

        this.ws.onclose = () => {
            console.log('[WS] Session closed:', sessionId);
        };
    }

    sendFrame(frameB64: string, exercise: string, voiceEnabled: boolean): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(
                JSON.stringify({ frame: frameB64, exercise, voice: voiceEnabled })
            );
        }
    }

    disconnect(): void {
        this.ws?.close();
        this.ws = null;
    }

    isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }
}

// Singleton
export const formCheckerSocket = new FormCheckerSocket();
export default formCheckerSocket;
