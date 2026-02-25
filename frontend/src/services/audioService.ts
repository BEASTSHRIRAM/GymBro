// GymBro — Audio Service
// Plays base64-encoded MP3 TTS coaching audio via expo-audio

import { useAudioPlayer } from 'expo-audio';
import * as FileSystem from 'expo-file-system';

// Module-level player reference
let _playerRef: ReturnType<typeof useAudioPlayer> | null = null;

export async function playAudioBase64(base64Mp3: string): Promise<void> {
    if (!base64Mp3) return;

    try {
        // Write MP3 to temp file
        const uri = (FileSystem.cacheDirectory ?? '') + 'coaching_audio.mp3';
        await FileSystem.writeAsStringAsync(uri, base64Mp3, {
            encoding: FileSystem.EncodingType.Base64,
        });

        // expo-audio uses a hook-based API; for non-hook contexts use createAudioPlayer
        const { createAudioPlayer } = await import('expo-audio');
        const player = createAudioPlayer({ uri });
        player.play();
    } catch (e) {
        console.error('[Audio] Playback error:', e);
    }
}

export async function stopAudio(): Promise<void> {
    // No-op: expo-audio players are garbage collected automatically
    // If you hold a reference, call player.remove()
}
