// GymBro — Voice Service (Continuous Listening Mode)
// Continuously records audio in rolling segments and sends to backend for STT.
// When training starts, the mic is always on — like a real conversation.
import { Audio } from 'expo-av';
import { Paths, File } from 'expo-file-system';

let _recording: Audio.Recording | null = null;
let _isListening = false;
let _listeningInterval: NodeJS.Timeout | null = null;

// Callback to handle each recorded audio segment
type OnAudioSegment = (base64Audio: string) => void;

/**
 * Request microphone permission.
 */
export async function requestMicrophonePermission(): Promise<boolean> {
    try {
        const { granted } = await Audio.requestPermissionsAsync();
        return granted;
    } catch (e) {
        console.error('[Voice] Permission error:', e);
        return false;
    }
}

/**
 * Start a single recording segment.
 */
async function startSegment(): Promise<void> {
    try {
        await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
        });

        const { recording } = await Audio.Recording.createAsync(
            Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        _recording = recording;
    } catch (e) {
        console.error('[Voice] Start segment error:', e);
    }
}

/**
 * Stop the current segment and return base64 audio.
 */
async function stopSegment(): Promise<string | null> {
    if (!_recording) return null;

    try {
        await _recording.stopAndUnloadAsync();

        const uri = _recording.getURI();
        _recording = null;

        if (!uri) return null;

        // Read recorded file as base64
        const recordedFile = new File(uri);
        const arrayBuffer = await recordedFile.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);

        let binaryString = '';
        for (let i = 0; i < bytes.length; i++) {
            binaryString += String.fromCharCode(bytes[i]);
        }
        const base64Audio = btoa(binaryString);

        // Clean up temp file
        try { recordedFile.delete(); } catch { /* ignore */ }

        return base64Audio;
    } catch (e) {
        console.error('[Voice] Stop segment error:', e);
        _recording = null;
        return null;
    }
}

/**
 * Start continuous listening. Records in rolling ~4-second segments.
 * Each segment is sent via the onSegment callback for STT processing.
 * Call this when training starts.
 */
export async function startContinuousListening(
    onSegment: OnAudioSegment,
    segmentDurationMs: number = 4000
): Promise<boolean> {
    if (_isListening) {
        console.warn('[Voice] Already listening');
        return false;
    }

    const hasPermission = await requestMicrophonePermission();
    if (!hasPermission) {
        console.error('[Voice] Microphone permission denied');
        return false;
    }

    _isListening = true;
    console.log('[Voice] Continuous listening started');

    // Start first segment
    await startSegment();

    // Every segmentDurationMs, stop current segment → send it → start new one
    _listeningInterval = setInterval(async () => {
        if (!_isListening) return;

        try {
            // Stop current segment and get audio
            const audioBase64 = await stopSegment();

            // Immediately start next segment (minimize gap)
            if (_isListening) {
                await startSegment();
            }

            // Send the completed segment for processing
            if (audioBase64 && audioBase64.length > 1000) {
                // Only send if there's meaningful audio (>1KB, not just silence header)
                onSegment(audioBase64);
            }
        } catch (e) {
            console.error('[Voice] Segment cycle error:', e);
            // Try to restart recording
            if (_isListening) {
                try { await startSegment(); } catch { /* ignore */ }
            }
        }
    }, segmentDurationMs);

    return true;
}

/**
 * Stop continuous listening. Call this when training ends.
 */
export async function stopContinuousListening(): Promise<void> {
    _isListening = false;

    if (_listeningInterval) {
        clearInterval(_listeningInterval);
        _listeningInterval = null;
    }

    if (_recording) {
        try {
            await _recording.stopAndUnloadAsync();
        } catch { /* already stopped */ }
        _recording = null;
    }

    // Reset audio mode for playback
    await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
    }).catch(() => { });

    console.log('[Voice] Continuous listening stopped');
}

/**
 * Check if currently listening.
 */
export function isListening(): boolean {
    return _isListening;
}
