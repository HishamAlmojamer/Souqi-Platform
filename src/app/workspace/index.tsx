import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiFeedback } from '@/components/b2b/ApiFeedback';
import { AppHeader } from '@/components/b2b/AppHeader';
import { colors } from '@/components/b2b/palette';
import { containerStyle, useResponsive } from '@/components/b2b/responsive';
import { formatDate, formatNumber, PO_STATUS, RFQ_STATUS, statusInfo } from '@/data/api';
import { usePlatformOverview } from '@/hooks/usePlatformOverview';
import { useAuth } from '@/state/AuthContext';

export default function BuyerWorkspaceScreen() {
  const { isDesktop, gutter } = useResponsive();
  const wide = isDesktop;
  const { account } = useAuth();
  const { rfqs, orderDetails, metrics, activity, loading, error, refetch } = usePlatformOverview();
  const activeOrder = orderDetails.find((order) => order.status !== 'COMPLETED' && order.status !== 'CANCELLED') ?? orderDetails[0];
  const firstName = account?.fullName?.trim().split(/\s+/)[0] ?? 'فريق سوقي';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppHeader active="workspace" />
      <ScrollView contentContainerStyle={[styles.page, { paddingHorizontal: gutter }]} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.headingRow}>
            <View style={styles.headingCopy}>
              <Text style={styles.kicker}>مساحة العمل <Text style={styles.kickerSlash}>/</Text> نظرة عامة</Text>
              <Text style={styles.pageTitle}>أهلًا، {firstName}</Text>
              <Text style={styles.pageDescription}>هذه صورة سريعة عن طلبات التوريد والعينات قيد المتابعة.</Text>
            </View>
            <Link href={'/rfq/new' as any} asChild>
              <Pressable accessibilityRole="button" style={styles.newButton}>
                <Text style={styles.newButtonPlus}>＋</Text>
                <Text style={styles.newButtonText}>طلب عروض جديد</Text>
              </Pressable>
            </Link>
          </View>

          <View style={styles.demoBanner}>
            <View style={styles.demoBannerMark}><Text style={styles.demoBannerMarkText}>i</Text></View>
            <Text style={styles.demoBannerText}>
              البيانات أدناه محفوظة في الخادم وتظهر وفق صلاحياتك وعضوياتك في المؤسسات.
            </Text>
          </View>

          <ApiFeedback loading={loading} error={error} onRetry={refetch} />

          <View style={styles.statsRow}>
            <MetricCard label="طلبات التوريد المنشورة" value={formatNumber(metrics.openRfqs).padStart(2, '0')} detail="طلبات مفتوحة" accent="green" />
            <MetricCard label="العروض الواردة" value={formatNumber(metrics.quoteCount).padStart(2, '0')} detail="للمراجعة والمقارنة" accent="amber" />
            <MetricCard label="عينات تنتظر قرارًا" value={formatNumber(metrics.samplesPending).padStart(2, '0')} detail="حسب أوامر الشراء" accent="blue" />
            <MetricCard label="مراحل إنتاج نشطة" value={formatNumber(metrics.activeMilestones).padStart(2, '0')} detail="من لوحة التنفيذ" accent="ink" />
          </View>

          <View style={[styles.mainGrid, wide && styles.mainGridWide]}>
            <View style={[styles.primaryColumn, wide && styles.primaryColumnWide]}>
              <View style={styles.sectionHeading}>
                <View>
                  <Text style={styles.sectionTitle}>طلبات التوريد</Text>
                  <Text style={styles.sectionSubTitle}>تابع الطلبات وقارن تقدم عروضها</Text>
                </View>
                <Text style={styles.itemCount}>{formatNumber(rfqs.length)} طلبات</Text>
              </View>

              {rfqs.length > 0 ? rfqs.map((request) => {
                const status = statusInfo(RFQ_STATUS, request.status);
                const quoteCount = request._count?.quotes ?? 0;
                return (
                  <Link
                    key={request.id}
                    href={{ pathname: '/rfq/[id]' as any, params: { id: request.id } } as any}
                    asChild
                  >
                    <Pressable accessibilityRole="link" style={styles.requestCard}>
                      <View style={styles.requestTop}>
                        <View style={styles.requestText}>
                          <Text style={styles.requestTitle}>{request.title}</Text>
                          <Text style={styles.requestMeta}>{request.id} <Text style={styles.metaDot}>·</Text> {request.industry?.nameAr ?? '—'}</Text>
                        </View>
                        <StatusPill label={status.label} tone={status.tone} />
                      </View>
                      <Text style={styles.requestSummary} numberOfLines={2}>{request.destination}</Text>
                      <View style={styles.requestBottom}>
                        <View style={styles.requestFacts}>
                          <Text style={styles.requestFact}><Text style={styles.factLabel}>الكمية </Text>{formatNumber(request.quantity)} {request.unit}</Text>
                          <Text style={styles.factDivider}>/</Text>
                          <Text style={styles.requestFact}><Text style={styles.factLabel}>الموعد </Text>{formatDate(request.targetDate)}</Text>
                        </View>
                        <View style={styles.quoteProgress}>
                          <View style={styles.quoteProgressCopy}>
                            <Text style={styles.quoteProgressLabel}>العروض الواردة</Text>
                            <Text style={styles.quoteProgressCount}>{formatNumber(quoteCount)} عروض</Text>
                          </View>
                          <View style={styles.progressTrack}>
                            <View style={[styles.progressFill, { width: `${Math.min(quoteCount * 20, 100)}%` }]} />
                          </View>
                        </View>
                        <Text style={styles.requestArrow}>←</Text>
                      </View>
                    </Pressable>
                  </Link>
                );
              }) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyGlyph}>◇</Text>
                  <Text style={styles.emptyTitle}>لا توجد طلبات بعد</Text>
                  <Text style={styles.emptyBody}>أنشئ طلب عروض لتبدأ تنظيم مواصفات احتياجك.</Text>
                  <Link href={'/rfq/new' as any} asChild>
                    <Pressable accessibilityRole="button" style={styles.emptyButton}><Text style={styles.emptyButtonText}>إنشاء أول طلب</Text></Pressable>
                  </Link>
                </View>
              )}

              <Link href={'/rfq/new' as any} asChild>
                <Pressable accessibilityRole="button" style={styles.addAnother}>
                  <Text style={styles.addAnotherText}>＋ أضف طلب توريد آخر</Text>
                </Pressable>
              </Link>
            </View>

            <View style={[styles.secondaryColumn, wide && styles.secondaryColumnWide]}>
              <View style={styles.panel}>
                <View style={styles.panelHeader}>
                  <View>
                    <Text style={styles.panelTitle}>متابعة التصنيع</Text>
                    <Text style={styles.panelSubtitle}>أحدث أوامر الشراء المرتبطة بحسابك</Text>
                  </View>
                  <Text style={styles.panelIcon}>◷</Text>
                </View>
                {activeOrder ? (
                  <>
                    <View style={styles.manufactureSummary}>
                      <Text style={styles.manufactureName}>{activeOrder.rfq?.title ?? 'أمر توريد'}</Text>
                      <Text style={styles.manufactureId}>PO · {activeOrder.id.slice(0, 8)}</Text>
                    </View>
                    <Text style={styles.orderStatus}>{statusInfo(PO_STATUS, activeOrder.status).label} · {activeOrder.supplierOrg?.displayName ?? '—'}</Text>
                    <View style={styles.milestones}>
                      {(activeOrder.milestones ?? []).length > 0 ? activeOrder.milestones?.slice(0, 5).map((milestone, index, list) => (
                        <Milestone
                          key={milestone.id}
                          title={milestone.code}
                          date={milestone.completedAt ? `اكتمل · ${formatDate(milestone.completedAt)}` : formatDate(milestone.plannedAt)}
                          state={milestone.status === 'DONE' ? 'done' : milestone.status === 'ACTIVE' ? 'active' : 'next'}
                          last={index === list.length - 1}
                        />
                      )) : <Text style={styles.emptyDetail}>لا توجد مراحل مسجلة على هذا الطلب بعد.</Text>}
                    </View>
                    <Link href={'/production' as any} asChild>
                      <Pressable accessibilityRole="button" style={styles.panelLink}>
                        <Text style={styles.panelLinkText}>فتح لوحة التنفيذ</Text>
                      </Pressable>
                    </Link>
                  </>
                ) : (
                  <Text style={styles.emptyDetail}>لا توجد أوامر شراء مرتبطة بحسابك حتى الآن.</Text>
                )}
              </View>

              <View style={[styles.panel, styles.activityPanel]}>
                <View style={styles.panelHeader}>
                  <View>
                    <Text style={styles.panelTitle}>آخر المستجدات</Text>
                    <Text style={styles.panelSubtitle}>من الطلبات وأوامر الشراء</Text>
                  </View>
                  <Text style={styles.activityCount}>{String(activity.length).padStart(2, '0')}</Text>
                </View>
                <View style={styles.activityList}>
                  {activity.length > 0 ? activity.map((item, index) => (
                    <View key={item.id} style={styles.activityItem}>
                      <View style={[styles.activityMarker, index === 0 && styles.activityMarkerActive]}>
                        <Text style={styles.activityMarkerText}>{item.kind === 'quote' ? '↗' : item.kind === 'sample' ? '◇' : item.kind === 'rfq' ? '＋' : '·'}</Text>
                      </View>
                      <View style={styles.activityCopy}>
                        <View style={styles.activityTop}>
                          <Text style={styles.activityTime}>{item.time}</Text>
                          <Text style={styles.activityTitle}>{item.title}</Text>
                        </View>
                        <Text style={styles.activityDetail}>{item.detail}</Text>
                      </View>
                    </View>
                  )) : <Text style={styles.emptyDetail}>لا توجد مستجدات مسجلة بعد.</Text>}
                </View>
              </View>

              <View style={styles.helpPanel}>
                <Text style={styles.helpNumber}>?</Text>
                <View style={styles.helpCopy}>
                  <Text style={styles.helpTitle}>روابط مساعدة</Text>
                  <Text style={styles.helpText}> انتقل إلى سجل الطلبات أو لوحة التنفيذ أو دليل الموردين المرتبط بالخادم.</Text>
                  <Link href={'/orders' as any} asChild>
                    <Pressable accessibilityRole="button" style={styles.suppliersLink}>
                      <Text style={styles.suppliersLinkText}>مركز متابعة الطلبات</Text>
                    </Pressable>
                  </Link>
                  <Link href={'/production' as any} asChild>
                    <Pressable accessibilityRole="button" style={styles.suppliersLink}>
                      <Text style={styles.suppliersLinkText}>لوحة التنفيذ</Text>
                    </Pressable>
                  </Link>
                  <Link href={'/suppliers' as any} asChild>
                    <Pressable accessibilityRole="button" style={styles.suppliersLink}>
                      <Text style={styles.suppliersLinkText}>دليل الموردين</Text>
                    </Pressable>
                  </Link>
                </View>
              </View>
            </View>
          </View>
          <Text style={styles.footer}>سوقي · بيانات الخادم · الحالات لا تمثل التزامات تجارية</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricCard({ label, value, detail, accent }: { label: string; value: string; detail: string; accent: 'green' | 'amber' | 'blue' | 'ink' }) {
  const accentColor = accent === 'green' ? colors.green : accent === 'amber' ? colors.amber : accent === 'blue' ? colors.blue : colors.inkSoft;
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricTop}>
        <Text style={[styles.metricAccent, { backgroundColor: accentColor }]} />
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricDetail}>{detail}</Text>
    </View>
  );
}

