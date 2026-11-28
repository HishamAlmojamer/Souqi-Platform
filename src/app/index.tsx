import { useRouter } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/b2b/AppHeader';
import {
  AmbientGlow,
  MotionPressable,
  PulseBadge,
  ScreenEntrance,
  Stagger,
  useReducedMotion,
} from '@/components/b2b/motion';
import { colors, withAlpha } from '@/components/b2b/palette';
import { containerStyle, useResponsive } from '@/components/b2b/responsive';
import { fonts, typeScale } from '@/components/b2b/typography';

const sectors = [
  { index: '01', title: 'الملابس والمنسوجات', note: 'من الخامة إلى المنتج النهائي', symbol: '◈' },
  { index: '02', title: 'التغليف والعبوات', note: 'أفكارك بهوية علامتك', symbol: '▧' },
  { index: '03', title: 'الأغذية والمشروبات', note: 'تصنيع وتعبئة للعلامات', symbol: '⌁' },
  { index: '04', title: 'العناية والجمال', note: 'تركيبات ومنتجات خاصة', symbol: '✳' },
];

const journeyStages = [
  {
    index: '01',
    label: 'المواصفات',
    caption: 'حدّد تفاصيل المنتج والكمية المطلوبة.',
    cardTitle: 'مواصفات طلب جديد',
    cardSubtitle: 'قمصان قطنية · ٢٬٤٠٠ قطعة',
    quoteCount: 'جاهز للإرسال للموردين',
    stamp: '١',
    stampLabel: 'خطوة\nأولى',
    avatars: ['م', 'ر', '+'],
    routeLead: 'طلبك',
    routeTail: '← يبدأ من المواصفات',
  },
  {
    index: '02',
    label: 'العروض',
    caption: 'راجع العروض الواردة وشروطها جنبًا إلى جنب.',
    cardTitle: 'عروض واردة للمقارنة',
    cardSubtitle: '٤ مصانع · شروط مختلفة',
    quoteCount: '٤ عروض قيد المقارنة',
    stamp: '٤',
    stampLabel: 'عروض\nللمقارنة',
    avatars: ['م', 'ر', '+'],
    routeLead: 'عروضك',
    routeTail: '← جنبًا إلى جنب',
  },
  {
    index: '03',
    label: 'العينات',
    caption: 'تابع حالة العينة المسجّلة لكل مورد.',
    cardTitle: 'عينة مسجّلة لدى المورد',
    cardSubtitle: 'قماش قطني · دفعة أولى',
    quoteCount: 'الحالة: قيد التحضير',
    stamp: '٢',
    stampLabel: 'عينات\nقيد المتابعة',
    avatars: ['ع', 'ن', '+'],
    routeLead: 'عينتك',
    routeTail: '← تُسجَّل حسب المرحلة',
  },
  {
    index: '04',
    label: 'الإنتاج',
    caption: 'تابع مراحل الإنتاج كما تُسجَّل في مساحة العمل.',
    cardTitle: 'أمر إنتاج قيد التنفيذ',
    cardSubtitle: '٢٬٤٠٠ قطعة · ٣ مراحل',
    quoteCount: 'تم تسجيل ٢ من ٣ مراحل',
    stamp: '٣',
    stampLabel: 'مراحل\nمسجّلة',
    avatars: ['١', '٢', '+'],
    routeLead: 'إنتاجك',
    routeTail: '← يُحدَّث من مساحة العمل',
  },
] as const;

const readableGold = '#7A5722';
let lastSelectedSector: string | null = null;

function rememberSelectedSector(index: string | null) {
  lastSelectedSector = index;
}

