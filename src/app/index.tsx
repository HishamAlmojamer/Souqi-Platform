import { useRouter } from 'expo-router';
import { useWindowDimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppHeader } from '@/components/b2b/AppHeader';
import { colors } from '@/components/b2b/palette';
import { fonts, typeScale } from '@/components/b2b/typography';

const sectors = [
  { index: '01', title: 'الملابس والمنسوجات', note: 'من الخامة إلى المنتج النهائي', symbol: '◈' },
  { index: '02', title: 'التغليف والعبوات', note: 'أفكارك بهوية علامتك', symbol: '▧' },
  { index: '03', title: 'الأغذية والمشروبات', note: 'تصنيع وتعبئة للعلامات', symbol: '⌁' },
  { index: '04', title: 'العناية والجمال', note: 'تركيبات ومنتجات خاصة', symbol: '✳' },
];

const journeyStages = ['01', '02', '03', '04'];

export default function LandingScreen() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const wide = width >= 800;
  const tablet = width >= 600;
  const heroTitleStyle = wide ? typeScale.display : tablet ? typeScale.displayMedium : typeScale.displaySmall;
  const sectorSizing = wide ? styles.sectorCardQuad : tablet ? styles.sectorCardHalf : styles.sectorCardFull;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppHeader active="home" />
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { paddingHorizontal: wide ? 44 : 24 }]}>
          <View style={[styles.heroGlow, styles.decorative]} />
          <View style={[styles.heroOrb, styles.decorative]} />
          <View style={[styles.heroArc, styles.decorative]} />
          <View style={[styles.heroInner, wide && styles.heroInnerWide]}>
            <View style={[styles.heroCopy, wide && styles.heroCopyWide]}>
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
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.navigate('/rfq/new' as any)}
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
                >
                  <Text style={styles.primaryButtonText}>ابدأ طلب عروض الأسعار <Text style={styles.buttonArrow}>←</Text></Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.navigate('/workspace' as any)}
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}
                >
                  <Text style={styles.secondaryButtonText}>استكشف مساحة المشتري</Text>
                </Pressable>
              </View>
              <Text style={[typeScale.caption, styles.heroFootnote]}>مساحة مرتبطة بخادم سوقي · تتطلب تسجيل الدخول لإنشاء الطلبات.</Text>
            </View>
            <View style={[styles.heroVisual, wide && styles.heroVisualWide]}>
              <View style={[styles.visualOrb, styles.decorative]} />
              <View style={[styles.visualArc, styles.decorative]} />
              <View style={[styles.visualPanel, styles.decorative]} />
              <View style={styles.visualTopline}>
                <Text style={styles.visualLabel}>رحلة طلب التوريد</Text>
                <Text style={styles.visualCount}>01 — 04</Text>
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
                <View style={styles.routeLine} />
                <View style={styles.routePoint}><Text style={styles.routePointText}>✓</Text></View>
                <View style={styles.miniRequestCard}>
                  <View style={styles.miniCardTop}>
                    <View style={styles.miniCardLogo}><Text style={styles.miniCardLogoText}>ن</Text></View>
                    <View style={styles.miniCardTitleArea}>
                      <Text style={styles.miniCardTitle}>طلب تصنيع جديد</Text>
                      <Text style={styles.miniCardSubtitle}>قمصان قطنية · ٢٬٤٠٠ قطعة</Text>
                    </View>
                    <Text style={styles.miniCardDots}>•••</Text>
                  </View>
                  <View style={styles.miniCardRule} />
                  <View style={styles.miniCardBottom}>
                    <View style={styles.quoteAvatars}>
                      <View style={[styles.quoteAvatar, styles.quoteAvatarOne]}><Text style={styles.quoteAvatarText}>م</Text></View>
                      <View style={[styles.quoteAvatar, styles.quoteAvatarTwo]}><Text style={styles.quoteAvatarText}>ر</Text></View>
                      <View style={[styles.quoteAvatar, styles.quoteAvatarThree]}><Text style={styles.quoteAvatarText}>+</Text></View>
                    </View>
                    <Text style={styles.quoteCount}>٤ عروض قيد المقارنة</Text>
                  </View>
                </View>
                <View style={styles.visualStamp}>
                  <Text style={styles.stampNumber}>٤</Text>
                  <Text style={styles.stampLabel}>عروض{'\n'}للمقارنة</Text>
                </View>
                <View style={styles.visualCaption}>
                  <Text style={styles.visualCaptionLine}>طلبك</Text>
                  <Text style={styles.visualCaptionLineMuted}>← يصل إلى خيارات مناسبة</Text>
                </View>
              </View>
              <View style={styles.visualFooter}>
                <Text style={styles.visualFooterText}>وضوح في كل خطوة، من المواصفات إلى المتابعة.</Text>
                <View style={styles.visualFooterMark}><Text style={styles.visualFooterMarkText}>↗</Text></View>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.valueStrip}>
          <View style={[styles.valueInner, { flexDirection: tablet ? 'row-reverse' : 'column' }]}>
            <ValueItem value="مواصفات" label="أوضح من البداية" />
            <View style={styles.valueDivider} />
            <ValueItem value="عروض" label="أسهل في المقارنة" />
            <View style={styles.valueDivider} />
            <ValueItem value="مراحل" label="أقرب للمتابعة" />
            <Text style={styles.valueNote}>مساحة عمل مرتبطة بالخادم · البيانات محفوظة في قاعدة البيانات</Text>
          </View>
        </View>

        <View style={[styles.section, { paddingHorizontal: wide ? 40 : 22 }]}>
          <View style={[styles.sectionHeader, wide && styles.sectionHeaderWide]}>
            <View style={styles.sectionIntro}>
              <Text style={styles.sectionKicker}>مساحة واحدة، قطاعات متعددة</Text>
              <Text style={[typeScale.heading, styles.sectionTitle, wide && styles.sectionTitleWide]}>كل صناعة لها لغتها.</Text>
              <Text style={[typeScale.bodySmall, styles.sectionDescription]}>ابدأ من احتياج منتجك. تتغير أسئلة طلب العروض لتناسب تفاصيل القطاع بدل نموذج واحد للجميع.</Text>
            </View>
            <Text style={styles.sectionAside}>01 / 04</Text>
          </View>
          <View
            accessibilityLabel="رحلة التوريد: أربع مراحل متتابعة"
            accessible
            style={styles.journeyTrack}
          >
            {journeyStages.map((stage, index) => (
              <View key={stage} style={styles.journeyStop}>
                <View style={styles.journeyNode}>
                  <Text style={styles.journeyNodeText}>{stage}</Text>
                </View>
                {index < journeyStages.length - 1 ? <View style={styles.journeySegment} /> : null}
              </View>
            ))}
          </View>
          <View style={[styles.sectorGrid, { flexDirection: tablet ? 'row-reverse' : 'column' }]}>
            {sectors.map((sector) => (
              <Pressable
                key={sector.index}
                accessibilityRole="button"
                accessibilityLabel={`${sector.title} — ${sector.note}`}
                onPress={() => router.navigate('/rfq/new' as any)}
                style={({ pressed }) => [styles.sectorCard, sectorSizing, pressed && styles.sectorCardPressed]}
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
                  <View style={styles.sectorArrowWrap}><Text style={styles.sectorArrow}>←</Text></View>
                </View>
              </Pressable>
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
          <View style={[styles.ctaGlow, styles.decorative]} />
          <View style={[styles.ctaContent, wide && styles.ctaContentWide]}>
            <View>
              <Text style={styles.ctaKicker}>جاهز لترتيب أول طلب؟</Text>
              <Text style={styles.ctaTitle}>خلّ مواصفاتك تبدأ الحوار.</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.navigate('/rfq/new' as any)}
              style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaButtonPressed]}
            >
              <Text style={styles.ctaButtonText}>إنشاء طلب توريد <Text>←</Text></Text>
            </Pressable>
          </View>
          <Text style={styles.ctaDisclaimer}>تُحفظ الطلبات والعروض في قاعدة البيانات، وتظهر حسب صلاحياتك ومؤسستك.</Text>
        </View>
        <Text style={styles.footer}>سوقي © ٢٠٢٦ · منصة توريد وتصنيع بين الشركات</Text>
      </ScrollView>
    </SafeAreaView>
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
  decorative: { pointerEvents: 'none' },

  hero: {
    backgroundColor: colors.obsidian,
    paddingVertical: 64,
    overflow: 'hidden',
    borderBottomWidth: 3,
    borderBottomColor: colors.gold,
  },
  heroGlow: {
    position: 'absolute',
    top: -170,
    left: -130,
    width: 430,
    height: 430,
    borderRadius: 215,
    backgroundColor: 'rgba(201,154,69,0.13)',
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
  heroInner: { width: '100%', maxWidth: 1180, alignSelf: 'center' },
  heroInnerWide: { flexDirection: 'row-reverse', alignItems: 'center', gap: 42 },
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
    minHeight: 52,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonPressed: { backgroundColor: colors.highlight, transform: [{ scale: 0.985 }] },
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
    backgroundColor: 'rgba(201,154,69,0.15)',
    borderColor: colors.highlight,
    transform: [{ scale: 0.985 }],
  },
  secondaryButtonText: {
    color: colors.cream,
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 19,
    writingDirection: 'rtl',
  },
  heroFootnote: { color: 'rgba(226,238,231,0.68)', marginTop: 18, textAlign: 'right' },

  heroVisual: {
    height: 350,
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
  heroVisualWide: { width: 500, height: 396, marginTop: 0, flexShrink: 0 },
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
  visualGraphic: { flex: 1, position: 'relative', marginTop: 10 },
  factoryBuilding: { position: 'absolute', right: 12, top: 54, width: 178, height: 135 },
  factoryRoof: { position: 'absolute', top: 0, right: 0, width: 108, height: 51, backgroundColor: colors.gold, transform: [{ skewX: '-35deg' }] },
  factoryRoofSmall: { position: 'absolute', top: 20, right: 91, width: 75, height: 31, backgroundColor: colors.goldDeep, transform: [{ skewX: '-35deg' }] },
  factoryWall: {
    position: 'absolute',
    right: 0,
    top: 39,
    width: 166,
    height: 83,
    backgroundColor: colors.goldLight,
    borderBottomWidth: 4,
    borderBottomColor: colors.goldDeep,
  },
  factoryWindows: { position: 'absolute', right: 12, top: 15, flexDirection: 'row-reverse', gap: 8 },
  factoryWindow: { width: 27, height: 25, borderWidth: 2, borderColor: colors.goldDeep, backgroundColor: colors.stone },
  factoryDoor: { position: 'absolute', bottom: 0, left: 12, width: 28, height: 43, backgroundColor: colors.obsidian },
  factoryGround: { position: 'absolute', bottom: 7, right: -15, width: 195, height: 2, backgroundColor: colors.gold },
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
    width: 258,
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
  miniCardLogoText: { color: colors.goldDeep, fontFamily: fonts.bold, fontSize: 17, writingDirection: 'rtl' },
  miniCardTitleArea: { flex: 1, alignItems: 'flex-end' },
  miniCardTitle: {
    color: colors.ink,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    lineHeight: 18,
    writingDirection: 'rtl',
  },
  miniCardSubtitle: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 9,
    lineHeight: 14,
    marginTop: 3,
    writingDirection: 'rtl',
  },
  miniCardDots: { color: colors.muted, fontSize: 12 },
  miniCardRule: { height: 1, backgroundColor: colors.line, marginTop: 13, marginBottom: 10 },
  miniCardBottom: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  quoteAvatars: { flexDirection: 'row-reverse' },
  quoteAvatar: { width: 23, height: 23, borderRadius: 12, borderWidth: 2, borderColor: colors.paper, alignItems: 'center', justifyContent: 'center', marginLeft: -5 },
  quoteAvatarOne: { backgroundColor: colors.clay },
  quoteAvatarTwo: { backgroundColor: colors.green },
  quoteAvatarThree: { backgroundColor: colors.highlight },
  quoteAvatarText: { color: colors.paper, fontFamily: fonts.bold, fontSize: 9, writingDirection: 'rtl' },
  quoteCount: { color: colors.goldDeep, fontFamily: fonts.semiBold, fontSize: 9, writingDirection: 'rtl' },
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
  visualFooterMarkText: { color: colors.goldDeep, fontFamily: fonts.bold, fontSize: 14 },

  valueStrip: { backgroundColor: colors.stone, borderBottomWidth: 1, borderBottomColor: colors.line },
  valueInner: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 22,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  valueItem: { flexDirection: 'row-reverse', alignItems: 'baseline', gap: 9, paddingVertical: 6 },
  valueStrong: {
    color: colors.goldDeep,
    fontFamily: fonts.semiBold,
    fontSize: 15,
    lineHeight: 21,
    writingDirection: 'rtl',
  },
  valueLabel: { color: colors.inkSoft, fontFamily: fonts.regular, fontSize: 12, writingDirection: 'rtl' },
  valueDivider: { width: 1, height: 26, backgroundColor: colors.line },
  valueNote: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 9,
    lineHeight: 15,
    maxWidth: 172,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  section: { paddingVertical: 68, maxWidth: 1220, width: '100%', alignSelf: 'center' },
  sectionHeader: { marginBottom: 30 },
  sectionHeaderWide: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-end' },
  sectionIntro: { maxWidth: 640 },
  sectionKicker: {
    color: colors.clay,
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
  sectionDescription: { color: colors.muted, marginTop: 12, maxWidth: 490, textAlign: 'right' },
  sectionAside: {
    ...typeScale.numeric,
    color: colors.muted,
    fontSize: 11,
    marginTop: 20,
    writingDirection: 'rtl',
  },
  journeyTrack: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 20, paddingHorizontal: 10 },
  journeyStop: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center' },
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
  journeyNodeText: { ...typeScale.numeric, color: colors.goldDeep, fontSize: 8 },
  journeySegment: { flex: 1, height: 1, backgroundColor: colors.gold, opacity: 0.55 },
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
  sectorCardFull: { flexBasis: '100%', flexGrow: 1 },
  sectorCardHalf: { flexBasis: '46%', flexGrow: 1, minHeight: 176 },
  sectorCardQuad: { flexBasis: '22%', flexGrow: 1, minHeight: 186 },
  sectorCardPressed: {
    backgroundColor: colors.goldLight,
    borderColor: 'rgba(201,154,69,0.6)',
    borderTopColor: colors.goldDeep,
    transform: [{ scale: 0.992 }],
  },
  sectorTopline: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  sectorIndex: { ...typeScale.numeric, color: colors.goldDeep, fontSize: 10 },
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
  sectorSymbol: { color: colors.clay, fontSize: 17, fontFamily: fonts.regular },
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
    color: colors.muted,
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
  sectorArrow: { color: colors.goldDeep, fontSize: 14, fontFamily: fonts.semiBold, marginTop: -1 },

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
    color: colors.clay,
    fontFamily: fonts.semiBold,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.2,
    marginBottom: 12,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  processTitle: { color: colors.ink, textAlign: 'right' },
  processBody: { color: colors.muted, maxWidth: 420, marginTop: 14, textAlign: 'right' },
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
    color: colors.muted,
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
    position: 'absolute',
    bottom: -150,
    left: -90,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(201,154,69,0.12)',
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
    minHeight: 50,
    borderRadius: 10,
    backgroundColor: colors.gold,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonPressed: { backgroundColor: colors.highlight, transform: [{ scale: 0.985 }] },
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
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 10,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 26,
    paddingHorizontal: 18,
    writingDirection: 'rtl',
  },
});
