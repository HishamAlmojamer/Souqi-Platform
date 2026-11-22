import { StyleSheet, Text, View } from 'react-native';

import { colors, withAlpha } from './palette';
import { fonts } from './typography';

type BrandMarkProps = {
  size?: number;
  variant?: 'dark' | 'light';
};

export function BrandMark({ size = 44, variant = 'dark' }: BrandMarkProps) {
  const dark = variant === 'dark';
  return (
    <View
      style={[
        styles.mark,
        { width: size, height: size, borderRadius: Math.round(size * 0.32) },
        dark ? styles.dark : styles.light,
      ]}
    >
      <Text style={[styles.text, { fontSize: Math.round(size * 0.52) }, dark ? styles.darkText : styles.lightText]}>
        س
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  dark: { backgroundColor: colors.primaryDark, borderColor: withAlpha(colors.accent, 0.55) },
  light: { backgroundColor: colors.surface, borderColor: withAlpha(colors.primary, 0.18) },
  text: { fontFamily: fonts.bold, writingDirection: 'rtl', marginTop: -2 },
  darkText: { color: colors.accent },
  lightText: { color: colors.primaryDark },
});
