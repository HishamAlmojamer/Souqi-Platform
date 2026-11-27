import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiFeedback } from '@/components/b2b/ApiFeedback';
import { AppHeader } from '@/components/b2b/AppHeader';
import { FeedbackBanner, MotionPressable, ScreenEntrance, useEntranceStyle } from '@/components/b2b/motion';
import { colors } from '@/components/b2b/palette';
import { containerStyle, useResponsive } from '@/components/b2b/responsive';
import {
  errorMessage,
  formatDate,
  formatNumber,
  MILESTONE_STATUS,
  PO_STATUS,
  SAMPLE_STATUS,
  statusInfo,
  useApiMutation,
  type ApiMilestone,
  type ApiSample,
  type Tone,
} from '@/data/api';
import { usePlatformOverview } from '@/hooks/usePlatformOverview';
import { useAuth } from '@/state/AuthContext';

type SampleAction = { label: string; status: string };

function sampleActionsFor(status: string | null): SampleAction[] {
  if (!status) return [];
  switch (status) {
    case 'REQUESTED': return [{ label: 'بدء التجهيز', status: 'IN_PREPARATION' }];
    case 'IN_PREPARATION': return [{ label: 'تسجيل الشحن', status: 'SHIPPED' }];
    case 'SHIPPED': return [{ label: 'تسجيل الاستلام', status: 'RECEIVED' }];
    case 'RECEIVED': return [
      { label: 'اعتماد العينة', status: 'APPROVED' },
      { label: 'طلب تعديل', status: 'REVISION_REQUESTED' },
    ];
    case 'REVISION_REQUESTED': return [{ label: 'إعادة التجهيز', status: 'IN_PREPARATION' }];
    default: return [];
  }
}

