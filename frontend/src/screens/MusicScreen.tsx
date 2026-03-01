import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, Alert, Linking, LayoutAnimation,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Fonts, Spacing, Radius } from '../theme';

const STORAGE_KEY = '@gymbro_music_playlists';

interface DayPlaylist {
    day: string;
    link: string;
    platform: 'spotify' | 'youtube' | 'unknown';
}

const WORKOUT_DAYS = [
    { key: 'Monday', icon: 'barbell', gradient: ['#FF6B35', '#CC4D1B'] },
    { key: 'Tuesday', icon: 'fitness', gradient: ['#3B82F6', '#1D4ED8'] },
    { key: 'Wednesday', icon: 'body', gradient: ['#22C55E', '#15803D'] },
    { key: 'Thursday', icon: 'flash', gradient: ['#F59E0B', '#B45309'] },
    { key: 'Friday', icon: 'trophy', gradient: ['#A855F7', '#7C3AED'] },
    { key: 'Saturday', icon: 'flame', gradient: ['#EF4444', '#B91C1C'] },
    { key: 'Sunday', icon: 'bed', gradient: ['#6B7280', '#4B5563'] },
];

function detectPlatform(link: string): 'spotify' | 'youtube' | 'unknown' {
    if (link.includes('spotify.com') || link.includes('spotify:')) return 'spotify';
    if (link.includes('youtube.com') || link.includes('youtu.be') || link.includes('music.youtube.com')) return 'youtube';
    return 'unknown';
}

function getPlatformIcon(platform: 'spotify' | 'youtube' | 'unknown') {
    switch (platform) {
        case 'spotify': return { name: 'musical-notes', color: '#1DB954' };
        case 'youtube': return { name: 'logo-youtube', color: '#FF0000' };
        default: return { name: 'link', color: Colors.textSecondary };
    }
}

