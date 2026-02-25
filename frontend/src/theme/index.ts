// GymBro — Design System
// Dark gym aesthetic: near-black background, orange accent

export const Colors = {
  // Backgrounds
  bg: '#0A0A0A',
  card: '#141414',
  cardElevated: '#1C1C1C',
  surface: '#1A1A1A',
  border: '#2A2A2A',

  // Orange accent
  primary: '#FF6B35',
  primaryDark: '#CC4D1B',
  primaryLight: '#FF8C5A',
  primaryGlow: 'rgba(255, 107, 53, 0.15)',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0A0',
  textMuted: '#606060',

  // Status
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  // Rank colors
  rankBeginner: '#A0A0A0',
  rankBronze: '#CD7F32',
  rankSilver: '#C0C0C0',
  rankGold: '#FFD700',
  rankElite: '#FF6B35',

  // Form score gradient
  scorePoor: '#EF4444',
  scoreOk: '#F59E0B',
  scoreGood: '#22C55E',
  scorePerfect: '#FF6B35',
};

export const Fonts = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 18,
    xl: 22,
    xxl: 28,
    display: 36,
    hero: 48,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const Shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  glow: {
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
};

export const getRankColor = (rank: string): string => {
  const map: Record<string, string> = {
    Beginner: Colors.rankBeginner,
    Bronze: Colors.rankBronze,
    Silver: Colors.rankSilver,
    Gold: Colors.rankGold,
    Elite: Colors.rankElite,
  };
  return map[rank] ?? Colors.rankBeginner;
};

export const getFormScoreColor = (score: number): string => {
  if (score >= 90) return Colors.scorePerfect;
  if (score >= 70) return Colors.scoreGood;
  if (score >= 50) return Colors.scoreOk;
  return Colors.scorePoor;
};