export default function ProductionScreen() {
  const { isDesktop, gutter } = useResponsive();
  const wide = isDesktop;
  const { hasPermission } = useAuth();
  const { purchaseOrders, orderDetails, metrics, loading, error, refetch } = usePlatformOverview();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const activeId = selectedId && orderDetails.some((order) => order.id === selectedId)
    ? selectedId
    : (orderDetails[0]?.id ?? null);
  const activeOrder = orderDetails.find((order) => order.id === activeId) ?? null;
  const milestones = activeOrder?.milestones ?? [];
  const samples = activeOrder?.samples ?? [];
  const doneCount = milestones.filter((milestone) => milestone.status === 'DONE').length;
  const progress = milestones.length > 0 ? Math.round((doneCount / milestones.length) * 100) : 0;
  const activeMilestone = milestones.find((milestone) => milestone.status === 'ACTIVE')
    ?? milestones.find((milestone) => milestone.status === 'PENDING')
    ?? milestones.find((milestone) => milestone.status === 'BLOCKED')
    ?? null;
  const latestSample = samples[0] ?? null;
  const latestSampleStatus = latestSample?.status ?? null;
  const orderStatus = activeOrder ? statusInfo(PO_STATUS, activeOrder.status) : null;

  const supplierSignals = useMemo(() => {
    const seen = new Set<string>();
    return orderDetails.flatMap((order) => {
      const name = order.supplierOrg?.displayName;
      if (!name || seen.has(name)) return [];
      seen.add(name);
      return [{ id: `${order.id}-${name}`, name, status: statusInfo(PO_STATUS, order.status) }];
    }).slice(0, 5);
  }, [orderDetails]);

  const sampleActions = sampleActionsFor(latestSampleStatus);

  const milestoneMutation = useApiMutation<{ milestone: ApiMilestone }>();
  const sampleMutation = useApiMutation<{ sample: ApiSample }>();
  const working = milestoneMutation.isPending || sampleMutation.isPending;

  async function updateMilestone(status: 'ACTIVE' | 'DONE' | 'BLOCKED') {
    if (!activeMilestone) return;
    setActionError(null);
    try {
      await milestoneMutation.mutateAsync({
        path: `/api/milestones/${activeMilestone.id}/status`,
        method: 'POST',
        body: { status },
      });
    } catch (actionFailure) {
      setActionError(errorMessage(actionFailure));
    }
  }

  async function updateSample(status: string) {
    if (!latestSample) return;
    setActionError(null);
    try {
      await sampleMutation.mutateAsync({
        path: `/api/samples/${latestSample.id}/status`,
        method: 'POST',
        body: {
          status,
          ...(status === 'SHIPPED' ? { shippedAt: new Date().toISOString() } : {}),
          ...(status === 'RECEIVED' ? { receivedAt: new Date().toISOString() } : {}),
        },
      });
    } catch (actionFailure) {
      setActionError(errorMessage(actionFailure));
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppHeader active="production" />
      <ScrollView contentContainerStyle={[styles.page, { paddingHorizontal: gutter }]} showsVerticalScrollIndicator={false}>
        <ScreenEntrance style={styles.content}>
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.kicker}>لوحة التنفيذ</Text>
              <Text style={styles.pageTitle}>مراقبة الإنتاج والعينات</Text>
              <Text style={styles.pageSubtitle}>تابع مراحل أوامر الشراء وحالات العينات من البيانات المسجلة في الخادم.</Text>
            </View>
            <Link href={'/workspace' as any} asChild>
              <MotionPressable accessibilityRole="button" style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>عودة لمساحة المشتري</Text>
              </MotionPressable>
            </Link>
          </View>

          <ApiFeedback loading={loading} error={error} onRetry={refetch} />

          <View style={styles.statsRow}>
            <MetricCard label="أوامر الشراء" value={formatNumber(purchaseOrders.length).padStart(2, '0')} detail="المرتبطة بحسابك" delay={40} />
            <MetricCard label="عينات تنتظر قرارًا" value={formatNumber(metrics.samplesPending).padStart(2, '0')} detail="بانتظار المتابعة" delay={85} />
            <MetricCard label="مراحل نشطة" value={formatNumber(metrics.activeMilestones).padStart(2, '0')} detail="قيد التنفيذ" delay={130} />
            <MetricCard label="أوامر مكتملة" value={formatNumber(purchaseOrders.filter((order) => order.status === 'COMPLETED').length).padStart(2, '0')} detail="تم تسليمها" delay={175} />
          </View>

          {purchaseOrders.length > 0 ? (
            <View style={styles.orderPicker}>
              <Text style={styles.pickerLabel}>اختر أمر الشراء</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerList}>
                {orderDetails.map((order) => {
                  const selected = order.id === activeId;
                  return (
                    <MotionPressable
                      key={order.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => { setSelectedId(order.id); setActionError(null); }}
                      style={[styles.pickerChip, selected && styles.pickerChipActive]}
                    >
                      <Text style={[styles.pickerChipName, selected && styles.pickerChipNameActive]} numberOfLines={1}>
                        {order.rfq?.title ?? 'أمر توريد'}
                      </Text>
                      <Text style={[styles.pickerChipId, selected && styles.pickerChipIdActive]}>PO · {order.id.slice(0, 8)}</Text>
                    </MotionPressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          {activeOrder && orderStatus ? (
            <View style={[styles.mainGrid, wide && styles.mainGridWide]}>
              <View style={styles.primaryColumn}>
                <View style={styles.panel}>
                  <View style={styles.panelHeader}>
                    <View>
                      <Text style={styles.panelTitle}>أمر الإنتاج المحدد</Text>
                      <Text style={styles.panelSubtitle}>PO · {activeOrder.id.slice(0, 8)}</Text>
                    </View>
                    <View style={styles.panelHeaderActions}>
                      <Link
                        href={{ pathname: '/orders/[id]' as any, params: { id: activeOrder.id } } as any}
                        asChild
                      >
                        <MotionPressable accessibilityRole="link" style={styles.detailLink}>
                          <Text style={styles.detailLinkText}>تفاصيل الأمر ←</Text>
                        </MotionPressable>
                      </Link>
                      <ToneBadge label={orderStatus.label} tone={orderStatus.tone} />
                    </View>
                  </View>

                  <View style={styles.orderCard}>
                    <View style={styles.orderHeader}>
                      <View>
                        <Text style={styles.orderTitle}>{activeOrder.rfq?.title ?? 'أمر توريد'}</Text>
                        <Text style={styles.orderMeta}>
                          {formatNumber(activeOrder.rfq?.quantity ?? 0)} {activeOrder.rfq?.unit ?? ''} · مراجعة {formatNumber(activeOrder.quote?.revision ?? 0)}
                        </Text>
                      </View>
                      <Text style={styles.orderPercent}>{formatNumber(progress)}%</Text>
                    </View>

                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${progress}%` }]} />
                    </View>

                    <View style={styles.orderFacts}>
                      <View style={styles.factBlock}>
                        <Text style={styles.factLabel}>المورد</Text>
                        <Text style={styles.factValue}>{activeOrder.supplierOrg?.displayName ?? '—'}</Text>
                      </View>
                      <View style={styles.factBlock}>
                        <Text style={styles.factLabel}>المرحلة التالية</Text>
                        <Text style={styles.factValue}>{activeMilestone?.code ?? '—'}</Text>
                      </View>
                      <View style={styles.factBlock}>
                        <Text style={styles.factLabel}>موعد مخطط</Text>
                        <Text style={styles.factValue}>{formatDate(activeMilestone?.plannedAt)}</Text>
                      </View>
                    </View>
                  </View>
                </View>

                <View style={[styles.panel, styles.timelinePanel]}>
                  <View style={styles.panelHeader}>
                    <View>
                      <Text style={styles.panelTitle}>جدول المراحل</Text>
                      <Text style={styles.panelSubtitle}>
                        {activeMilestone
                          ? `المرحلة الحالية: ${activeMilestone.code} · ${statusInfo(MILESTONE_STATUS, activeMilestone.status).label}`
                          : 'لا توجد مراحل مسجلة لهذا الطلب'}
                      </Text>
                    </View>
                    <Text style={styles.panelIcon}>↗</Text>
                  </View>

                  <View style={styles.timelineList}>
                    {milestones.length > 0 ? milestones.map((milestone, index) => {
                      const state = milestone.status === 'DONE'
                        ? 'done'
                        : milestone.status === 'ACTIVE'
                          ? 'active'
                          : milestone.status === 'BLOCKED'
                            ? 'blocked'
                            : 'next';
                      return (
                        <View key={milestone.id} style={styles.timelineItem}>
                          <View style={[
                            styles.timelineMarker,
                            state === 'done' && styles.timelineMarkerDone,
                            state === 'active' && styles.timelineMarkerActive,
                            state === 'blocked' && styles.timelineMarkerBlocked,
                          ]}>
                            <Text style={styles.timelineMarkerText}>{state === 'done' ? '✓' : state === 'active' ? '•' : state === 'blocked' ? '!' : ''}</Text>
                          </View>
                          <View style={styles.timelineCopy}>
                            <Text style={styles.timelineTitle}>{milestone.code}</Text>
                            <Text style={styles.timelineDate}>
                              {milestone.completedAt
                                ? `اكتمل · ${formatDate(milestone.completedAt)}`
                                : milestone.plannedAt
                                  ? formatDate(milestone.plannedAt)
                                  : statusInfo(MILESTONE_STATUS, milestone.status).label}
                            </Text>
                            {milestone.note ? <Text style={styles.timelineNote}>{milestone.note}</Text> : null}
                          </View>
                          {index < milestones.length - 1 ? <View style={styles.timelineLine} /> : null}
                        </View>
                      );
                    }) : (
                      <Text style={styles.emptyDetail}>لم يضف المورد مراحل إنتاج لهذا الطلب بعد.</Text>
                    )}
                  </View>

                  {activeMilestone && hasPermission('milestone.manage') ? (
                    <View style={styles.actionRow}>
                      {activeMilestone.status === 'PENDING' ? (
                        <MotionPressable accessibilityRole="button" disabled={working} onPress={() => { void updateMilestone('ACTIVE'); }} style={styles.actionButton}>
                          <Text style={styles.actionButtonText}>{working ? 'جارٍ التحديث…' : 'بدء المرحلة'}</Text>
                        </MotionPressable>
                      ) : null}
                      {activeMilestone.status === 'ACTIVE' ? (
                        <MotionPressable accessibilityRole="button" disabled={working} onPress={() => { void updateMilestone('DONE'); }} style={styles.actionButton}>
                          <Text style={styles.actionButtonText}>{working ? 'جارٍ التحديث…' : 'إكمال المرحلة'}</Text>
                        </MotionPressable>
                      ) : null}
                      {activeMilestone.status === 'BLOCKED' ? (
                        <MotionPressable accessibilityRole="button" disabled={working} onPress={() => { void updateMilestone('ACTIVE'); }} style={styles.actionButton}>
                          <Text style={styles.actionButtonText}>{working ? 'جارٍ التحديث…' : 'إعادة التشغيل'}</Text>
                        </MotionPressable>
                      ) : null}
                      {activeMilestone.status !== 'DONE' ? (
                        <MotionPressable accessibilityRole="button" disabled={working} onPress={() => { void updateMilestone('BLOCKED'); }} style={styles.secondaryActionButton}>
                          <Text style={styles.secondaryActionText}>{working ? 'جارٍ التحديث…' : 'توقف'}</Text>
                        </MotionPressable>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              </View>

              <View style={styles.secondaryColumn}>
                <View style={styles.panel}>
                  <View style={styles.panelHeader}>
                    <View>
                      <Text style={styles.panelTitle}>مراجعة العينات</Text>
                      <Text style={styles.panelSubtitle}>{formatNumber(samples.length)} إصدارات مسجلة</Text>
                    </View>
                    <Text style={styles.panelIcon}>✓</Text>
                  </View>

                  <View style={styles.checkList}>
                    {samples.length > 0 ? samples.map((sample) => {
                      const sampleStatus = statusInfo(SAMPLE_STATUS, sample.status);
                      const approved = sample.status === 'APPROVED';
                      return (
                        <View key={sample.id} style={styles.checkRow}>
                          <View style={[styles.checkMark, approved && styles.checkMarkActive]}>
                            <Text style={styles.checkMarkText}>{approved ? '✓' : '·'}</Text>
                          </View>
                          <View style={styles.checkCopy}>
                            <Text style={styles.checkText}>العينة {formatNumber(sample.version)} · {sampleStatus.label}</Text>
                            <Text style={styles.checkDate}>{formatDate(sample.receivedAt ?? sample.shippedAt ?? sample.createdAt)}</Text>
                            {sample.notes ? <Text style={styles.checkNote}>{sample.notes}</Text> : null}
                          </View>
                        </View>
                      );
                    }) : (
                      <Text style={styles.emptyDetail}>لا توجد عينات مسجلة على هذا الطلب بعد.</Text>
                    )}
                  </View>

                  {latestSample && sampleActions.length > 0 && hasPermission('sample.manage') ? (
                    <View style={styles.sampleActions}>
                      {sampleActions.map((action) => (
                        <MotionPressable
                          key={action.status}
                          accessibilityRole="button"
                          disabled={working}
                          onPress={() => { void updateSample(action.status); }}
                          style={styles.sampleActionButton}
                        >
                          <Text style={styles.sampleActionText}>{working ? 'جارٍ التحديث…' : action.label}</Text>
                        </MotionPressable>
                      ))}
                    </View>
                  ) : null}
                </View>

                <View style={[styles.panel, styles.sidePanel]}>
                  <View style={styles.panelHeader}>
                    <View>
                      <Text style={styles.panelTitle}>إشارات الموردين</Text>
                      <Text style={styles.panelSubtitle}>حالة أوامر الشراء الحالية</Text>
                    </View>
                    <Text style={styles.panelIcon}>⚑</Text>
                  </View>

                  <View style={styles.signalList}>
                    {supplierSignals.length > 0 ? supplierSignals.map((item) => (
                      <View key={item.id} style={styles.signalItem}>
                        <View style={[styles.signalDot, dotStyle(item.status.tone)]} />
                        <View style={styles.signalCopy}>
                          <Text style={styles.signalName}>{item.name}</Text>
                          <Text style={styles.signalStatus}>{item.status.label}</Text>
                        </View>
                      </View>
                    )) : (
                      <Text style={styles.emptyDetail}>لا توجد إشارات متاحة.</Text>
                    )}
                  </View>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyGlyph}>◇</Text>
              <Text style={styles.emptyTitle}>لا توجد أوامر شراء بعد</Text>
              <Text style={styles.emptyBody}>تظهر هنا أوامر الشراء بعد ترسية العروض واعتماد الطلبات.</Text>
              <Link href={'/orders' as any} asChild>
                <MotionPressable accessibilityRole="button" style={styles.emptyButton}>
                  <Text style={styles.emptyButtonText}>فتح مركز الطلبات</Text>
                </MotionPressable>
              </Link>
            </View>
          )}

          {actionError ? <FeedbackBanner text={actionError} tone="error" /> : null}

          <View style={[styles.bottomPanel, wide && styles.bottomPanelWide]}>
            <View style={styles.bottomHeader}>
              <Text style={styles.bottomTitle}>الخطة القادمة</Text>
              <Text style={styles.bottomAction}>بيانات الخادم</Text>
            </View>

            <View style={styles.bottomGrid}>
              <View style={styles.bottomCard}>
                <Text style={styles.bottomCardTitle}>العينات المسجلة</Text>
                <Text style={styles.bottomCardValue}>{formatNumber(samples.length)}</Text>
                <Text style={styles.bottomCardText}>الإصدارات المرتبطة بأمر الشراء المحدد.</Text>
              </View>
              <View style={styles.bottomCard}>
                <Text style={styles.bottomCardTitle}>المرحلة التالية</Text>
                <Text style={styles.bottomCardValue}>{activeMilestone?.code ?? '—'}</Text>
                <Text style={styles.bottomCardText}>تتحدث حالتها مباشرة من لوحة المورد.</Text>
              </View>
              <View style={styles.bottomCard}>
                <Text style={styles.bottomCardTitle}>تاريخ مخطط</Text>
                <Text style={styles.bottomCardValue}>{formatDate(activeMilestone?.plannedAt)}</Text>
                <Text style={styles.bottomCardText}>حسب خطة الإنتاج المسجلة للطلب.</Text>
              </View>
            </View>
          </View>
        </ScreenEntrance>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricCard({ label, value, detail, delay = 0 }: { label: string; value: string; detail: string; delay?: number }) {
  const entranceStyle = useEntranceStyle({ delay, duration: 300, translateY: 8 });
  return (
    <Animated.View style={[styles.metricCard, entranceStyle]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricDetail}>{detail}</Text>
    </Animated.View>
  );
}

function ToneBadge({ label, tone }: { label: string; tone: Tone }) {
  const toneStyle = tone === 'green' ? styles.badgeGreen : tone === 'amber' ? styles.badgeAmber : tone === 'blue' ? styles.badgeBlue : styles.badgeMuted;
  return (
    <View style={[styles.badge, toneStyle]}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

function dotStyle(tone: Tone) {
  return tone === 'green' ? styles.signalDotGreen : tone === 'amber' ? styles.signalDotAmber : tone === 'blue' ? styles.signalDotBlue : styles.signalDotMuted;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.cream },
  page: { paddingBottom: 32 },
  content: { ...containerStyle, paddingTop: 28 },
  headerRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14 },
  headerCopy: { flex: 1, minWidth: 240, alignItems: 'flex-end' },
  kicker: { color: colors.goldDeep, fontSize: 11, fontWeight: '800', writingDirection: 'rtl' },
  pageTitle: { color: colors.ink, fontSize: 28, fontWeight: '900', marginTop: 8, textAlign: 'right', writingDirection: 'rtl' },
  pageSubtitle: { color: colors.muted, fontSize: 12, marginTop: 8, maxWidth: 560, textAlign: 'right', writingDirection: 'rtl' },
  secondaryButton: { backgroundColor: colors.goldLight, borderRadius: 10, minHeight: 42, paddingHorizontal: 14, justifyContent: 'center' },
  secondaryButtonText: { color: colors.goldDeep, fontSize: 11, fontWeight: '800', writingDirection: 'rtl' },
  statsRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 12, marginTop: 22 },
  metricCard: { flexGrow: 1, flexBasis: 180, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 14 },
  metricLabel: { color: colors.muted, fontSize: 10, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },
  metricValue: { color: colors.ink, fontSize: 27, fontWeight: '900', marginTop: 10, textAlign: 'right' },
  metricDetail: { color: '#88928A', fontSize: 9, marginTop: 5, textAlign: 'right', writingDirection: 'rtl' },
  orderPicker: { marginTop: 20 },
  pickerLabel: { color: colors.inkSoft, fontSize: 10, fontWeight: '800', marginBottom: 8, textAlign: 'right', writingDirection: 'rtl' },
  pickerList: { flexDirection: 'row-reverse', gap: 8, paddingVertical: 2 },
  pickerChip: { minWidth: 150, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 8 },
  pickerChipActive: { backgroundColor: colors.greenDark, borderColor: colors.greenDark },
  pickerChipName: { color: colors.ink, fontSize: 10, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  pickerChipNameActive: { color: '#FFFFFF' },
  pickerChipId: { color: colors.muted, fontSize: 8, marginTop: 4, textAlign: 'right' },
  pickerChipIdActive: { color: '#DCE7DF' },
  mainGrid: { marginTop: 20, flexDirection: 'column', gap: 18 },
  mainGridWide: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'flex-start' },
  primaryColumn: { flex: 1.3, minWidth: 280 },
  secondaryColumn: { flex: 0.9, minWidth: 260, gap: 18 },
  panel: { backgroundColor: colors.paper, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 16 },
  panelHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  panelHeaderActions: { flexDirection: 'row-reverse', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  detailLink: { minHeight: 32, paddingHorizontal: 10, borderRadius: 7, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center' },
  detailLinkText: { color: colors.greenDark, fontSize: 9, fontWeight: '800', writingDirection: 'rtl' },
  panelTitle: { color: colors.ink, fontSize: 13, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  panelSubtitle: { color: colors.muted, fontSize: 9, marginTop: 4, textAlign: 'right', writingDirection: 'rtl' },
  badge: { minHeight: 24, paddingHorizontal: 9, borderRadius: 6, justifyContent: 'center' },
  badgeGreen: { backgroundColor: colors.greenLight },
  badgeAmber: { backgroundColor: colors.amberLight },
  badgeBlue: { backgroundColor: colors.blueLight },
  badgeMuted: { backgroundColor: '#EFF0EC' },
  badgeText: { color: colors.inkSoft, fontSize: 9, fontWeight: '800', writingDirection: 'rtl' },
  panelIcon: { color: colors.green, fontSize: 18, fontWeight: '800' },
  orderCard: { marginTop: 16, backgroundColor: colors.cream, borderRadius: 10, padding: 14, borderRightWidth: 2, borderRightColor: colors.gold },
  orderHeader: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  orderTitle: { color: colors.ink, fontSize: 16, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  orderMeta: { color: colors.muted, fontSize: 9, marginTop: 5, textAlign: 'right', writingDirection: 'rtl' },
  orderPercent: { color: colors.greenDark, fontSize: 18, fontWeight: '900' },
  progressTrack: { height: 8, borderRadius: 6, backgroundColor: '#E7E9E2', marginTop: 14, overflow: 'hidden', flexDirection: 'row-reverse' },
  progressFill: { height: '100%', borderRadius: 6, backgroundColor: colors.green },
  orderFacts: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, marginTop: 16 },
  factBlock: { flex: 1, minWidth: 90, alignItems: 'flex-end' },
  factLabel: { color: colors.muted, fontSize: 8, writingDirection: 'rtl' },
  factValue: { color: colors.ink, fontSize: 10, fontWeight: '800', marginTop: 5, textAlign: 'right', writingDirection: 'rtl' },
  timelinePanel: { marginTop: 18 },
  timelineList: { marginTop: 16, marginRight: 4 },
  timelineItem: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 10, position: 'relative', paddingBottom: 14 },
  timelineMarker: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#F0F1ED', borderWidth: 1, borderColor: '#CED5D0', alignItems: 'center', justifyContent: 'center' },
  timelineMarkerDone: { backgroundColor: colors.green, borderColor: colors.green },
  timelineMarkerActive: { backgroundColor: colors.amberLight, borderColor: '#D9AE63' },
  timelineMarkerBlocked: { backgroundColor: '#F4DFD7', borderColor: '#C5795F' },
  timelineMarkerText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  timelineCopy: { flex: 1, alignItems: 'flex-end' },
  timelineTitle: { color: colors.ink, fontSize: 10, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  timelineDate: { color: colors.muted, fontSize: 8, marginTop: 3, textAlign: 'right', writingDirection: 'rtl' },
  timelineNote: { color: colors.inkSoft, fontSize: 8, lineHeight: 13, marginTop: 4, textAlign: 'right', writingDirection: 'rtl' },
  timelineLine: { position: 'absolute', right: 9, top: 22, width: 1, height: 26, backgroundColor: '#D7DBD2' },
  actionRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, borderTopWidth: 1, borderTopColor: '#EFF0EB', marginTop: 4, paddingTop: 12 },
  actionButton: { minHeight: 34, backgroundColor: colors.greenDark, borderRadius: 7, paddingHorizontal: 12, justifyContent: 'center' },
  actionButtonText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800', writingDirection: 'rtl' },
  secondaryActionButton: { minHeight: 34, backgroundColor: '#F1E7DF', borderRadius: 7, paddingHorizontal: 12, justifyContent: 'center' },
  secondaryActionText: { color: '#9C5B3E', fontSize: 9, fontWeight: '800', writingDirection: 'rtl' },
  checkList: { marginTop: 14 },
  checkRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 9, marginBottom: 10 },
  checkMark: { width: 20, height: 20, borderRadius: 6, backgroundColor: '#F0F2EE', alignItems: 'center', justifyContent: 'center' },
  checkMarkActive: { backgroundColor: colors.greenLight },
  checkMarkText: { color: colors.green, fontSize: 10, fontWeight: '900' },
  checkCopy: { flex: 1, alignItems: 'flex-end' },
  checkText: { color: colors.ink, fontSize: 9, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  checkDate: { color: colors.muted, fontSize: 8, marginTop: 3, textAlign: 'right', writingDirection: 'rtl' },
  checkNote: { color: colors.inkSoft, fontSize: 8, lineHeight: 13, marginTop: 4, textAlign: 'right', writingDirection: 'rtl' },
  sampleActions: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 7, borderTopWidth: 1, borderTopColor: '#EFF0EB', marginTop: 6, paddingTop: 11 },
  sampleActionButton: { minHeight: 32, backgroundColor: colors.goldLight, borderRadius: 7, paddingHorizontal: 10, justifyContent: 'center' },
  sampleActionText: { color: colors.goldDeep, fontSize: 9, fontWeight: '800', writingDirection: 'rtl' },
  sidePanel: { marginTop: 0 },
  signalList: { marginTop: 14 },
  signalItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9, marginBottom: 12 },
  signalDot: { width: 10, height: 10, borderRadius: 5 },
  signalDotGreen: { backgroundColor: colors.green },
  signalDotBlue: { backgroundColor: colors.blue },
  signalDotAmber: { backgroundColor: colors.amber },
  signalDotMuted: { backgroundColor: '#97A19A' },
  signalCopy: { flex: 1, alignItems: 'flex-end' },
  signalName: { color: colors.ink, fontSize: 9, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  signalStatus: { color: colors.muted, fontSize: 8, marginTop: 3, textAlign: 'right', writingDirection: 'rtl' },
  emptyDetail: { color: colors.muted, fontSize: 9, marginTop: 8, textAlign: 'right', writingDirection: 'rtl' },
  emptyState: { minHeight: 230, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 12, alignItems: 'center', justifyContent: 'center', padding: 22, marginTop: 20 },
  emptyGlyph: { color: colors.green, fontSize: 28 },
  emptyTitle: { color: colors.ink, fontSize: 14, fontWeight: '900', marginTop: 9, writingDirection: 'rtl' },
  emptyBody: { color: colors.muted, fontSize: 10, marginTop: 6, textAlign: 'center', writingDirection: 'rtl' },
  emptyButton: { backgroundColor: colors.gold, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 7, marginTop: 13 },
  emptyButtonText: { color: colors.obsidian, fontSize: 10, fontWeight: '800', writingDirection: 'rtl' },
  actionError: { color: '#A33E35', backgroundColor: '#F8E9E5', borderRadius: 7, padding: 10, marginTop: 12, fontSize: 9, textAlign: 'right', writingDirection: 'rtl' },
  bottomPanel: { marginTop: 22, backgroundColor: colors.stone, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 16 },
  bottomPanelWide: { marginBottom: 0 },
  bottomHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  bottomTitle: { color: colors.ink, fontSize: 14, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  bottomAction: { color: colors.green, fontSize: 9, fontWeight: '800', writingDirection: 'rtl' },
  bottomGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 12, marginTop: 14 },
  bottomCard: { flexGrow: 1, flexBasis: 210, backgroundColor: colors.paper, borderRadius: 10, padding: 13, borderWidth: 1, borderColor: colors.line },
  bottomCardTitle: { color: colors.muted, fontSize: 9, textAlign: 'right', writingDirection: 'rtl' },
  bottomCardValue: { color: colors.ink, fontSize: 21, fontWeight: '900', marginTop: 8, textAlign: 'right', writingDirection: 'rtl' },
  bottomCardText: { color: colors.inkSoft, fontSize: 8, lineHeight: 14, marginTop: 6, textAlign: 'right', writingDirection: 'rtl' },
});
