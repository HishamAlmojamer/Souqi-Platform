import { Link } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from './BrandMark';
import { AmbientGlow, MotionPressable, ScreenEntrance } from './motion';
import { colors, radii, shadows, spacing, withAlpha } from './palette';
import { containerStyle, useResponsive } from './responsive';
import { fonts, typeScale } from './typography';

type AuthLayoutProps = {
  children: ReactNode;
  title: string;
  subtitle: string;
  asideTitle: string;
  asideText: string;
};

export function AuthLayout({ children, title, subtitle, asideTitle, asideText }: AuthLayoutProps) {
  const { isPhone, isCompact, gutter } = useResponsive();
  const wide = !isPhone;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={[styles.header, { paddingHorizontal: gutter }]}>
        <Link href="/" asChild>
          <MotionPressable accessibilityRole="link" style={styles.brand} hoverStyle={styles.brandHover}>
            <BrandMark size={isCompact ? 34 : 40} />
            <View>
              <Text style={styles.brandName}>سوقي</Text>
              <Text style={styles.brandSub}>للتصنيع والتوريد</Text>
            </View>
          </MotionPressable>
        </Link>
        <Text style={styles.demoBadge}>وصول تجريبي</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingHorizontal: gutter }]} keyboardShouldPersistTaps="handled">
        <ScreenEntrance style={[styles.content, wide && styles.contentWide]}>
          <View style={styles.formColumn}>
            <ScreenEntrance style={styles.formHeading} delay={70} translateY={8}>
              <Text style={styles.kicker}>مساحة آمنة لأعمالك</Text>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </ScreenEntrance>
            {children}
            <Text style={styles.disclaimer}>يتم إرسال بيانات النموذج إلى خادم التطوير عبر اتصال محلي.</Text>
          </View>

          {wide ? (
            <View style={styles.aside}>
              <AmbientGlow size={300} color={colors.gold} style={styles.asideGlowTop} duration={3400} />
              <AmbientGlow size={220} color={colors.highlight} style={styles.asideGlowBottom} duration={3900} min={0.06} max={0.2} />
              <BrandMark size={48} variant="light" />
              <Text style={styles.asideKicker}>سوقي · للتوريد بين الشركات</Text>
              <Text style={styles.asideTitle}>{asideTitle}</Text>
              <Text style={styles.asideText}>{asideText}</Text>
              <View style={styles.asideRule} />
              <Text style={styles.asideFootnote}>نموذج تجريبي · استخدم بيانات اختبار ولا تدخل معلومات إنتاجية.</Text>
            </View>
          ) : null}
        </ScreenEntrance>
      </ScrollView>
    </SafeAreaView>
  );
}

