import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

import { colors, radii, spacing, withAlpha } from './palette';
import { fonts } from './typography';

type EntranceOptions = {
  delay?: number;
  duration?: number;
  translateY?: number;
};

const reduceMotionListeners = new Set<() => void>();
let reduceMotionValue = false;
let reduceMotionReady = false;

function publishReduceMotion(enabled: boolean) {
  reduceMotionValue = enabled;
  reduceMotionListeners.forEach((listener) => listener());
}

function ensureReduceMotionListener() {
  if (reduceMotionReady) return;
  reduceMotionReady = true;
  void AccessibilityInfo.isReduceMotionEnabled().then(publishReduceMotion).catch(() => undefined);
  AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
    if (typeof enabled === 'boolean') publishReduceMotion(enabled);
  });
}

function subscribeReduceMotion(listener: () => void) {
  reduceMotionListeners.add(listener);
  ensureReduceMotionListener();
  return () => {
    reduceMotionListeners.delete(listener);
  };
}

function getReduceMotionSnapshot() {
  return reduceMotionValue;
}

function getServerReduceMotionSnapshot() {
  return false;
}

export function useReducedMotion() {
  return useSyncExternalStore(subscribeReduceMotion, getReduceMotionSnapshot, getServerReduceMotionSnapshot);
}

export function useEntranceValues({ delay = 0, duration = 320, translateY = 12 }: EntranceOptions = {}) {
  const reducedMotion = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(reducedMotion ? 1 : 0));

  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(1);
      return;
    }

    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, duration, progress, reducedMotion]);

  const animatedStyle = reducedMotion
    ? styles.visible
    : {
        opacity: progress,
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [translateY, 0],
              extrapolate: 'clamp' as const,
            }),
          },
        ],
      };

  return { progress, animatedStyle, reducedMotion };
}

export function useEntranceStyle(options: EntranceOptions = {}) {
  return useEntranceValues(options).animatedStyle;
}

type ScreenEntranceProps = ViewProps & EntranceOptions;