export default function MusicScreen() {
    const [playlists, setPlaylists] = useState<DayPlaylist[]>([]);
    const [editingDay, setEditingDay] = useState<string | null>(null);
    const [linkInput, setLinkInput] = useState('');

    // Load saved playlists
    useEffect(() => {
        const load = async () => {
            try {
                const raw = await AsyncStorage.getItem(STORAGE_KEY);
                if (raw) setPlaylists(JSON.parse(raw));
            } catch { }
        };
        load();
    }, []);

    // Save playlists
    const save = useCallback(async (data: DayPlaylist[]) => {
        setPlaylists(data);
        try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { }
    }, []);

    const handleLoad = (day: string) => {
        const trimmed = linkInput.trim();
        if (!trimmed) {
            Alert.alert('Empty Link', 'Paste a Spotify or YouTube Music playlist link first.');
            return;
        }

        const platform = detectPlatform(trimmed);
        if (platform === 'unknown') {
            Alert.alert(
                'Unrecognized Link',
                'This doesn\'t look like a Spotify or YouTube Music link. Save anyway?',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Save', onPress: () => {
                            const updated = playlists.filter(p => p.day !== day);
                            updated.push({ day, link: trimmed, platform });
                            save(updated);
                            setEditingDay(null);
                            setLinkInput('');
                        }
                    },
                ]
            );
            return;
        }

        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        const updated = playlists.filter(p => p.day !== day);
        updated.push({ day, link: trimmed, platform });
        save(updated);
        setEditingDay(null);
        setLinkInput('');
    };

    const handlePlay = async (playlist: DayPlaylist) => {
        try {
            const canOpen = await Linking.canOpenURL(playlist.link);
            if (canOpen) {
                await Linking.openURL(playlist.link);
            } else {
                // Try fallback — open in browser
                await Linking.openURL(playlist.link);
            }
        } catch {
            Alert.alert('Error', 'Could not open the playlist. Make sure the app is installed.');
        }
    };

    const handleRemove = (day: string) => {
        Alert.alert('Remove Playlist', `Remove playlist for ${day}?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove', style: 'destructive', onPress: () => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    save(playlists.filter(p => p.day !== day));
                }
            },
        ]);
    };

    const getPlaylist = (day: string) => playlists.find(p => p.day === day);

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                    <Ionicons name="musical-notes" size={28} color={Colors.primary} />
                    <Text style={styles.headerTitle}>Your Music</Text>
                </View>
                <Text style={styles.headerSubtitle}>
                    Paste your Spotify or YouTube Music playlist for each workout day. Hit play when you're at the gym! 🎧
                </Text>

                {/* Day Cards */}
                {WORKOUT_DAYS.map((day) => {
                    const playlist = getPlaylist(day.key);
                    const isEditing = editingDay === day.key;
                    const platformInfo = playlist ? getPlatformIcon(playlist.platform) : null;

                    return (
                        <View key={day.key} style={styles.dayCard}>
                            <LinearGradient
                                colors={day.gradient as [string, string]}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                style={styles.dayHeader}
                            >
                                <View style={styles.dayHeaderLeft}>
                                    <Ionicons name={day.icon as any} size={20} color="#fff" />
                                    <Text style={styles.dayName}>{day.key}</Text>
                                </View>

                                {playlist && !isEditing && (
                                    <View style={styles.dayHeaderRight}>
                                        <Ionicons name={platformInfo!.name as any} size={18} color={platformInfo!.color} />
                                        <TouchableOpacity
                                            style={styles.playBtn}
                                            onPress={() => handlePlay(playlist)}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons name="play" size={16} color="#fff" />
                                            <Text style={styles.playBtnText}>Play</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </LinearGradient>

                            <View style={styles.dayBody}>
                                {isEditing ? (
                                    <View style={styles.editArea}>
                                        <TextInput
                                            style={styles.linkInput}
                                            placeholder="Paste Spotify or YouTube Music link..."
                                            placeholderTextColor={Colors.textMuted}
                                            value={linkInput}
                                            onChangeText={setLinkInput}
                                            autoCapitalize="none"
                                            autoCorrect={false}
                                            selectTextOnFocus
                                        />
                                        <View style={styles.editBtns}>
                                            <TouchableOpacity
                                                style={styles.loadBtn}
                                                onPress={() => handleLoad(day.key)}
                                                activeOpacity={0.7}
                                            >
                                                <Ionicons name="cloud-download" size={16} color="#fff" />
                                                <Text style={styles.loadBtnText}>Load</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.cancelBtn}
                                                onPress={() => { setEditingDay(null); setLinkInput(''); }}
                                                activeOpacity={0.7}
                                            >
                                                <Text style={styles.cancelBtnText}>Cancel</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ) : playlist ? (
                                    <View style={styles.savedRow}>
                                        <Text style={styles.savedLink} numberOfLines={1}>{playlist.link}</Text>
                                        <View style={styles.savedActions}>
                                            <TouchableOpacity onPress={() => {
                                                setEditingDay(day.key);
                                                setLinkInput(playlist.link);
                                            }}>
                                                <Ionicons name="create-outline" size={20} color={Colors.textSecondary} />
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => handleRemove(day.key)}>
                                                <Ionicons name="trash-outline" size={20} color={Colors.error} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        style={styles.addBtn}
                                        onPress={() => { setEditingDay(day.key); setLinkInput(''); }}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
                                        <Text style={styles.addBtnText}>Add Playlist</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    );
                })}

                {/* Tips */}
                <View style={styles.tipsCard}>
                    <Text style={styles.tipsTitle}>💡 How it works</Text>
                    <Text style={styles.tipsText}>
                        1. Open Spotify or YouTube Music{'\n'}
                        2. Go to your playlist → Share → Copy Link{'\n'}
                        3. Paste it here for the workout day{'\n'}
                        4. When you're at the gym, tap Play → opens directly in the app!
                    </Text>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg },
    scrollContent: { padding: Spacing.md, paddingTop: 60 },

    // Header
    header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
    headerTitle: { color: Colors.textPrimary, fontSize: Fonts.sizes.xxl, fontWeight: '700' },
    headerSubtitle: { color: Colors.textSecondary, fontSize: Fonts.sizes.sm, lineHeight: 20, marginBottom: Spacing.lg },

    // Day cards
    dayCard: { marginBottom: Spacing.sm, borderRadius: Radius.md, overflow: 'hidden', backgroundColor: Colors.card },
    dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md },
    dayHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    dayHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    dayName: { color: '#fff', fontSize: Fonts.sizes.md, fontWeight: '600' },

    playBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    },
    playBtnText: { color: '#fff', fontSize: Fonts.sizes.sm, fontWeight: '600' },

    dayBody: { padding: Spacing.sm },

    // Edit area
    editArea: { gap: 8 },
    linkInput: {
        backgroundColor: Colors.surface, borderRadius: Radius.sm, paddingHorizontal: 12, paddingVertical: 10,
        color: Colors.textPrimary, fontSize: Fonts.sizes.sm, borderWidth: 1, borderColor: Colors.border,
    },
    editBtns: { flexDirection: 'row', gap: 8 },
    loadBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.sm,
    },
    loadBtnText: { color: '#fff', fontSize: Fonts.sizes.sm, fontWeight: '600' },
    cancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.sm, backgroundColor: Colors.surface },
    cancelBtnText: { color: Colors.textSecondary, fontSize: Fonts.sizes.sm },

    // Saved
    savedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
    savedLink: { color: Colors.textSecondary, fontSize: Fonts.sizes.xs, flex: 1, marginRight: 8 },
    savedActions: { flexDirection: 'row', gap: 12 },

    // Add
    addBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
    addBtnText: { color: Colors.primary, fontSize: Fonts.sizes.sm, fontWeight: '500' },

    // Tips
    tipsCard: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: Spacing.md, marginTop: Spacing.md },
    tipsTitle: { color: Colors.primary, fontSize: Fonts.sizes.md, fontWeight: '600', marginBottom: 8 },
    tipsText: { color: Colors.textSecondary, fontSize: Fonts.sizes.sm, lineHeight: 22 },
});
