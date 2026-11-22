export const fonts = {
  regular: 'IBMPlexSansArabic-Regular',
  medium: 'IBMPlexSansArabic-Medium',
  semiBold: 'IBMPlexSansArabic-SemiBold',
  bold: 'IBMPlexSansArabic-Bold',
} as const;

const rtl = { writingDirection: 'rtl' as const };

export const typeScale = {
  display: {
    ...rtl,
    fontFamily: fonts.bold,
    fontSize: 56,
    lineHeight: 60,
    letterSpacing: -0.8,
  },
  displayMedium: {
    ...rtl,
    fontFamily: fonts.bold,
    fontSize: 46,
    lineHeight: 51,
    letterSpacing: -0.6,
  },
  displaySmall: {
    ...rtl,
    fontFamily: fonts.bold,
    fontSize: 37,
    lineHeight: 45,
    letterSpacing: -0.4,
  },
  heading: {
    ...rtl,
    fontFamily: fonts.semiBold,
    fontSize: 30,
    lineHeight: 40,
    letterSpacing: -0.2,
  },
  headingSmall: {
    ...rtl,
    fontFamily: fonts.semiBold,
    fontSize: 22,
    lineHeight: 31,
    letterSpacing: -0.1,
  },
  body: {
    ...rtl,
    fontFamily: fonts.medium,
    fontSize: 15,
    lineHeight: 26,
  },
  bodySmall: {
    ...rtl,
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 23,
  },
  label: {
    ...rtl,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 0.2,
  },
  eyebrow: {
    ...rtl,
    fontFamily: fonts.semiBold,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.4,
  },
  caption: {
    ...rtl,
    fontFamily: fonts.regular,
    fontSize: 10,
    lineHeight: 16,
  },
  numeric: {
    fontFamily: fonts.semiBold,
    letterSpacing: 1.2,
  },
} as const;

export const typography = typeScale;