export function ScreenEntrance({
  children,
  style,
  delay = 0,
  duration = 320,
  translateY = 12,
  ...rest
}: ScreenEntranceProps) {
  const animatedStyle = useEntranceStyle({ delay, duration, translateY });
  return (
    <Animated.View {...rest} style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

type StaggerProps = ScreenEntranceProps & {
  index?: number;
  step?: number;
  baseDelay?: number;
};

export function Stagger({
  children,
  index = 0,
  step = 45,
  baseDelay = 0,
  delay = 0,
  duration,
  translateY,
  style,
  ...rest
}: StaggerProps) {
  return (
    <ScreenEntrance
      {...rest}
      style={style}
      delay={baseDelay + delay + index * step}
      duration={duration}
      translateY={translateY}
    >
      {children}
    </ScreenEntrance>
  );
}

type MotionPressableProps = Omit<PressableProps, 'style'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  pressScale?: number;
  duration?: number;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function MotionPressable({
  children,
  style,
  onPressIn,
  onPressOut,
  pressScale = 0.985,
  duration = 110,
  ...rest
}: MotionPressableProps) {
  const reducedMotion = useReducedMotion();
  const [scale] = useState(() => new Animated.Value(1));

  const animateScale = (toValue: number) => {
    if (reducedMotion) {
      scale.setValue(1);
      return;
    }
    Animated.timing(scale, {
      toValue,
      duration,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(event) => {
        animateScale(pressScale);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        animateScale(1);
        onPressOut?.(event);
      }}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}

type PulseBadgeProps = ViewProps & {
  children: ReactNode;
  paused?: boolean;
  duration?: number;
};

export function PulseBadge({ children, style, paused = false, duration = 900, ...rest }: PulseBadgeProps) {
  const reducedMotion = useReducedMotion();
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (reducedMotion || paused) {
      opacity.setValue(1);
      return;
    }
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.68,
          duration,
          easing: Easing.out(Easing.quad),
          isInteraction: false,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration,
          easing: Easing.in(Easing.quad),
          isInteraction: false,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [duration, opacity, paused, reducedMotion]);

  return (
    <Animated.View {...rest} style={[style, { opacity }]}>
      {children}
    </Animated.View>
  );
}

type TabIndicatorProps = {
  active: boolean;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

export function TabIndicator({ active, color = colors.accent, style }: TabIndicatorProps) {
  const reducedMotion = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(active ? 1 : 0));

  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(active ? 1 : 0);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: active ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [active, progress, reducedMotion]);

  return (
    <Animated.View
      style={[
        styles.tabIndicator,
        style,
        {
          backgroundColor: color,
          opacity: progress,
          transform: [{ scaleX: progress }],
        },
      ]}
    />
  );
}

type LoadingDotsProps = ViewProps & {
  label?: string;
  color?: string;
  labelStyle?: StyleProp<TextStyle>;
};

export function LoadingDots({ label, color = colors.primary, style, labelStyle, ...rest }: LoadingDotsProps) {
  const reducedMotion = useReducedMotion();
  const [dots] = useState(() => [new Animated.Value(0.35), new Animated.Value(0.35), new Animated.Value(0.35)]);

  useEffect(() => {
    if (reducedMotion) {
      dots.forEach((dot) => dot.setValue(0.75));
      return;
    }
    const animations = dots.map((dot, index) => Animated.loop(
      Animated.sequence([
        Animated.timing(dot, {
          toValue: 1,
          duration: 420,
          delay: index * 130,
          easing: Easing.out(Easing.quad),
          isInteraction: false,
          useNativeDriver: true,
        }),
        Animated.timing(dot, {
          toValue: 0.35,
          duration: 420,
          easing: Easing.in(Easing.quad),
          isInteraction: false,
          useNativeDriver: true,
        }),
      ]),
    ));
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [dots, reducedMotion]);

  return (
    <View {...rest} style={[styles.loadingWrap, style]}>
      <View style={styles.dotsRow}>
        {dots.map((opacity, index) => (
          <Animated.View key={index} style={[styles.dot, { backgroundColor: color, opacity }]} />
        ))}
      </View>
      {label ? <Text style={[styles.loadingLabel, labelStyle]}>{label}</Text> : null}
    </View>
  );
}

type FeedbackBannerProps = ViewProps & {
  text: string;
  tone?: 'success' | 'error' | 'info';
};

export function FeedbackBanner({ text, tone = 'info', style, ...rest }: FeedbackBannerProps) {
  const paletteStyle = tone === 'error'
    ? styles.feedbackError
    : tone === 'success'
      ? styles.feedbackSuccess
      : styles.feedbackInfo;
  const paletteText = tone === 'error'
    ? styles.feedbackErrorText
    : tone === 'success'
      ? styles.feedbackSuccessText
      : styles.feedbackInfoText;

  return (
    <ScreenEntrance
      {...rest}
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion={tone === 'error' ? 'assertive' : 'polite'}
      translateY={6}
      duration={260}
      style={[styles.feedbackBanner, paletteStyle, style]}
    >
      <Text style={[styles.feedbackText, paletteText]}>{text}</Text>
    </ScreenEntrance>
  );
}

const styles = StyleSheet.create({
  visible: { opacity: 1 },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 8,
    right: 8,
    height: 2,
    borderRadius: 1,
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 18,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  loadingLabel: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  feedbackBanner: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.sm,
    borderWidth: 1,
    marginTop: spacing.md,
    justifyContent: 'center',
  },
  feedbackInfo: {
    backgroundColor: colors.blueLight,
    borderColor: withAlpha(colors.info, 0.24),
  },
  feedbackSuccess: {
    backgroundColor: colors.greenLight,
    borderColor: withAlpha(colors.success, 0.24),
  },
  feedbackError: {
    backgroundColor: colors.redLight,
    borderColor: withAlpha(colors.danger, 0.24),
  },
  feedbackText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: 18,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  feedbackInfoText: { color: '#2C5A6A' },
  feedbackSuccessText: { color: colors.primaryDark },
  feedbackErrorText: { color: colors.danger },
});
