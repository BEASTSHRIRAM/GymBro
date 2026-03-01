// GymBro — Audio Service
// Plays base64-encoded MP3 TTS coaching audio via expo-av Audio.Sound
import { Audio } from 'expo-av';
import { Paths, File } from 'expo-file-system';

// Track current sound for cleanup
let _currentSound: Audio.Sound | null = null;
let _isPlaying = false;

/**
 * Configure audio mode for playback during training.
 * Call once at session start.
 */
export async function configureAudioPlayback(): Promise<void> {
    try {
        await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: true,
        });
        console.log('[Audio] Playback mode configured');
    } catch (e) {
        console.error('[Audio] Failed to configure audio mode:', e);
    }
}

/**
 * Play base64-encoded MP3 audio (from ElevenLabs TTS).
 * Writes to a temp file and plays via expo-av Audio.Sound.
 */
export async function playAudioBase64(base64Mp3: string): Promise<void> {
    if (!base64Mp3) return;

    try {
        // Stop any currently playing audio first
        await stopAudio();

        // Write base64 MP3 to a temp file using new expo-file-system API
        const file = new File(Paths.cache, `coaching_audio_${Date.now()}.mp3`);

        // Decode base64 to Uint8Array and write
        const binaryString = atob(base64Mp3);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        file.write(bytes);

        // Create and play the sound
        const { sound } = await Audio.Sound.createAsync(
            { uri: file.uri },
            { shouldPlay: true, volume: 1.0 }
        );

        _currentSound = sound;
        _isPlaying = true;

        console.log('[Audio] Playing coaching audio');

        // Listen for playback completion to cleanup
        sound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && status.didJustFinish) {
                _isPlaying = false;
                sound.unloadAsync().catch(() => { });
                _currentSound = null;
                // Clean up temp file
                try { file.delete(); } catch { /* ignore */ }
                console.log('[Audio] Playback finished');
            }
        });
    } catch (e) {
        _isPlaying = false;
        console.error('[Audio] Playback error:', e);
    }
}

/**
 * Stop any currently playing audio.
 */
export async function stopAudio(): Promise<void> {
    if (_currentSound) {
        try {
            await _currentSound.stopAsync();
            await _currentSound.unloadAsync();
        } catch {
            // Sound may already be unloaded
        }
        _currentSound = null;
        _isPlaying = false;
    }
}

/**
 * Check if audio is currently playing.
 */
export function isAudioPlaying(): boolean {
    return _isPlaying;
}
