// GymBro — Coaches Screen
import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';
import { Colors, Spacing, Radius, Fonts } from '../theme';

interface Coach {
    id: string;
    name: string;
    gym_name: string;
    rating: number;
    review_count: number;
    price_per_session: number;
    specialties: string[];
    distance_km?: number;
}

export default function CoachesScreen() {
    const [coaches, setCoaches] = useState<Coach[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [lat, setLat] = useState('19.0760');   // Mumbai default
    const [lng, setLng] = useState('72.8777');
    const [radius, setRadius] = useState('10');
    const [bookingCoach, setBookingCoach] = useState<Coach | null>(null);
    const [bookingDate, setBookingDate] = useState('');

    useEffect(() => { fetchCoaches(); }, []);

    const fetchCoaches = async () => {
        setIsLoading(true);
        try {
            const { data } = await api.get('/coaches/nearby', {
                params: { lat: parseFloat(lat), lng: parseFloat(lng), radius_km: parseFloat(radius) },
            });
            setCoaches(data.coaches ?? []);
        } catch {
            // No coaches in DB yet — show empty state
            setCoaches([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleBook = async () => {
        if (!bookingDate || !bookingCoach) return;
        try {
            const { data } = await api.post('/coaches/book', {
                coach_id: bookingCoach.id,
                date: bookingDate,
                duration_min: 60,
            });
            Alert.alert('Booking Requested', `Booking ID: ${data.booking_id}\n\nPayment integration coming soon.`);
            setBookingCoach(null);
            setBookingDate('');
        } catch (e: any) {
            Alert.alert('Error', e.response?.data?.detail ?? 'Booking failed');
        }
    };

    const StarRating = ({ rating }: { rating: number }) => (
        <View style={st.stars}>
            {[1, 2, 3, 4, 5].map((s) => (
                <Ionicons
                    key={s}
                    name={rating >= s ? 'star' : 'star-outline'}
                    size={12}
                    color={Colors.warning}
                />
            ))}
            <Text style={st.ratingText}>{rating.toFixed(1)}</Text>
        </View>
    );

    return (
        <View style={st.container}>
            <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
                <View style={st.header}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                        <Ionicons name="location-outline" size={28} color={Colors.textPrimary} style={{ marginRight: 8 }} />
                        <Text style={st.title}>Find Coaches</Text>
                    </View>
                </View>

                {/* Search Bar */}
                <View style={st.searchCard}>
                    <View style={st.searchRow}>
                        <View style={[st.input, { flex: 1, marginRight: 6 }]}>
                            <TextInput
                                style={st.inputText}
                                placeholder="Latitude"
                                placeholderTextColor={Colors.textMuted}
                                keyboardType="decimal-pad"
                                value={lat}
                                onChangeText={setLat}
                            />
                        </View>
                        <View style={[st.input, { flex: 1, marginRight: 6 }]}>
                            <TextInput
                                style={st.inputText}
                                placeholder="Longitude"
                                placeholderTextColor={Colors.textMuted}
                                keyboardType="decimal-pad"
                                value={lng}
                                onChangeText={setLng}
                            />
                        </View>
                        <View style={[st.input, { width: 60 }]}>
                            <TextInput
                                style={st.inputText}
                                placeholder="km"
                                placeholderTextColor={Colors.textMuted}
                                keyboardType="number-pad"
                                value={radius}
                                onChangeText={setRadius}
                            />
                        </View>
                    </View>
                    <TouchableOpacity style={st.searchBtn} onPress={fetchCoaches}>
                        <Ionicons name="search" size={16} color="#fff" />
                        <Text style={st.searchBtnText}>Search</Text>
                    </TouchableOpacity>
                </View>

                {/* Loading */}
                {isLoading && (
                    <View style={{ alignItems: 'center', padding: 40 }}>
                        <ActivityIndicator color={Colors.primary} size="large" />
                    </View>
                )}

                {/* Empty State */}
                {!isLoading && coaches.length === 0 && (
                    <View style={st.emptyCard}>
                        <Ionicons name="people-outline" size={40} color={Colors.textMuted} style={{ marginBottom: 16 }} />
                        <Text style={st.emptyTitle}>No coaches yet</Text>
                        <Text style={st.emptySub}>Be the first coach to register in this area!</Text>
                    </View>
                )}

                {/* Coach Cards */}
                {coaches.map((coach) => (
                    <View key={coach.id} style={st.coachCard}>
                        <View style={st.coachHeader}>
                            <View style={st.avatar}>
                                <Text style={st.avatarText}>{coach.name[0]}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={st.coachName}>{coach.name}</Text>
                                <Text style={st.gymName}>{coach.gym_name}</Text>
                                <StarRating rating={coach.rating} />
                            </View>
                            {coach.distance_km != null && (
                                <Text style={st.distance}>{coach.distance_km.toFixed(1)} km</Text>
                            )}
                        </View>

                        <View style={st.specialties}>
                            {(coach.specialties ?? []).map((sp: string) => (
                                <View key={sp} style={st.specChip}>
                                    <Text style={st.specText}>{sp}</Text>
                                </View>
                            ))}
                        </View>

                        <View style={st.coachFooter}>
                            <Text style={st.price}>₹{coach.price_per_session}/session</Text>
                            <TouchableOpacity style={st.bookBtn} onPress={() => setBookingCoach(coach)}>
                                <Text style={st.bookBtnText}>Book Session</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ))}
            </ScrollView>

            {/* Booking Modal */}
            <Modal visible={!!bookingCoach} transparent animationType="slide">
                <View style={st.modalOverlay}>
                    <View style={st.modalCard}>
                        <Text style={st.modalTitle}>Book with {bookingCoach?.name}</Text>
                        <Text style={st.modalSub}>{bookingCoach?.gym_name}</Text>
                        <View style={st.input}>
                            <TextInput
                                style={st.inputText}
                                placeholder="Date & Time (e.g. 2026-03-01T10:00:00)"
                                placeholderTextColor={Colors.textMuted}
                                value={bookingDate}
                                onChangeText={setBookingDate}
                            />
                        </View>
                        <View style={st.payNote}>
                            <Ionicons name="information-circle" size={16} color={Colors.info} />
                            <Text style={st.payNoteText}>Payment will be added soon. Booking is free now.</Text>
                        </View>
                        <View style={st.modalBtns}>
                            <TouchableOpacity style={st.cancelBtn} onPress={() => setBookingCoach(null)}>
                                <Text style={st.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={st.confirmBtn} onPress={handleBook}>
                                <Text style={st.confirmBtnText}>Confirm</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const st = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg },
    header: { paddingHorizontal: Spacing.lg, paddingTop: 56, paddingBottom: 16 },
    title: { fontSize: Fonts.sizes.xl, fontWeight: '800', color: Colors.textPrimary },
    searchCard: {
        backgroundColor: Colors.card, borderRadius: Radius.xl,
        marginHorizontal: Spacing.lg, marginBottom: Spacing.md,
        padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
    },
    searchRow: { flexDirection: 'row', marginBottom: 8 },
    input: {
        backgroundColor: Colors.surface, borderRadius: Radius.md,
        borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 8,
    },
    inputText: { color: Colors.textPrimary, fontSize: Fonts.sizes.sm, paddingVertical: 10 },
    searchBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: 10, gap: 6,
    },
    searchBtnText: { color: '#fff', fontWeight: '700' },
    emptyCard: {
        alignItems: 'center', padding: 48,
        margin: Spacing.lg, backgroundColor: Colors.card,
        borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border,
    },
    emptyIcon: { fontSize: 48, marginBottom: 12 },
    emptyTitle: { fontSize: Fonts.sizes.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: 4 },
    emptySub: { fontSize: Fonts.sizes.sm, color: Colors.textMuted, textAlign: 'center' },
    coachCard: {
        backgroundColor: Colors.card, borderRadius: Radius.xl,
        marginHorizontal: Spacing.lg, marginBottom: Spacing.md,
        padding: Spacing.md, borderWidth: 1, borderColor: Colors.border,
    },
    coachHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
    avatar: {
        width: 48, height: 48, borderRadius: 24,
        backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    },
    avatarText: { color: '#fff', fontSize: Fonts.sizes.xl, fontWeight: '900' },
    coachName: { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.textPrimary },
    gymName: { fontSize: Fonts.sizes.sm, color: Colors.textMuted },
    stars: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 4 },
    ratingText: { fontSize: Fonts.sizes.xs, color: Colors.textSecondary, marginLeft: 4 },
    distance: { fontSize: Fonts.sizes.sm, color: Colors.primary, fontWeight: '700' },
    specialties: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
    specChip: {
        backgroundColor: Colors.primaryGlow, borderRadius: Radius.full,
        paddingHorizontal: 10, paddingVertical: 3,
    },
    specText: { fontSize: Fonts.sizes.xs, color: Colors.primary },
    coachFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    price: { fontSize: Fonts.sizes.md, fontWeight: '700', color: Colors.textPrimary },
    bookBtn: {
        backgroundColor: Colors.primary, borderRadius: Radius.full,
        paddingHorizontal: 20, paddingVertical: 8,
    },
    bookBtnText: { color: '#fff', fontWeight: '700', fontSize: Fonts.sizes.sm },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
    modalCard: {
        backgroundColor: Colors.card, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
        padding: Spacing.lg, gap: 12,
    },
    modalTitle: { fontSize: Fonts.sizes.xl, fontWeight: '800', color: Colors.textPrimary },
    modalSub: { fontSize: Fonts.sizes.sm, color: Colors.textMuted },
    payNote: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: 'rgba(59,130,246,0.1)', borderRadius: Radius.md, padding: 10,
    },
    payNoteText: { fontSize: Fonts.sizes.xs, color: Colors.info, flex: 1 },
    modalBtns: { flexDirection: 'row', gap: 12 },
    cancelBtn: {
        flex: 1, paddingVertical: 14, borderRadius: Radius.md,
        borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
    },
    cancelBtnText: { color: Colors.textSecondary, fontWeight: '700' },
    confirmBtn: {
        flex: 2, paddingVertical: 14, borderRadius: Radius.md,
        backgroundColor: Colors.primary, alignItems: 'center',
    },
    confirmBtnText: { color: '#fff', fontWeight: '800' },
});
