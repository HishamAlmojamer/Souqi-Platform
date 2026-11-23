import { useWindowDimensions } from 'react-native';

export const breakpoints = {
  sm: 600,
  md: 820,
  lg: 980,
  xl: 1180,
} as const;

export const containerStyle = {
  width: '100%',
  maxWidth: breakpoints.xl,
  alignSelf: 'center',
} as const;

export function useResponsive() {
  const { width } = useWindowDimensions();

  return {
    width,
    isCompact: width < breakpoints.sm,
    isPhone: width < breakpoints.md,
    isTablet: width >= breakpoints.sm && width < breakpoints.lg,
    isDesktop: width >= breakpoints.lg,
    isWide: width >= breakpoints.xl,
    gutter: width < breakpoints.sm ? 16 : width < breakpoints.lg ? 20 : 24,
  };
}
