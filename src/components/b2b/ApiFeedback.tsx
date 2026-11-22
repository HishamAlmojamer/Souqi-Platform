import { Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';

import { colors, radii, shadows, spacing } from './palette';
import { fonts } from './typography';
import { errorMessage } from '@/data/api';

type ApiFeedbackProps = {
  loading: boolean;
  error: Error | null;
  empty?: boolean;
  emptyTitle?: string;
  emptyBody?: string;
  onRetry?: () => void;
};

export function ApiFeedback({
  loading,
  error,
  empty = false,
  emptyTitle = 'لا توجد بيانات بعد',
  emptyBody = 'ستظهر البيانات هنا بعد إضافتها إلى المنصة.',
  onRetry,
}: ApiFeedbackProps) {
  if (loading) {
    return (
      <View style={styles.state}>
        <ActivityIndicator color={colors.green} />
        <Text style={styles.stateText}>جارٍ تحميل البيانات من الخادم...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.state}>
        <Text style={styles.stateTitle}>تعذر تحميل البيانات</Text>
        <Text style={styles.stateText}>{errorMessage(error)}</Text>
        {onRetry ? (
          <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retryButton}>
            <Text style={styles.retryText}>إعادة المحاولة</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (empty) {
    return (
      <View style={styles.state}>
        <Text style={styles.stateTitle}>{emptyTitle}</Text>
        <Text style={styles.stateText}>{emptyBody}</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  state: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    gap: spacing.md,
    ...shadows.soft,
  },
  stateTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 16, textAlign: 'center', writingDirection: 'rtl' },
  stateText: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 12, lineHeight: 19, textAlign: 'center', writingDirection: 'rtl' },
  retryButton: {
    minHeight: 42,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.sm,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: { color: colors.accent, fontFamily: fonts.semiBold, fontSize: 12, writingDirection: 'rtl' },
});
