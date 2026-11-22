export const colors = {
  obsidian: '#12332B',
  obsidianSoft: '#1B473B',
  gold: '#C99B4E',
  goldDeep: '#8F6A2E',
  goldLight: '#F7EFDD',
  stone: '#F1EFE8',
  ink: '#182722',
  inkSoft: '#4C5B54',
  green: '#1E6B54',
  greenDark: '#123B31',
  greenLight: '#E6F0E9',
  cream: '#F7F6F1',
  paper: '#FFFFFF',
  line: '#E3E7E0',
  muted: '#6B756F',
  amber: '#B4683F',
  amberLight: '#FBECE2',
  blue: '#3C7184',
  blueLight: '#E7F0F3',
  red: '#B24E43',
  redLight: '#FAEAE7',
  mint: '#E6F0E9',
  highlight: '#E2B054',
  clay: '#B4683F',

  primary: '#1E6B54',
  primaryDark: '#123B31',
  primarySoft: '#E6F0E9',
  accent: '#C99B4E',
  accentDark: '#8F6A2E',
  accentSoft: '#F7EFDD',
  surface: '#FFFFFF',
  surfaceAlt: '#F7F6F1',
  text: '#182722',
  textSoft: '#4C5B54',
  textMuted: '#6B756F',
  border: '#E3E7E0',
  success: '#1E6B54',
  warning: '#B4683F',
  danger: '#B24E43',
  info: '#3C7184',
  onDark: '#F7F6F1',
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
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  header: {
    shadowColor: colors.obsidian,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
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