export const authStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: withAlpha(colors.goldDeep, 0.28),
    borderRadius: radii.lg,
    padding: spacing.xl,
    marginTop: spacing.xl - 4,
    ...shadows.soft,
  },
  cardCompact: { padding: spacing.lg, marginTop: spacing.lg },
  field: { marginBottom: spacing.lg },
  label: {
    color: colors.text,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    marginBottom: spacing.sm - 1,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.medium,
    fontSize: 13,
    writingDirection: 'rtl',
  },
  inputWithAction: {
    flex: 1,
    minHeight: 48,
    color: colors.text,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.medium,
    fontSize: 13,
    writingDirection: 'rtl',
  },
  passwordWrap: {
    minHeight: 48,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
  visibilityButton: { paddingHorizontal: spacing.md, minHeight: 46, justifyContent: 'center' },
  visibilityText: { color: colors.accentDark, fontFamily: fonts.semiBold, fontSize: 11, writingDirection: 'rtl' },
  primaryButton: {
    minHeight: 50,
    borderRadius: radii.sm,
    backgroundColor: colors.obsidian,
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.55),
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  primaryButtonPressed: { backgroundColor: colors.goldDeep, borderColor: colors.gold },
  primaryButtonHover: { backgroundColor: colors.obsidianSoft, borderColor: colors.gold },
  primaryButtonText: { color: colors.goldLight, fontFamily: fonts.bold, fontSize: 14, writingDirection: 'rtl' },
  feedback: { color: colors.danger, fontFamily: fonts.medium, fontSize: 11, lineHeight: 18, marginTop: spacing.md, textAlign: 'right', writingDirection: 'rtl' },
  success: { color: colors.success, fontFamily: fonts.medium, fontSize: 11, lineHeight: 18, marginTop: spacing.md, textAlign: 'right', writingDirection: 'rtl' },
  separator: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md, marginTop: spacing.xl - 4 },
  separatorLine: { flex: 1, height: 1, backgroundColor: colors.border },
  separatorText: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 10, writingDirection: 'rtl' },
  switchText: { color: colors.textSoft, fontFamily: fonts.medium, fontSize: 11, marginTop: spacing.lg, textAlign: 'center', writingDirection: 'rtl' },
  switchLink: { color: colors.accentDark, fontFamily: fonts.bold, writingDirection: 'rtl' },
  roleLabel: { color: colors.text, fontFamily: fonts.semiBold, fontSize: 12, marginBottom: spacing.sm, textAlign: 'right', writingDirection: 'rtl' },
  roleRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.lg },
  roleButton: {
    flex: 1,
    minWidth: 140,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  roleButtonActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  roleButtonHover: { borderColor: withAlpha(colors.gold, 0.7), backgroundColor: withAlpha(colors.gold, 0.06) },
  roleButtonText: { color: colors.textSoft, fontFamily: fonts.medium, fontSize: 11, writingDirection: 'rtl' },
  roleButtonTextActive: { color: colors.accentDark, fontFamily: fonts.bold },
  termsRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.md },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: withAlpha(colors.goldDeep, 0.5),
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: colors.goldDeep, borderColor: colors.gold },
  checkboxText: { color: colors.surface, fontFamily: fonts.bold, fontSize: 12 },
  termsText: { flex: 1, color: colors.textMuted, fontFamily: fonts.medium, fontSize: 11, lineHeight: 18, textAlign: 'right', writingDirection: 'rtl' },
});

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surfaceAlt },
  header: {
    ...containerStyle,
    minHeight: 76,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md - 2 },
  brandHover: { opacity: 0.88 },
  brandName: { color: colors.text, fontFamily: fonts.bold, fontSize: 17, textAlign: 'right', writingDirection: 'rtl' },
  brandSub: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 10, marginTop: 2, textAlign: 'right', writingDirection: 'rtl' },
  demoBadge: {
    color: colors.accentDark,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
    borderRadius: radii.pill,
    fontFamily: fonts.semiBold,
    fontSize: 10,
    writingDirection: 'rtl',
  },
  scrollContent: { flexGrow: 1, paddingVertical: spacing.xl, justifyContent: 'center' },
  content: { width: '100%', maxWidth: 1020, alignSelf: 'center' },
  contentWide: { flexDirection: 'row-reverse', alignItems: 'stretch', gap: spacing.xxl - 4 },
  formColumn: { flex: 1, maxWidth: 480, alignSelf: 'center', width: '100%', paddingVertical: spacing.lg },
  formHeading: { alignItems: 'flex-end' },
  kicker: { ...typeScale.eyebrow, color: colors.accentDark },
  title: { color: colors.text, fontFamily: fonts.bold, fontSize: 29, lineHeight: 39, marginTop: spacing.md, textAlign: 'right', writingDirection: 'rtl' },
  subtitle: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 13, lineHeight: 21, marginTop: spacing.sm, textAlign: 'right', writingDirection: 'rtl' },
  disclaimer: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 10, lineHeight: 16, marginTop: spacing.lg, textAlign: 'center', writingDirection: 'rtl' },
  aside: {
    flex: 0.9,
    minHeight: 450,
    maxWidth: 420,
    backgroundColor: colors.primaryDark,
    borderRadius: radii.lg,
    padding: spacing.xxl - 4,
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.4),
    borderTopWidth: 3,
    borderTopColor: colors.accent,
    ...shadows.gold,
  },
  asideGlowTop: { top: -120, right: -110 },
  asideGlowBottom: { bottom: -90, left: -70 },
  asideKicker: { color: colors.accent, fontFamily: fonts.semiBold, fontSize: 11, textAlign: 'right', writingDirection: 'rtl' },
  asideTitle: { color: colors.onDark, fontFamily: fonts.bold, fontSize: 27, lineHeight: 40, marginTop: spacing.lg, textAlign: 'right', writingDirection: 'rtl' },
  asideText: { color: withAlpha(colors.onDark, 0.82), fontFamily: fonts.medium, fontSize: 13, lineHeight: 24, marginTop: spacing.md, textAlign: 'right', writingDirection: 'rtl' },
  asideRule: { height: 1, backgroundColor: withAlpha(colors.accent, 0.5), marginTop: spacing.xl, marginBottom: spacing.md },
  asideFootnote: { color: withAlpha(colors.onDark, 0.68), fontFamily: fonts.regular, fontSize: 10, lineHeight: 17, textAlign: 'right', writingDirection: 'rtl' },
});