export default function LandingScreen() {
  const { width, isPhone, isDesktop, gutter } = useResponsive();
  const router = useRouter();
  const wide = isDesktop;
  const tablet = !isPhone;
  const heroTitleSize = Math.min(Math.max(width * 0.075, 32), 56);
  const heroTitleStyle = {
    ...typeScale.display,
    fontSize: heroTitleSize,
    lineHeight: heroTitleSize * 1.12,
    letterSpacing: heroTitleSize >= 46 ? -0.8 : -0.55,
  } as const;
  const sectorSizing = wide ? styles.sectorCardQuad : tablet ? styles.sectorCardHalf : styles.sectorCardFull;
  const [activeStage, setActiveStage] = useState(0);
  const [activeSector, setActiveSector] = useState<string | null>(() => lastSelectedSector);
  const [focusedSector, setFocusedSector] = useState<string | null>(null);
  const [hoveredSector, setHoveredSector] = useState<string | null>(null);
  const [pressedSector, setPressedSector] = useState<string | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [scrollProgress] = useState(() => new Animated.Value(0));
  const [scrollY] = useState(() => new Animated.Value(0));
  const scrollRef = useRef<ScrollView>(null);
  const backToTopVisible = useRef(false);
  const reducedMotion = useReducedMotion();
  const progressWidth = scrollProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, width],
    extrapolate: 'clamp',
  });
  const heroVisualShift = scrollY.interpolate({
    inputRange: [0, 320],
    outputRange: [0, 26],
    extrapolate: 'clamp',
  });
  const heroCopyFade = scrollY.interpolate({
    inputRange: [0, 260],
    outputRange: [1, 0.28],
    extrapolate: 'clamp',
  });
  const backToTopOpacity = scrollY.interpolate({
    inputRange: [360, 520],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const backToTopLift = scrollY.interpolate({
    inputRange: [360, 520],
    outputRange: [14, 0],
    extrapolate: 'clamp',
  });
  const activeJourney = journeyStages[activeStage];

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const maxScroll = contentSize.height - layoutMeasurement.height;
    scrollProgress.setValue(maxScroll > 0 ? Math.min(Math.max(contentOffset.y / maxScroll, 0), 1) : 0);
    scrollY.setValue(contentOffset.y);
    const shouldShow = contentOffset.y > 420;
    if (shouldShow !== backToTopVisible.current) {
      backToTopVisible.current = shouldShow;
      setShowBackToTop(shouldShow);
    }
  };

  const selectSector = (index: string) => {
    rememberSelectedSector(index);
    setActiveSector(index);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppHeader active="home" />
      <View style={styles.scrollTrack} pointerEvents="none">
        <Animated.View style={[styles.scrollProgressFill, { width: progressWidth }]} />
      </View>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.page}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <ScreenEntrance style={styles.pageInner}>
        <View style={[styles.hero, { paddingHorizontal: wide ? 44 : gutter }]}>
          <AmbientGlow color={colors.gold} size={430} style={styles.heroGlow} duration={4200} min={0.08} max={0.24} />
          <AmbientGlow color={colors.highlight} size={280} style={styles.heroGlowAccent} duration={5200} min={0.05} max={0.16} />
          <View style={[styles.heroOrb, styles.decorative]} />
          <View style={[styles.heroArc, styles.decorative]} />
          <View style={[styles.heroInner, wide && styles.heroInnerWide]}>
            <Animated.View style={[styles.heroCopy, wide && styles.heroCopyWide, !reducedMotion && { opacity: heroCopyFade }]}>
              <View style={styles.eyebrowRow}>
                <View style={styles.eyebrowDot} />
                <Text style={styles.eyebrow}>منصة توريد وتصنيع للعلامات الطموحة</Text>
              </View>
              <Text style={[heroTitleStyle, styles.heroTitle]}>
                من فكرة منتجك،{'\n'}
                <Text style={styles.heroAccent}>إلى مصنعك المناسب.</Text>
              </Text>
              <Text style={[typeScale.body, styles.heroDescription]}>
                اجمع متطلباتك، قارن عروض المصانع، وتابع عيناتك وإنتاجك — في مساحة واحدة صُممت للمشتري العربي.
              </Text>
              <View style={[styles.heroActions, !tablet && styles.heroActionsStack]}>
                <GoldSheenButton
                  accessibilityLabel="ابدأ طلب عروض الأسعار"
                  onPress={() => router.navigate('/rfq/new' as any)}
                  style={styles.primaryButton}
                  pressedStyle={styles.primaryButtonPressed}
                  hoverStyle={styles.primaryButtonHover}
                >
                  <Text style={styles.primaryButtonText}>ابدأ طلب عروض الأسعار <Text style={styles.buttonArrow}>←</Text></Text>
                </GoldSheenButton>
                <MotionPressable
                  accessibilityRole="button"
                  onPress={() => router.navigate('/workspace' as any)}
                  style={styles.secondaryButton}
                  pressedStyle={styles.secondaryButtonPressed}
                  hoverStyle={styles.secondaryButtonHover}
                >
                  <Text style={styles.secondaryButtonText}>استكشف مساحة المشتري</Text>
                </MotionPressable>
              </View>
              <Text style={[typeScale.caption, styles.heroFootnote]}>مساحة مرتبطة بخادم سوقي · تتطلب تسجيل الدخول لإنشاء الطلبات.</Text>
              <View style={styles.scrollHint} pointerEvents="none">
                <Text style={styles.scrollHintText}>اسحب لاستكشاف المساحة</Text>
                <Text style={styles.scrollHintArrow}>↓</Text>
              </View>
            </Animated.View>
            <Animated.View style={[styles.heroVisual, wide && styles.heroVisualWide, !reducedMotion && { transform: [{ translateY: heroVisualShift }] }]}>
              <View style={[styles.visualOrb, styles.decorative]} />
              <View style={[styles.visualArc, styles.decorative]} />
              <View style={[styles.visualPanel, styles.decorative]} />
              <View style={styles.visualTopline}>
                <Text style={styles.visualLabel}>{`المرحلة ${activeJourney.index} · ${activeJourney.label}`}</Text>
                <PulseBadge style={styles.liveBadge}>
                  <View style={styles.liveBadgeInner}>
                    <View style={styles.liveBadgeDot} />
                    <Text style={styles.liveBadgeText}>مساحة نشطة</Text>
                  </View>
                </PulseBadge>
                <Text style={styles.visualCount}>01 — 04</Text>
              </View>
              <View style={styles.visualStageRail}>
                {journeyStages.map((stage, index) => {
                  const selected = index === activeStage;
                  return (
                    <MotionPressable
                      key={stage.index}
                      accessibilityRole="button"
                      accessibilityLabel={`المرحلة ${stage.index}: ${stage.label}`}
                      accessibilityState={{ selected }}
                      onPress={() => setActiveStage(index)}
                      pressScale={0.96}
                      glow={false}
                      style={[styles.visualStageHit, selected && styles.visualStageHitSelected]}
                      pressedStyle={styles.visualStageHitPressed}
                      hoverStyle={styles.visualStageHitHover}
                    >
                      <View style={[styles.visualStageBar, selected && styles.visualStageBarActive]} />
                    </MotionPressable>
                  );
                })}
              </View>
              <View style={styles.visualGraphic}>
                <View style={styles.factoryBuilding}>
                  <View style={styles.factoryRoof} />
                  <View style={styles.factoryRoofSmall} />
                  <View style={styles.factoryWall}>
                    <View style={styles.factoryWindows}>
                      <View style={styles.factoryWindow} />
                      <View style={styles.factoryWindow} />
                      <View style={styles.factoryWindow} />
                    </View>
                    <View style={styles.factoryDoor} />
                  </View>
                  <View style={styles.factoryGround} />
                </View>
                <ScreenEntrance key={activeStage} duration={260} translateY={10} style={styles.visualOverlay}>
                  <View style={styles.routeLine} />
                  <View style={styles.routePoint}><Text style={styles.routePointText}>✓</Text></View>
                  <View style={styles.miniRequestCard}>
                    <View style={styles.miniCardTop}>
                      <View style={styles.miniCardLogo}><Text style={styles.miniCardLogoText}>ن</Text></View>
                      <View style={styles.miniCardTitleArea}>
                        <Text style={styles.miniCardTitle}>{activeJourney.cardTitle}</Text>
                        <Text style={styles.miniCardSubtitle}>{activeJourney.cardSubtitle}</Text>
                      </View>
                      <Text style={styles.miniCardDots}>•••</Text>
                    </View>
                    <View style={styles.miniCardRule} />
                    <View style={styles.miniCardBottom}>
                      <View style={styles.quoteAvatars}>
                        {activeJourney.avatars.map((letter, avatarIndex) => (
                          <View
                            key={avatarIndex}
                            style={[
                              styles.quoteAvatar,
                              avatarIndex === 0 && styles.quoteAvatarOne,
                              avatarIndex === 1 && styles.quoteAvatarTwo,
                              avatarIndex === 2 && styles.quoteAvatarThree,
                            ]}
                          >
                            <Text style={styles.quoteAvatarText}>{letter}</Text>
                          </View>
                        ))}
                      </View>
                      <Text style={styles.quoteCount}>{activeJourney.quoteCount}</Text>
                    </View>
                  </View>
                  <View style={styles.visualStamp}>
                    <Text style={styles.stampNumber}>{activeJourney.stamp}</Text>
                    <Text style={styles.stampLabel}>{activeJourney.stampLabel}</Text>
                  </View>
                  <View style={styles.visualCaption}>
                    <Text style={styles.visualCaptionLine}>{activeJourney.routeLead}</Text>
                    <Text style={styles.visualCaptionLineMuted}>{activeJourney.routeTail}</Text>
                  </View>
                </ScreenEntrance>
              </View>
              <View style={styles.visualFooter}>
                <Text style={styles.visualFooterText}>وضوح في كل خطوة، من المواصفات إلى المتابعة.</Text>
                <View style={styles.visualFooterMark}><Text style={styles.visualFooterMarkText}>↗</Text></View>
              </View>
            </Animated.View>
          </View>
        </View>

        <View style={styles.valueStrip}>
          <View style={[styles.valueInner, { flexDirection: tablet ? 'row-reverse' : 'column', paddingHorizontal: gutter }]}>
            <ValueItem value="مواصفات" label="أوضح من البداية" />
            <View style={styles.valueDivider} />
            <ValueItem value="عروض" label="أسهل في المقارنة" />
            <View style={styles.valueDivider} />
            <ValueItem value="مراحل" label="أقرب للمتابعة" />
            <Text style={styles.valueNote}>مساحة عمل مرتبطة بالخادم · البيانات محفوظة في قاعدة البيانات</Text>
          </View>
        </View>

        <View style={[styles.section, { paddingHorizontal: wide ? 40 : gutter }]}>
          <View style={[styles.sectionHeader, wide && styles.sectionHeaderWide]}>
            <View style={styles.sectionIntro}>
              <Text style={styles.sectionKicker}>مساحة واحدة، قطاعات متعددة</Text>
              <Text style={[typeScale.heading, styles.sectionTitle, wide && styles.sectionTitleWide]}>كل صناعة لها لغتها.</Text>
              <Text style={[typeScale.bodySmall, styles.sectionDescription]}>ابدأ من احتياج منتجك. تتغير أسئلة طلب العروض لتناسب تفاصيل القطاع بدل نموذج واحد للجميع.</Text>
            </View>
            <Text style={styles.sectionAside}>01 / 04</Text>
          </View>
          <View style={styles.journeyTrack}>
            {journeyStages.map((stage, index) => {
              const selected = index === activeStage;
              return (
                <View key={stage.index} style={styles.journeyStop}>
                  <MotionPressable
                    accessibilityRole="button"
                    accessibilityLabel={`المرحلة ${stage.index}: ${stage.label}`}
                    accessibilityState={{ selected }}
                    onPress={() => setActiveStage(index)}
                    style={[styles.journeyHit, selected && styles.journeyHitSelected]}
                    pressedStyle={styles.journeyHitPressed}
                    hoverStyle={styles.journeyHitHover}
                  >
                    <View style={[styles.journeyNode, selected && styles.journeyNodeSelected]}>
                      <Text style={[styles.journeyNodeText, selected && styles.journeyNodeTextSelected]}>{stage.index}</Text>
                    </View>
                  </MotionPressable>
                  {index < journeyStages.length - 1 ? (
                    <View style={[styles.journeySegment, index < activeStage && styles.journeySegmentPassed]} />
                  ) : null}
                </View>
              );
            })}
          </View>
          <View style={styles.journeyCaption} accessible accessibilityLiveRegion="polite">
            <Text style={styles.journeyCaptionLabel}>{activeJourney.label}</Text>
            <Text style={styles.journeyCaptionText}>{activeJourney.caption}</Text>
          </View>
          <View style={[styles.sectorGrid, { flexDirection: tablet ? 'row-reverse' : 'column', flexWrap: 'wrap' }]}>
            {sectors.map((sector, index) => (
              <Stagger
                key={sector.index}
                index={index}
                baseDelay={160}
                step={55}
                duration={300}
                translateY={10}
                style={[
                  styles.sectorCard,
                  sectorSizing,
                  activeSector === sector.index && styles.sectorCardSelected,
                  (hoveredSector === sector.index || pressedSector === sector.index) && styles.sectorCardRaised,
                  focusedSector === sector.index && styles.sectorCardFocused,
                ]}
              >
                <MotionPressable
                  accessibilityRole="button"
                  accessibilityLabel={`${sector.title} — ${sector.note}`}
                  accessibilityState={{ selected: activeSector === sector.index }}
                  onPress={() => {
                    selectSector(sector.index);
                    router.navigate('/rfq/new' as any);
                  }}
                  onPressIn={() => {
                    setPressedSector(sector.index);
                    selectSector(sector.index);
                  }}
                  onPressOut={() => setPressedSector(null)}
                  onHoverIn={() => setHoveredSector(sector.index)}
                  onHoverOut={() => setHoveredSector(null)}
                  onFocus={() => {
                    setFocusedSector(sector.index);
                    selectSector(sector.index);
                  }}
                  onBlur={() => setFocusedSector(null)}
                  pressScale={0.992}
                  style={styles.sectorCardInner}
                  pressedStyle={styles.sectorCardInnerPressed}
                  hoverStyle={styles.sectorCardInnerHover}
                >
                  <View style={styles.sectorTopline}>
                    <Text style={styles.sectorIndex}>{sector.index}</Text>
                    <View style={styles.sectorSymbolWrap}><Text style={styles.sectorSymbol}>{sector.symbol}</Text></View>
                  </View>
                  <View style={styles.sectorBody}>
                    <Text style={styles.sectorTitle}>{sector.title}</Text>
                    <Text style={styles.sectorNote}>{sector.note}</Text>
                  </View>
                  <View style={styles.sectorFooter}>
                    {activeSector === sector.index ? (
                      <PulseBadge style={styles.sectorArrowWrap}>
                        <Text style={styles.sectorArrow}>←</Text>
                      </PulseBadge>
                    ) : (
                      <View style={styles.sectorArrowWrap}><Text style={styles.sectorArrow}>←</Text></View>
                    )}
                  </View>
                </MotionPressable>
              </Stagger>
            ))}
          </View>
        </View>

        <View style={styles.processSection}>
          <View style={[styles.processInner, wide && styles.processInnerWide]}>
            <View style={styles.processLead}>
              <Text style={styles.processKicker}>طريقة عمل أوضح</Text>
              <Text style={[typeScale.heading, styles.processTitle]}>خطوات مرتّبة،{'\n'}وقرارك يبقى بيدك.</Text>
              <Text style={[typeScale.bodySmall, styles.processBody]}>سوقي ينظم رحلة التوريد في مساحة واحدة؛ لا يختار مصنعًا نيابة عنك ولا يضمن جودة أو أسعارًا.</Text>
            </View>
            <View style={styles.processSteps}>
              <ProcessStep number="١" title="صف احتياجك" body="عبّئ مواصفات قطاعك وأرسلها للموردين." last={false} />
              <ProcessStep number="٢" title="قارن الخيارات" body="راجع العروض الواردة وشروط كل عرض." last={false} />
              <ProcessStep number="٣" title="تابع المراحل" body="تابع حالة العينة ومراحل الإنتاج المسجلة." last />
            </View>
          </View>
        </View>

        <View style={[styles.bottomCta, { marginHorizontal: wide ? 42 : 20 }]}>
          <AmbientGlow color={colors.highlight} size={300} style={styles.ctaGlow} duration={3600} min={0.07} max={0.2} />
          <View style={[styles.ctaContent, wide && styles.ctaContentWide]}>
            <View>
              <Text style={styles.ctaKicker}>جاهز لترتيب أول طلب؟</Text>
              <Text style={styles.ctaTitle}>خلّ مواصفاتك تبدأ الحوار.</Text>
            </View>
            <GoldSheenButton
              accessibilityLabel="إنشاء طلب توريد"
              onPress={() => router.navigate('/rfq/new' as any)}
              style={styles.ctaButton}
              pressedStyle={styles.ctaButtonPressed}
              hoverStyle={styles.ctaButtonHover}
            >
              <Text style={styles.ctaButtonText}>إنشاء طلب توريد <Text>←</Text></Text>
            </GoldSheenButton>
          </View>
          <Text style={styles.ctaDisclaimer}>تُحفظ الطلبات والعروض في قاعدة البيانات، وتظهر حسب صلاحياتك ومؤسستك.</Text>
        </View>
        <Text style={styles.footer}>سوقي © ٢٠٢٦ · منصة توريد وتصنيع بين الشركات</Text>
        </ScreenEntrance>
      </ScrollView>
      <Animated.View
        pointerEvents={showBackToTop ? 'auto' : 'none'}
        style={[styles.backToTopWrap, { opacity: backToTopOpacity, transform: [{ translateY: backToTopLift }] }]}
      >
        <MotionPressable
          accessibilityRole="button"
          accessibilityLabel="العودة إلى الأعلى"
          onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: !reducedMotion })}
          style={styles.backToTopButton}
          pressedStyle={styles.backToTopPressed}
          hoverStyle={styles.backToTopHover}
        >
          <Text style={styles.backToTopText}>↑</Text>
        </MotionPressable>
      </Animated.View>
    </SafeAreaView>
  );
}

