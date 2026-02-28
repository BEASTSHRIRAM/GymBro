// GymBro — Navigation Root
// AuthNavigator → (Login, Register, OTP)
// AppNavigator → Drawer → BottomTabs → All screens

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import {
    createBottomTabNavigator,
    type BottomTabNavigationOptions,
} from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../stores/authStore';
import { Colors } from '../theme';
import { Ionicons } from '@expo/vector-icons';

// Auth screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import OTPScreen from '../screens/auth/OTPScreen';

// App screens
import HomeScreen from '../screens/HomeScreen';
import FormCheckerScreen from '../screens/FormCheckerScreen';
import VideoCallFormCheckerScreen from '../screens/VideoCallFormCheckerScreen';
import StrengthScreen from '../screens/StrengthScreen';
import DietScreen from '../screens/DietScreen';
import BodyScanScreen from '../screens/BodyScanScreen';
import GamificationScreen from '../screens/GamificationScreen';
import CoachesScreen from '../screens/CoachesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ProfileEditor from '../screens/ProfileEditor';

const AuthStack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();
const Tab = createBottomTabNavigator();
const ProfileStack = createNativeStackNavigator();

// ── Bottom Tabs ───────────────────────────────────────────────────────────────
function BottomTabs() {
    // Map tab names to valid Ionicons names
    type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];
    const TAB_ICONS: Record<string, IoniconsName> = {
        Home: 'home',
        'Form Check': 'camera',
        Diet: 'nutrition',
        Strength: 'fitness',
    };

    return (
        <Tab.Navigator
            screenOptions={({ route }): BottomTabNavigationOptions => ({
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: Colors.card,
                    borderTopColor: Colors.border,
                    borderTopWidth: 1,
                    height: 60,
                    paddingBottom: 8,
                },
                tabBarActiveTintColor: Colors.primary,
                tabBarInactiveTintColor: Colors.textMuted,
                tabBarIcon: ({ color, size }: { color: string; size: number }) => (
                    <Ionicons name={TAB_ICONS[route.name] ?? 'ellipse'} size={size} color={color} />
                ),
            })}
        >
            <Tab.Screen name="Home" component={HomeScreen} />
            <Tab.Screen name="Form Check" component={FormCheckerScreen} />
            <Tab.Screen name="Diet" component={DietScreen} />
            <Tab.Screen name="Strength" component={StrengthScreen} />
        </Tab.Navigator>
    );
}

// ── Profile Stack ─────────────────────────────────────────────────────────────
function ProfileStackNavigator() {
    return (
        <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
            <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} />
            <ProfileStack.Screen name="ProfileEditor" component={ProfileEditor} />
        </ProfileStack.Navigator>
    );
}

// ── Drawer Navigator ──────────────────────────────────────────────────────────
function AppDrawer() {
    return (
        <Drawer.Navigator
            screenOptions={{
                headerShown: false,
                drawerStyle: { backgroundColor: Colors.card, width: 280 },
                drawerActiveTintColor: Colors.primary,
                drawerInactiveTintColor: Colors.textSecondary,
                drawerLabelStyle: { fontSize: 16, fontWeight: '600' },
                swipeEnabled: true,
            }}
        >
            <Drawer.Screen
                name="Main"
                component={BottomTabs}
                options={{ title: 'GymBro', drawerLabel: ' Home' }}
            />
            <Drawer.Screen
                name="Profile"
                component={ProfileStackNavigator}
                options={{
                    drawerLabel: 'Profile',
                    drawerIcon: ({ color, size }) => (
                        <Ionicons name="person-outline" size={size} color={color} />
                    ),
                }}
            />
            <Drawer.Screen
                name="BodyScan"
                component={BodyScanScreen}
                options={{ drawerLabel: ' AI Body Scan' }}
            />
            <Drawer.Screen
                name="Gamification"
                component={GamificationScreen}
                options={{ drawerLabel: ' Achievements' }}
            />
            <Drawer.Screen
                name="Coaches"
                component={CoachesScreen}
                options={{ drawerLabel: 'Find Coaches' }}
            />
            <Drawer.Screen
                name="VideoCallTrainer"
                component={VideoCallFormCheckerScreen}
                options={{
                    drawerLabel: 'Video Call Trainer',
                    drawerIcon: ({ color, size }) => (
                        <Ionicons name="videocam" size={size} color={color} />
                    ),
                }}
            />
        </Drawer.Navigator>
    );
}

// ── Auth Stack ────────────────────────────────────────────────────────────────
function AuthNavigator() {
    return (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
            <AuthStack.Screen name="Login" component={LoginScreen} />
            <AuthStack.Screen name="Register" component={RegisterScreen} />
            <AuthStack.Screen name="OTP" component={OTPScreen} />
        </AuthStack.Navigator>
    );
}

// ── Root Navigator ────────────────────────────────────────────────────────────
export default function RootNavigator() {
    const isAuthenticated = useAuthStore((s: { isAuthenticated: boolean }) => s.isAuthenticated);

    return (
        <NavigationContainer>
            {isAuthenticated ? <AppDrawer /> : <AuthNavigator />}
        </NavigationContainer>
    );
}
