import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, withAlpha } from './palette';
import { fonts } from './typography';
import type { Tone } from '@/data/api';

type StatusPillProps = {
  label: string;
  tone?: Tone;
  small?: boolean;
};

const TONE_STYLES: Record<Tone, { view: object; text: object }> = {
  green: {
    view: { backgroundColor: colors.greenLight, borderColor: withAlpha(colors.green, 0.22) },
    text: { color: colors.primaryDark },
  },
  amber: {
    view: { backgroundColor: colors.amberLight, borderColor: withAlpha(colors.warning, 0.24) },
    text: { color: '#8A4A29' },
  },
  blue: {
    view: { backgroundColor: colors.blueLight, borderColor: withAlpha(colors.info, 0.22) },
    text: { color: '#2C5A6A' },
  },
  muted: {
    view: { backgroundColor: colors.stone, borderColor: colors.line },
    text: { color: colors.textSoft },
  },
};

export function StatusPill({ label, tone = 'muted', small = false }: StatusPillProps) {
  const toneStyle = TONE_STYLES[tone];
  return (
    <View style={[styles.pill, small && styles.pillSmall, toneStyle.view]}>
      <Text style={[styles.text, small && styles.textSmall, toneStyle.text]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 25,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillSmall: { minHeight: 22, paddingHorizontal: spacing.sm },
  text: {
    color: colors.textSoft,
    fontFamily: fonts.semiBold,
    fontSize: 10,
    lineHeight: 15,
    writingDirection: 'rtl',
  },
  textSmall: { fontSize: 9, lineHeight: 13 },
});