type GoldSheenButtonProps = {
  children: ReactNode;
  onPress: () => void;
  style: StyleProp<ViewStyle>;
  pressedStyle: StyleProp<ViewStyle>;
  hoverStyle: StyleProp<ViewStyle>;
  accessibilityLabel: string;
};

function GoldSheenButton({ children, onPress, style, pressedStyle, hoverStyle, accessibilityLabel }: GoldSheenButtonProps) {
  const reducedMotion = useReducedMotion();
  const [buttonWidth, setButtonWidth] = useState(0);
  const [sheen] = useState(() => new Animated.Value(-72));
  const sheenOpacity = sheen.interpolate({
    inputRange: [-72, Math.max(buttonWidth, 144) / 2 - 36, Math.max(buttonWidth, 144) + 72],
    outputRange: [0, 0.7, 0],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    sheen.setValue(-72);
    if (reducedMotion || buttonWidth <= 0) return;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(sheen, {
          toValue: buttonWidth + 72,
          duration: 1600,
          easing: Easing.inOut(Easing.quad),
          isInteraction: false,
          useNativeDriver: true,
        }),
        Animated.delay(1300),
        Animated.timing(sheen, { toValue: -72, duration: 0, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [buttonWidth, reducedMotion, sheen]);

  return (
    <MotionPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onLayout={(event) => setButtonWidth(event.nativeEvent.layout.width)}
      style={style}
      pressedStyle={pressedStyle}
      hoverStyle={hoverStyle}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.goldSheen, { opacity: sheenOpacity, transform: [{ translateX: sheen }] }]}
      />
      {children}
    </MotionPressable>
  );
}

function ValueItem({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.valueItem}>
      <Text style={styles.valueStrong}>{value}</Text>
      <Text style={styles.valueLabel}>{label}</Text>
    </View>
  );
}