function StatusPill({ label, tone }: { label: string; tone: 'green' | 'amber' | 'blue' | 'muted' }) {
  const pillStyles = tone === 'green' ? styles.pillGreen : tone === 'amber' ? styles.pillAmber : tone === 'blue' ? styles.pillBlue : styles.pillMuted;
  return <View style={[styles.pill, pillStyles]}><Text style={[styles.pillText, tone === 'green' ? styles.pillTextGreen : tone === 'amber' ? styles.pillTextAmber : tone === 'blue' ? styles.pillTextBlue : styles.pillTextMuted]}>{label}</Text></View>;
}

function Milestone({ title, date, state, last }: { title: string; date: string; state: 'done' | 'active' | 'next'; last?: boolean }) {
  return (
    <View style={styles.milestone}>
      <View style={styles.milestoneRail}>
        <View style={[styles.milestoneDot, state === 'done' && styles.milestoneDotDone, state === 'active' && styles.milestoneDotActive]}>
          <Text style={styles.milestoneCheck}>{state === 'done' ? '✓' : state === 'active' ? '·' : ''}</Text>
        </View>
        {!last ? <View style={[styles.milestoneLine, state === 'done' && styles.milestoneLineDone]} /> : null}
      </View>
      <View style={styles.milestoneCopy}>
        <Text style={[styles.milestoneTitle, state === 'next' && styles.milestoneTitleNext]}>{title}</Text>
        <Text style={styles.milestoneDate}>{date}</Text>
      </View>
      {state === 'active' ? <Text style={styles.nowLabel}>الآن</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.cream },
  page: { paddingBottom: 28 },
  content: { ...containerStyle, paddingTop: 31 },
  headingRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  headingCopy: { flex: 1, minWidth: 220, alignItems: 'flex-end' },
  kicker: { color: colors.goldDeep, fontSize: 11, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  kickerSlash: { color: '#A8B0A9' },
  pageTitle: { color: colors.ink, fontSize: 26, fontWeight: '900', marginTop: 9, textAlign: 'right', writingDirection: 'rtl' },
  pageDescription: { color: colors.muted, fontSize: 12, marginTop: 7, textAlign: 'right', writingDirection: 'rtl' },
  newButton: { backgroundColor: colors.gold, minHeight: 44, paddingHorizontal: 14, borderRadius: 8, flexDirection: 'row-reverse', alignItems: 'center', gap: 7 },
  newButtonPlus: { color: colors.obsidian, fontSize: 17, fontWeight: '700' },
  newButtonText: { color: colors.obsidian, fontSize: 11, fontWeight: '800', writingDirection: 'rtl' },
  demoBanner: { minHeight: 41, marginTop: 21, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: colors.stone, borderWidth: 1, borderColor: colors.line, borderRadius: 7, flexDirection: 'row-reverse', alignItems: 'center', gap: 9 },
  demoBannerMark: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.goldLight, alignItems: 'center', justifyContent: 'center' },
  demoBannerMarkText: { color: colors.goldDeep, fontSize: 11, fontWeight: '900' },
  demoBannerText: { flex: 1, color: colors.inkSoft, fontSize: 10, lineHeight: 16, textAlign: 'right', writingDirection: 'rtl' },
  statsRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 11, marginTop: 17 },
  metricCard: { flexGrow: 1, flexBasis: 155, minHeight: 117, backgroundColor: colors.paper, borderColor: colors.line, borderWidth: 1, borderRadius: 9, padding: 14 },
  metricTop: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7 },
  metricAccent: { width: 6, height: 6, borderRadius: 3 },
  metricLabel: { color: colors.muted, fontSize: 10, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },
  metricValue: { color: colors.ink, fontSize: 25, fontWeight: '900', marginTop: 12, textAlign: 'right' },
  metricDetail: { color: '#849088', fontSize: 9, marginTop: 4, textAlign: 'right', writingDirection: 'rtl' },
  mainGrid: { marginTop: 26 },
  mainGridWide: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'flex-start', gap: 18 },
  primaryColumn: { flex: 1, minWidth: 260 },
  primaryColumnWide: { flex: 1.43, minWidth: 320 },
  secondaryColumn: { marginTop: 25, minWidth: 260 },
  secondaryColumnWide: { flex: 0.9, minWidth: 280, marginTop: 0 },
  sectionHeading: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  sectionSubTitle: { color: colors.muted, fontSize: 10, marginTop: 4, textAlign: 'right', writingDirection: 'rtl' },
  itemCount: { color: colors.muted, fontSize: 10, writingDirection: 'rtl' },
  requestCard: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 9, paddingHorizontal: 15, paddingVertical: 14, marginBottom: 10 },
  requestTop: { flexDirection: 'row-reverse', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  requestText: { flex: 1, minWidth: 0, alignItems: 'flex-end' },
  requestTitle: { color: colors.ink, fontSize: 13, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  requestMeta: { color: '#79877F', fontSize: 9, marginTop: 5, textAlign: 'right', writingDirection: 'rtl' },
  metaDot: { color: '#B1B8B0' },
  pill: { minHeight: 25, paddingHorizontal: 9, justifyContent: 'center', borderRadius: 5 },
  pillGreen: { backgroundColor: colors.greenLight },
  pillAmber: { backgroundColor: colors.amberLight },
  pillBlue: { backgroundColor: colors.blueLight },
  pillMuted: { backgroundColor: '#EFF0EC' },
  pillText: { fontSize: 9, fontWeight: '800', writingDirection: 'rtl' },
  pillTextGreen: { color: colors.green },
  pillTextAmber: { color: '#8E5B1D' },
  pillTextBlue: { color: '#356477' },
  pillTextMuted: { color: colors.muted },
  requestSummary: { color: colors.inkSoft, fontSize: 10, lineHeight: 17, marginTop: 12, textAlign: 'right', writingDirection: 'rtl' },
  requestBottom: { borderTopWidth: 1, borderTopColor: '#EFF0EB', marginTop: 12, paddingTop: 11, flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  requestFacts: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 },
  requestFact: { color: colors.inkSoft, fontSize: 9, writingDirection: 'rtl' },
  factLabel: { color: '#89958E', fontSize: 9, writingDirection: 'rtl' },
  factDivider: { color: '#B4BDB5', fontSize: 10 },
  quoteProgress: { minWidth: 89 },
  quoteProgressCopy: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 7, marginBottom: 6 },
  quoteProgressLabel: { color: colors.muted, fontSize: 8, writingDirection: 'rtl' },
  quoteProgressCount: { color: colors.green, fontSize: 9, fontWeight: '800', writingDirection: 'rtl' },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: '#E8ECE6', overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: colors.green },
  requestArrow: { color: colors.amber, fontSize: 15, fontWeight: '800' },
  addAnother: { minHeight: 40, borderWidth: 1, borderColor: '#D2D9D0', borderStyle: 'dashed', borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  addAnotherText: { color: colors.green, fontSize: 10, fontWeight: '800', writingDirection: 'rtl' },
  emptyState: { minHeight: 220, backgroundColor: colors.paper, borderRadius: 9, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', padding: 22 },
  emptyGlyph: { color: colors.green, fontSize: 28 },
  emptyTitle: { color: colors.ink, fontSize: 14, fontWeight: '800', marginTop: 9, writingDirection: 'rtl' },
  emptyBody: { color: colors.muted, fontSize: 10, marginTop: 6, textAlign: 'center', writingDirection: 'rtl' },
  emptyButton: { backgroundColor: colors.gold, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 7, marginTop: 13 },
  emptyButtonText: { color: colors.obsidian, fontSize: 10, fontWeight: '800', writingDirection: 'rtl' },
  panel: { padding: 15, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 9 },
  panelHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  panelTitle: { color: colors.ink, fontSize: 13, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  panelSubtitle: { color: colors.muted, fontSize: 9, marginTop: 4, textAlign: 'right', writingDirection: 'rtl' },
  panelIcon: { color: colors.green, fontSize: 19, fontWeight: '700' },
  manufactureSummary: { backgroundColor: colors.cream, borderRadius: 7, padding: 10, marginTop: 14, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 6, borderRightWidth: 2, borderRightColor: colors.gold },
  manufactureName: { color: colors.ink, fontSize: 10, fontWeight: '800', flexShrink: 1, textAlign: 'right', writingDirection: 'rtl' },
  manufactureId: { color: colors.muted, fontSize: 8 },
  orderStatus: { color: colors.green, fontSize: 9, fontWeight: '800', marginTop: 9, textAlign: 'right', writingDirection: 'rtl' },
  milestones: { paddingTop: 13, paddingBottom: 1 },
  milestone: { flexDirection: 'row-reverse', minHeight: 47, alignItems: 'flex-start', gap: 9 },
  milestoneRail: { width: 18, alignItems: 'center', alignSelf: 'stretch' },
  milestoneDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: '#CBD3CB', backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  milestoneDotDone: { backgroundColor: colors.green, borderColor: colors.green },
  milestoneDotActive: { backgroundColor: '#F2D49E', borderColor: '#D8AC63' },
  milestoneCheck: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  milestoneLine: { position: 'absolute', top: 15, bottom: -1, width: 1, backgroundColor: '#D8DED7' },
  milestoneLineDone: { backgroundColor: '#A9C3B3' },
  milestoneCopy: { flex: 1, alignItems: 'flex-end', paddingBottom: 9 },
  milestoneTitle: { color: colors.ink, fontSize: 10, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  milestoneTitleNext: { color: '#76827B', fontWeight: '600' },
  milestoneDate: { color: colors.muted, fontSize: 8, marginTop: 4, textAlign: 'right', writingDirection: 'rtl' },
  nowLabel: { color: '#8B5F23', backgroundColor: colors.amberLight, fontSize: 8, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, writingDirection: 'rtl' },
  panelFootnote: { color: '#87938C', borderTopWidth: 1, borderTopColor: '#EFF0EB', paddingTop: 9, fontSize: 8, textAlign: 'right', writingDirection: 'rtl' },
  panelLink: { marginTop: 10, minHeight: 34, backgroundColor: colors.greenDark, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  panelLinkText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800', writingDirection: 'rtl' },
  emptyDetail: { color: colors.muted, fontSize: 9, marginTop: 12, textAlign: 'right', writingDirection: 'rtl' },
  activityPanel: { marginTop: 12 },
  activityCount: { color: colors.amber, fontSize: 11, fontWeight: '800' },
  activityList: { marginTop: 13 },
  activityItem: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 9, marginBottom: 13 },
  activityMarker: { width: 24, height: 24, borderRadius: 7, backgroundColor: '#F0F1EC', alignItems: 'center', justifyContent: 'center' },
  activityMarkerActive: { backgroundColor: colors.greenLight },
  activityMarkerText: { color: colors.green, fontSize: 13, fontWeight: '800' },
  activityCopy: { flex: 1 },
  activityTop: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  activityTitle: { color: colors.ink, fontSize: 9, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  activityTime: { color: '#89958E', fontSize: 8, writingDirection: 'rtl' },
  activityDetail: { color: colors.muted, fontSize: 8, lineHeight: 13, marginTop: 4, textAlign: 'right', writingDirection: 'rtl' },
  helpPanel: { backgroundColor: '#EEF1E9', borderRadius: 8, marginTop: 12, padding: 12, flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 9 },
  helpNumber: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#DCE6DC', color: colors.green, fontSize: 12, textAlign: 'center', textAlignVertical: 'center', fontWeight: '900' },
  helpCopy: { flex: 1, alignItems: 'flex-end' },
  helpTitle: { color: colors.ink, fontSize: 9, fontWeight: '800', writingDirection: 'rtl' },
  helpText: { color: colors.muted, fontSize: 8, lineHeight: 13, marginTop: 4, textAlign: 'right', writingDirection: 'rtl' },
  suppliersLink: { marginTop: 10, minHeight: 32, paddingHorizontal: 10, borderRadius: 8, backgroundColor: colors.greenDark, justifyContent: 'center' },
  suppliersLinkText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800', writingDirection: 'rtl' },
  footer: { color: '#89948D', fontSize: 9, marginTop: 21, textAlign: 'center', writingDirection: 'rtl' },
});
