export const colors = {
  obsidian: '#0B0C0F',
  obsidianSoft: '#17191E',
  obsidianDeep: '#050608',
  gold: '#D6B26B',
  goldDeep: '#A67C36',
  goldLight: '#F5E9CE',
  stone: '#F1EEE7',
  ink: '#121317',
  inkSoft: '#4A4D55',
  green: '#1E7A5C',
  greenDark: '#0B0C0F',
  greenLight: '#E9F2ED',
  cream: '#F8F6F1',
  paper: '#FFFFFF',
  line: '#E7E2D7',
  muted: '#73767E',
  amber: '#B4683F',
  amberLight: '#FBECE2',
  blue: '#3C7184',
  blueLight: '#E7F0F3',
  red: '#B24E43',
  redLight: '#FAEAE7',
  mint: '#E9F2ED',
  highlight: '#F0C978',
  clay: '#A67C36',

  primary: '#0B0C0F',
  primaryDark: '#050608',
  primarySoft: '#F5E9CE',
  accent: '#D6B26B',
  accentDark: '#8A6529',
  accentSoft: '#FBF4E6',
  surface: '#FFFFFF',
  surfaceAlt: '#F8F6F1',
  text: '#121317',
  textSoft: '#4A4D55',
  textMuted: '#73767E',
  border: '#E7E2D7',
  success: '#1E7A5C',
  warning: '#B4683F',
  danger: '#B24E43',
  info: '#3C7184',
  onDark: '#F8F3E7',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const shadows = {
  soft: {
    shadowColor: colors.obsidian,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  header: {
    shadowColor: colors.obsidian,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3,
  },
  gold: {
    shadowColor: colors.goldDeep,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 22,
    elevation: 6,
  },
} as const;

export function withAlpha(hex: string, alpha: number) {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((char) => char + char).join('') : value;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