function ProcessStep({ number, title, body, last }: { number: string; title: string; body: string; last: boolean }) {
  return (
    <View style={styles.processStep}>
      <View style={styles.stepMarker}>
        <Text style={styles.stepNumber}>{number}</Text>
        {!last ? <View style={styles.stepLine} /> : null}
      </View>
      <View style={styles.stepCopy}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepBody}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.cream },
  page: { paddingBottom: 32, backgroundColor: colors.cream },
  pageInner: { width: '100%' },
  decorative: { pointerEvents: 'none' },
  scrollTrack: {
    height: 2,
    backgroundColor: withAlpha(colors.gold, 0.16),
    overflow: 'hidden',
  },
  scrollProgressFill: {
    height: 2,
    position: 'absolute',
    right: 0,
    top: 0,
    backgroundColor: colors.gold,
  },
  backToTopWrap: { position: 'absolute', bottom: 20, left: 0, right: 0, alignItems: 'center', zIndex: 5 },
  backToTopButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.goldDeep,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 6,
  },
  backToTopPressed: { backgroundColor: colors.highlight },
  backToTopHover: { backgroundColor: colors.goldLight },
  backToTopText: { color: colors.obsidian, fontFamily: fonts.bold, fontSize: 20, lineHeight: 24 },
  goldSheen: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 72,
    borderRadius: 10,
    backgroundColor: withAlpha(colors.goldLight, 0.46),
  },

  hero: {
    backgroundColor: colors.obsidian,
    paddingVertical: 64,
    overflow: 'hidden',
    borderBottomWidth: 3,
    borderBottomColor: colors.gold,
  },
  heroGlow: {
    top: -170,
    left: -130,
    width: 430,
    height: 430,
    borderRadius: 215,
  },
  heroGlowAccent: {
    bottom: -160,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
  },
  heroOrb: {
    position: 'absolute',
    top: 36,
    right: -150,
    width: 390,
    height: 390,
    borderRadius: 195,
    borderWidth: 1,
    borderColor: 'rgba(201,154,69,0.18)',
  },
  heroArc: {
    position: 'absolute',
    bottom: -260,
    right: '28%',
    width: 540,
    height: 540,
    borderRadius: 270,
    borderWidth: 1,
    borderColor: 'rgba(226,238,231,0.09)',
  },
  heroInner: containerStyle,
  heroInnerWide: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', gap: 42 },
  heroCopy: { paddingVertical: 6 },
  heroCopyWide: { flex: 1, paddingLeft: 14 },
  eyebrowRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 26 },
  eyebrowDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.highlight },
  eyebrow: { ...typeScale.eyebrow, color: colors.goldLight },
  heroTitle: { color: colors.cream, textAlign: 'right' },
  heroAccent: { color: colors.gold },
  heroDescription: {
    color: 'rgba(248,245,238,0.82)',
    maxWidth: 500,
    marginTop: 22,
    textAlign: 'right',
  },
  heroActions: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, marginTop: 34 },
  heroActionsStack: { flexDirection: 'column', alignItems: 'stretch' },
  primaryButton: {
    backgroundColor: colors.gold,
    paddingHorizontal: 22,
    minWidth: 210,
    minHeight: 52,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: colors.goldDeep,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 4,
  },
  primaryButtonPressed: { backgroundColor: colors.highlight, transform: [{ scale: 0.985 }] },
  primaryButtonHover: { backgroundColor: colors.goldDeep },
  primaryButtonText: {
    color: colors.obsidian,
    fontFamily: fonts.semiBold,
    fontSize: 14,
    lineHeight: 20,
    writingDirection: 'rtl',
  },
  buttonArrow: { fontFamily: fonts.regular, fontSize: 17 },
  secondaryButton: {
    minHeight: 52,
    paddingHorizontal: 20,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: 'rgba(248,245,238,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonPressed: {
    backgroundColor: withAlpha(colors.gold, 0.16),
    borderColor: colors.highlight,
    transform: [{ scale: 0.985 }],
  },
  secondaryButtonHover: {
    backgroundColor: withAlpha(colors.gold, 0.08),
    borderColor: colors.highlight,
  },
  secondaryButtonText: {
    color: colors.cream,
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 19,
    writingDirection: 'rtl',
  },
  heroFootnote: { color: 'rgba(226,238,231,0.68)', marginTop: 18, textAlign: 'right' },
  scrollHint: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginTop: 26 },
  scrollHintText: { color: 'rgba(226,238,231,0.66)', fontFamily: fonts.medium, fontSize: 10, writingDirection: 'rtl' },
  scrollHintArrow: { color: colors.gold, fontFamily: fonts.bold, fontSize: 15 },

  heroVisual: {
    height: 380,
    marginTop: 42,
    borderRadius: 18,
    padding: 20,
    backgroundColor: colors.obsidianSoft,
    borderWidth: 1,
    borderColor: 'rgba(201,154,69,0.32)',
    overflow: 'hidden',
    shadowColor: colors.obsidian,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.3,
    shadowRadius: 28,
    elevation: 8,
  },
  heroVisualWide: { width: 500, maxWidth: '100%', height: 424, marginTop: 0, flexShrink: 1 },
  visualOrb: {
    position: 'absolute',
    top: -74,
    left: -56,
    width: 216,
    height: 216,
    borderRadius: 108,
    backgroundColor: 'rgba(201,154,69,0.11)',
  },
  visualArc: {
    position: 'absolute',
    bottom: -156,
    right: -76,
    width: 306,
    height: 306,
    borderRadius: 153,
    borderWidth: 1,
    borderColor: 'rgba(201,154,69,0.22)',
  },
  visualPanel: {
    position: 'absolute',
    top: 56,
    left: 24,
    width: 134,
    height: 134,
    borderRadius: 24,
    backgroundColor: 'rgba(248,245,238,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(248,245,238,0.06)',
    transform: [{ rotate: '14deg' }],
  },
  visualTopline: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  visualLabel: {
    color: colors.goldLight,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    lineHeight: 18,
    writingDirection: 'rtl',
  },
  visualCount: {
    ...typeScale.numeric,
    color: colors.gold,
    fontSize: 10,
    writingDirection: 'rtl',
  },
  liveBadge: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.4),
    backgroundColor: withAlpha(colors.obsidianDeep, 0.55),
  },
  liveBadgeInner: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4 },
  liveBadgeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.highlight },
  liveBadgeText: {
    color: colors.goldLight,
    fontFamily: fonts.medium,
    fontSize: 8,
    lineHeight: 11,
    writingDirection: 'rtl',
  },
  visualStageRail: { flexDirection: 'row-reverse', gap: 2, marginTop: 8 },
  visualStageHit: {
    flex: 1,
    minWidth: 44,
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  visualStageHitHover: { backgroundColor: withAlpha(colors.gold, 0.08) },
  visualStageHitPressed: { backgroundColor: withAlpha(colors.gold, 0.16) },
  visualStageHitSelected: { backgroundColor: withAlpha(colors.gold, 0.1) },
  visualStageBar: { width: '100%', height: 3, borderRadius: 2, backgroundColor: withAlpha(colors.gold, 0.32) },
  visualStageBarActive: {
    height: 5,
    backgroundColor: colors.highlight,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  visualGraphic: { flex: 1, position: 'relative', marginTop: 10 },
  visualOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  factoryBuilding: { position: 'absolute', right: 12, top: 54, width: '62%', maxWidth: 178, height: 135 },
  factoryRoof: { position: 'absolute', top: 0, right: 0, width: '61%', maxWidth: 108, height: 51, backgroundColor: colors.gold, transform: [{ skewX: '-35deg' }] },
  factoryRoofSmall: { position: 'absolute', top: 20, right: '51%', width: '42%', maxWidth: 75, height: 31, backgroundColor: colors.goldDeep, transform: [{ skewX: '-35deg' }] },
  factoryWall: {
    position: 'absolute',
    right: 0,
    top: 39,
    width: '93%',
    maxWidth: 166,
    height: 83,
    backgroundColor: colors.goldLight,
    borderBottomWidth: 4,
    borderBottomColor: colors.goldDeep,
  },
  factoryWindows: { position: 'absolute', right: 12, top: 15, flexDirection: 'row-reverse', gap: 8 },
  factoryWindow: { width: 27, height: 25, borderWidth: 2, borderColor: colors.goldDeep, backgroundColor: colors.stone },
  factoryDoor: { position: 'absolute', bottom: 0, left: 12, width: 28, height: 43, backgroundColor: colors.obsidian },
  factoryGround: { position: 'absolute', bottom: 7, right: -15, width: '110%', maxWidth: 195, height: 2, backgroundColor: colors.gold },
  routeLine: { position: 'absolute', top: 144, right: 103, width: 145, height: 1, backgroundColor: colors.gold, transform: [{ rotate: '-27deg' }] },
  routePoint: {
    position: 'absolute',
    top: 94,
    right: 189,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
    borderWidth: 4,
    borderColor: colors.obsidianSoft,
  },
  routePointText: { color: colors.greenDark, fontFamily: fonts.bold, fontSize: 13 },
  miniRequestCard: {
    position: 'absolute',
    left: 0,
    top: 28,
    width: '100%',
    maxWidth: 258,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.paper,
    shadowColor: colors.obsidian,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 6,
  },
  miniCardTop: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9 },
  miniCardLogo: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.goldLight,
    borderWidth: 1,
    borderColor: 'rgba(201,154,69,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniCardLogoText: { color: readableGold, fontFamily: fonts.bold, fontSize: 17, writingDirection: 'rtl' },
  miniCardTitleArea: { flex: 1, alignItems: 'flex-end' },
  miniCardTitle: {
    color: colors.ink,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    lineHeight: 18,
    writingDirection: 'rtl',
  },
  miniCardSubtitle: {
    color: colors.inkSoft,
    fontFamily: fonts.regular,
    fontSize: 9,
    lineHeight: 14,
    marginTop: 3,
    writingDirection: 'rtl',
  },
  miniCardDots: { color: colors.inkSoft, fontSize: 12 },
  miniCardRule: { height: 1, backgroundColor: colors.line, marginTop: 13, marginBottom: 10 },
  miniCardBottom: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  quoteAvatars: { flexDirection: 'row-reverse' },
  quoteAvatar: { width: 23, height: 23, borderRadius: 12, borderWidth: 2, borderColor: colors.paper, alignItems: 'center', justifyContent: 'center', marginLeft: -5 },
  quoteAvatarOne: { backgroundColor: colors.clay },
  quoteAvatarTwo: { backgroundColor: colors.green },
  quoteAvatarThree: { backgroundColor: colors.highlight },
  quoteAvatarText: { color: colors.paper, fontFamily: fonts.bold, fontSize: 9, writingDirection: 'rtl' },
  quoteCount: { color: readableGold, fontFamily: fonts.semiBold, fontSize: 9, writingDirection: 'rtl' },
  visualStamp: {
    position: 'absolute',
    left: 15,
    bottom: 2,
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-9deg' }],
    borderWidth: 1,
    borderColor: colors.highlight,
  },
  stampNumber: { color: colors.greenDark, fontFamily: fonts.bold, fontSize: 24, lineHeight: 28 },
  stampLabel: { color: colors.greenDark, fontFamily: fonts.semiBold, fontSize: 8, lineHeight: 11, textAlign: 'center', writingDirection: 'rtl' },
  visualCaption: { position: 'absolute', right: 4, bottom: 12, alignItems: 'flex-end' },
  visualCaptionLine: { color: colors.goldLight, fontFamily: fonts.semiBold, fontSize: 10, writingDirection: 'rtl' },
  visualCaptionLineMuted: { color: 'rgba(226,238,231,0.7)', fontFamily: fonts.regular, fontSize: 9, marginTop: 3, writingDirection: 'rtl' },
  visualFooter: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(201,154,69,0.38)',
    paddingTop: 13,
  },
  visualFooterText: { color: 'rgba(226,238,231,0.78)', fontFamily: fonts.regular, fontSize: 10, writingDirection: 'rtl' },
  visualFooterMark: { width: 26, height: 26, borderRadius: 8, backgroundColor: colors.goldLight, alignItems: 'center', justifyContent: 'center' },
  visualFooterMarkText: { color: readableGold, fontFamily: fonts.bold, fontSize: 14 },

  valueStrip: { backgroundColor: colors.stone, borderBottomWidth: 1, borderBottomColor: colors.line },
  valueInner: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    paddingVertical: 22,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  valueItem: { flexDirection: 'row-reverse', alignItems: 'baseline', gap: 9, paddingVertical: 6 },
  valueStrong: {
    color: readableGold,
    fontFamily: fonts.semiBold,
    fontSize: 15,
    lineHeight: 21,
    writingDirection: 'rtl',
  },
  valueLabel: { color: colors.inkSoft, fontFamily: fonts.regular, fontSize: 12, writingDirection: 'rtl' },
  valueDivider: { width: 1, height: 26, backgroundColor: colors.line },
  valueNote: {
    color: colors.inkSoft,
    fontFamily: fonts.regular,
    fontSize: 9,
    lineHeight: 15,
    maxWidth: 172,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  section: { paddingVertical: 68, maxWidth: 1220, width: '100%', alignSelf: 'center' },
  sectionHeader: { marginBottom: 30 },
  sectionHeaderWide: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end' },
  sectionIntro: { maxWidth: 640 },
  sectionKicker: {
    color: readableGold,
    fontFamily: fonts.semiBold,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.2,
    marginBottom: 12,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  sectionTitle: { color: colors.ink, textAlign: 'right' },
  sectionTitleWide: { fontSize: 36, lineHeight: 46, letterSpacing: -0.4 },
  sectionDescription: { color: colors.inkSoft, marginTop: 12, maxWidth: 490, textAlign: 'right' },
  sectionAside: {
    ...typeScale.numeric,
    color: colors.inkSoft,
    fontSize: 11,
    marginTop: 20,
    writingDirection: 'rtl',
  },
  journeyTrack: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 10, paddingHorizontal: 10 },
  journeyStop: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center' },
  journeyHit: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  journeyHitHover: { backgroundColor: withAlpha(colors.gold, 0.08) },
  journeyHitPressed: { backgroundColor: withAlpha(colors.gold, 0.16) },
  journeyHitSelected: { backgroundColor: withAlpha(colors.gold, 0.14) },
  journeyNode: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.goldLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  journeyNodeSelected: {
    backgroundColor: colors.gold,
    borderColor: colors.highlight,
    shadowColor: colors.goldDeep,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 8,
    elevation: 3,
  },
  journeyNodeText: { ...typeScale.numeric, color: readableGold, fontSize: 8 },
  journeyNodeTextSelected: { color: colors.obsidian, fontFamily: fonts.bold },
  journeySegment: { flex: 1, height: 1, backgroundColor: colors.gold, opacity: 0.35 },
  journeySegmentPassed: { height: 2, opacity: 0.85 },
  journeyCaption: {
    minHeight: 58,
    marginBottom: 24,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.accentSoft,
    borderRightWidth: 2,
    borderRightColor: colors.gold,
  },
  journeyCaptionLabel: {
    color: readableGold,
    fontFamily: fonts.semiBold,
    fontSize: 11,
    lineHeight: 17,
    writingDirection: 'rtl',
  },
  journeyCaptionText: {
    color: colors.inkSoft,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 18,
    marginTop: 2,
    writingDirection: 'rtl',
  },
  sectorGrid: { gap: 14, flexWrap: 'wrap' },
  sectorCard: {
    minHeight: 168,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderTopWidth: 3,
    borderTopColor: colors.gold,
    backgroundColor: colors.paper,
    justifyContent: 'space-between',
  },
  sectorCardInner: { flex: 1, borderRadius: 8 },
  sectorCardInnerPressed: { backgroundColor: withAlpha(colors.gold, 0.12), borderRadius: 8 },
  sectorCardInnerHover: { backgroundColor: withAlpha(colors.gold, 0.05), borderRadius: 8 },
  sectorCardFull: { flexBasis: '100%', flexGrow: 1 },
  sectorCardHalf: { flexBasis: '46%', flexGrow: 1, minHeight: 176 },
  sectorCardQuad: { flexBasis: '22%', flexGrow: 1, minHeight: 186 },
  sectorCardSelected: {
    backgroundColor: colors.accentSoft,
    borderColor: withAlpha(colors.gold, 0.62),
    borderTopColor: colors.goldDeep,
  },
  sectorCardRaised: {
    borderColor: withAlpha(colors.gold, 0.5),
    shadowColor: colors.goldDeep,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 5,
  },
  sectorCardFocused: {
    borderColor: colors.goldDeep,
    borderWidth: 2,
    borderTopWidth: 3,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.32,
    shadowRadius: 10,
    elevation: 6,
  },
  sectorTopline: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  sectorIndex: { ...typeScale.numeric, color: readableGold, fontSize: 10 },
  sectorSymbolWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.mint,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectorSymbol: { color: readableGold, fontSize: 17, fontFamily: fonts.regular },
  sectorBody: { marginTop: 20 },
  sectorTitle: {
    color: colors.ink,
    fontFamily: fonts.semiBold,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  sectorNote: {
    color: colors.inkSoft,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 18,
    marginTop: 6,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  sectorFooter: { flexDirection: 'row-reverse', marginTop: 18 },
  sectorArrowWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.goldLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectorArrow: { color: readableGold, fontSize: 14, fontFamily: fonts.semiBold, marginTop: -1 },

  processSection: {
    backgroundColor: colors.stone,
    paddingHorizontal: 24,
    paddingVertical: 56,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  processInner: { maxWidth: 1120, width: '100%', alignSelf: 'center' },
  processInnerWide: { flexDirection: 'row-reverse', alignItems: 'flex-start', justifyContent: 'space-between', gap: 64 },
  processLead: { flex: 1 },
  processKicker: {
    color: readableGold,
    fontFamily: fonts.semiBold,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.2,
    marginBottom: 12,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  processTitle: { color: colors.ink, textAlign: 'right' },
  processBody: { color: colors.inkSoft, maxWidth: 420, marginTop: 14, textAlign: 'right' },
  processSteps: { flex: 1, marginTop: 28 },
  processStep: { flexDirection: 'row-reverse', minHeight: 84, gap: 16 },
  stepMarker: { alignItems: 'center', width: 34 },
  stepNumber: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.obsidian,
    color: colors.gold,
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 34,
    fontFamily: fonts.bold,
    fontSize: 13,
    writingDirection: 'rtl',
  },
  stepLine: { width: 1, flex: 1, backgroundColor: colors.gold, marginVertical: 6, opacity: 0.6 },
  stepCopy: { flex: 1, alignItems: 'flex-end' },
  stepTitle: {
    color: colors.ink,
    fontFamily: fonts.semiBold,
    fontSize: 14,
    lineHeight: 21,
    writingDirection: 'rtl',
  },
  stepBody: {
    color: colors.inkSoft,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 19,
    marginTop: 5,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  bottomCta: {
    marginTop: 40,
    padding: 26,
    borderRadius: 14,
    backgroundColor: colors.obsidian,
    borderTopWidth: 3,
    borderTopColor: colors.gold,
    overflow: 'hidden',
  },
  ctaGlow: {
    bottom: -150,
    left: -90,
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  ctaContent: { gap: 20 },
  ctaContentWide: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  ctaKicker: {
    color: colors.goldLight,
    fontFamily: fonts.semiBold,
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 1.2,
    marginBottom: 8,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  ctaTitle: {
    color: colors.cream,
    fontFamily: fonts.bold,
    fontSize: 22,
    lineHeight: 31,
    letterSpacing: -0.2,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  ctaButton: {
    minWidth: 190,
    minHeight: 50,
    borderRadius: 10,
    backgroundColor: colors.gold,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: colors.goldDeep,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 4,
  },
  ctaButtonPressed: { backgroundColor: colors.highlight, transform: [{ scale: 0.985 }] },
  ctaButtonHover: { backgroundColor: colors.goldDeep },
  ctaButtonText: {
    color: colors.obsidian,
    fontFamily: fonts.semiBold,
    fontSize: 13,
    lineHeight: 19,
    writingDirection: 'rtl',
  },
  ctaDisclaimer: {
    color: 'rgba(226,238,231,0.7)',
    fontFamily: fonts.regular,
    fontSize: 9,
    lineHeight: 15,
    marginTop: 18,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  footer: {
    color: colors.inkSoft,
    fontFamily: fonts.regular,
    fontSize: 10,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 26,
    paddingHorizontal: 18,
    writingDirection: 'rtl',
  },
});
