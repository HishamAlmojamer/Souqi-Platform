import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiFeedback } from '@/components/b2b/ApiFeedback';
import { AppHeader } from '@/components/b2b/AppHeader';
import { colors } from '@/components/b2b/palette';
import { containerStyle, useResponsive } from '@/components/b2b/responsive';
import {
  errorMessage,
  formatDate,
  formatMoney,
  formatNumber,
  RFQ_STATUS,
  schemaFields,
  statusInfo,
  useApiMutation,
  useApiQuery,
  type ApiQuote,
  type ApiRfq,
  type ApiSchemaVersion,
} from '@/data/api';
import { useAuth } from '@/state/AuthContext';

type RfqPayload = { rfq: ApiRfq };
type QuotesPayload = { quotes: ApiQuote[] };
type SchemaPayload = { version: ApiSchemaVersion };
type AwardPayload = { purchaseOrder: { id: string } };

export default function RFQDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { hasPermission } = useAuth();
  const [actionError, setActionError] = useState('');
  const [awardedPoId, setAwardedPoId] = useState('');
  const { gutter } = useResponsive();
  const rfqQuery = useApiQuery<RfqPayload>(id ? `/api/rfqs/${id}` : null);
  const quotesQuery = useApiQuery<QuotesPayload>(id ? `/api/rfqs/${id}/quotes?pageSize=100` : null);
  const rfq = rfqQuery.data?.rfq;
  const schemaQuery = useApiQuery<SchemaPayload>(rfq?.schemaVersionId ? `/api/schema-versions/${rfq.schemaVersionId}` : null);
  const changeStatus = useApiMutation();
  const award = useApiMutation<AwardPayload>();
  const fields = schemaFields(schemaQuery.data?.version?.schemaJson);
  const status = statusInfo(RFQ_STATUS, rfq?.status ?? 'DRAFT');

  const runAction = async (path: string, body: unknown) => {
    setActionError('');
    try {
      await changeStatus.mutateAsync({ path, body });
    } catch (cause) {
      setActionError(errorMessage(cause));
    }
  };

  const awardQuote = async (quoteId: string) => {
    setActionError('');
    try {
      const result = await award.mutateAsync({
        path: `/api/rfqs/${id}/award`,
        body: { quoteId },
      });
      setAwardedPoId(result.purchaseOrder.id);
    } catch (cause) {
      setActionError(errorMessage(cause));
    }
  };

  const loading = rfqQuery.isLoading || quotesQuery.isLoading;
  const error = rfqQuery.error ?? quotesQuery.error;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppHeader active="orders" />
      <ScrollView contentContainerStyle={[styles.page, { paddingHorizontal: gutter }]} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.topRow}>
            <Link href={'/workspace' as any} asChild>
              <Pressable accessibilityRole="button" style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>← عودة</Text>
              </Pressable>
            </Link>
            <View style={styles.headerMeta}>
              <Text style={styles.kicker}>تفاصيل طلب التوريد</Text>
              <Text style={styles.requestId}>{rfq?.id ?? id}</Text>
            </View>
          </View>

          <ApiFeedback
            loading={loading}
            error={error}
            empty={!loading && !rfq}
            emptyTitle="الطلب غير موجود"
            emptyBody="قد يكون الطلب حذفه صاحبه أو أنك لا تملك صلاحية الاطلاع عليه."
            onRetry={() => { void rfqQuery.refetch(); void quotesQuery.refetch(); }}
          />

          {rfq ? (
            <>
              <View style={styles.summaryCard}>
                <View style={styles.summaryHeader}>
                  <Text style={styles.title}>{rfq.title}</Text>
                  <StatusPill label={status.label} tone={status.tone} />
                </View>
                <Text style={styles.summary}>{rfq.destination}</Text>
                <View style={styles.quickFacts}>
                  <QuickFact label="القطاع" value={rfq.industry?.nameAr ?? '—'} />
                  <QuickFact label="الكمية" value={`${formatNumber(rfq.quantity)} ${rfq.unit}`} />
                  <QuickFact label="الموعد" value={formatDate(rfq.targetDate)} />
                  <QuickFact label="تاريخ الإنشاء" value={formatDate(rfq.createdAt)} />
                </View>
                {rfq.status === 'DRAFT' && hasPermission('rfq.publish') ? (
                  <Pressable
                    accessibilityRole="button"
                    style={styles.actionButton}
                    onPress={() => { void runAction(`/api/rfqs/${rfq.id}/status`, { status: 'PUBLISHED' }); }}
                  >
                    <Text style={styles.actionButtonText}>نشر الطلب للموردين</Text>
                  </Pressable>
                ) : null}
                {rfq.status === 'PUBLISHED' && hasPermission('rfq.publish') ? (
                  <Pressable
                    accessibilityRole="button"
                    style={styles.secondaryAction}
                    onPress={() => { void runAction(`/api/rfqs/${rfq.id}/status`, { status: 'CLOSED' }); }}
                  >
                    <Text style={styles.secondaryActionText}>إغلاق الطلب</Text>
                  </Pressable>
                ) : null}
              </View>

              {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
              {awardedPoId ? (
                <Link href={'/production' as any} asChild>
                  <Pressable accessibilityRole="button" style={styles.successBanner}>
                    <Text style={styles.successBannerText}>تم إنشاء أمر التوريد {awardedPoId} · افتح لوحة التنفيذ</Text>
                  </Pressable>
                </Link>
              ) : null}

              <View style={styles.grid}>
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>مواصفات الطلب</Text>
                  {fields.length > 0 ? fields.map((field) => (
                    <View key={field.id} style={styles.detailRow}>
                      <Text style={styles.detailLabel}>{field.label}</Text>
                      <Text style={styles.detailValue}>{String(rfq.requirements?.[field.id] ?? '—')}</Text>
                    </View>
                  )) : (
                    <Text style={styles.emptyDetail}>لا توجد حقول مواصفات في إصدار المخطط المرتبط بهذا الطلب.</Text>
                  )}
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>إصدار المخطط</Text>
                    <Text style={styles.detailValue}>{schemaQuery.data?.version?.version ?? '—'}</Text>
                  </View>
                </View>

                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>العروض الحالية</Text>
                  <View style={styles.offerList}>
                    {(quotesQuery.data?.quotes ?? []).length > 0 ? quotesQuery.data?.quotes.map((offer) => {
                      const total = offer.lines.reduce((sum, line) => sum + Number(line.totalPriceCents ?? 0), 0);
                      return (
                        <View key={offer.id} style={styles.offerItem}>
                          <View style={styles.offerHeader}>
                            <View style={styles.offerHeaderText}>
                              <Text style={styles.offerSupplier}>{offer.supplierOrg?.displayName ?? offer.supplierOrgId}</Text>
                              <Text style={styles.offerMeta}>مراجعة {offer.revision} · {formatNumber(offer.leadTimeDays)} يوم</Text>
                            </View>
                            <Text style={styles.offerTotal}>{formatMoney(total, offer.currency)}</Text>
                          </View>
                          <Text style={styles.offerNotes}>{offer.notes || 'لا توجد ملاحظات مرفقة بالعرض.'}</Text>
                          <View style={styles.offerFooter}>
                            <View style={styles.offerBadge}>
                              <Text style={styles.offerBadgeText}>{offer.status}</Text>
                            </View>
                            {rfq.status === 'PUBLISHED' && hasPermission('rfq.award') && offer.status === 'SUBMITTED' ? (
                              <Pressable
                                accessibilityRole="button"
                                disabled={award.isPending}
                                onPress={() => { void awardQuote(offer.id); }}
                                style={styles.awardButton}
                              >
                                <Text style={styles.awardButtonText}>ترسية العرض</Text>
                              </Pressable>
                            ) : null}
                          </View>
                        </View>
                      );
                    }) : (
                      <Text style={styles.emptyDetail}>لا توجد عروض مقدمة على هذا الطلب حتى الآن.</Text>
                    )}
                  </View>
                </View>

                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>مسار التوريد</Text>
                  <View style={styles.timeline}>
                    <TimelineStep title="تم إنشاء الطلب" note={`أنشئ في ${formatDate(rfq.createdAt)}`} done />
                    <TimelineStep
                      title="نشر الطلب واستقبال العروض"
                      note={rfq.publishedAt ? `نُشر في ${formatDate(rfq.publishedAt)}` : 'لم يُنشر بعد'}
                      done={rfq.status !== 'DRAFT'}
                      active={rfq.status === 'PUBLISHED'}
                    />
                    <TimelineStep
                      title="ترسية العرض والتنفيذ"
                      note={awardedPoId || rfq.status === 'CLOSED' ? 'تمت الترسية وإنشاء أمر التوريد' : 'بانتظار اختيار أحد العروض'}
                      done={rfq.status === 'CLOSED'}
                    />
                  </View>
                </View>
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusPill({ label, tone }: { label: string; tone: 'green' | 'amber' | 'blue' | 'muted' }) {
  const stylesMap = {
    green: { bg: '#E6F0EB', text: colors.green },
    amber: { bg: '#F8E9D7', text: '#8E5B1D' },
    blue: { bg: '#E8F1F5', text: '#356477' },
    muted: { bg: '#F1F2EF', text: colors.muted },
  };
  const palette = stylesMap[tone];
  return (
    <View style={[styles.pill, { backgroundColor: palette.bg }]}>
      <Text style={[styles.pillText, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

function QuickFact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.quickFact}>
      <Text style={styles.quickFactLabel}>{label}</Text>
      <Text style={styles.quickFactValue}>{value}</Text>
    </View>
  );
}

function TimelineStep({ title, note, done, active }: { title: string; note: string; done?: boolean; active?: boolean }) {
  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineRail}>
        <View style={[styles.timelineDot, done && styles.timelineDotDone, active && styles.timelineDotActive]} />
      </View>
      <View style={styles.timelineCopy}>
        <Text style={styles.timelineTitle}>{title}</Text>
        <Text style={styles.timelineNote}>{note}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.cream },
  page: { paddingBottom: 30 },
  content: { ...containerStyle, paddingTop: 28 },
  topRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerMeta: { alignItems: 'flex-end' },
  kicker: { fontSize: 11, color: colors.green, fontWeight: '800', writingDirection: 'rtl' },
  requestId: { fontSize: 14, color: colors.ink, fontWeight: '800', marginTop: 4, writingDirection: 'rtl' },
  secondaryButton: { minHeight: 42, paddingHorizontal: 14, borderRadius: 8, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: colors.greenDark, fontSize: 11, fontWeight: '800', writingDirection: 'rtl' },
  summaryCard: { marginTop: 18, backgroundColor: colors.paper, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 18 },
  summaryHeader: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { fontSize: 24, fontWeight: '900', color: colors.ink, textAlign: 'right', flexShrink: 1, minWidth: 0, writingDirection: 'rtl' },
  summary: { fontSize: 12, color: colors.muted, marginTop: 14, lineHeight: 22, textAlign: 'right', writingDirection: 'rtl' },
  quickFacts: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 12, marginTop: 18 },
  quickFact: { minWidth: 120, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 9, backgroundColor: '#F3F4F0', borderWidth: 1, borderColor: '#EAEDE7' },
  quickFactLabel: { color: colors.muted, fontSize: 9, textAlign: 'right', writingDirection: 'rtl' },
  quickFactValue: { color: colors.ink, fontSize: 12, fontWeight: '800', marginTop: 6, textAlign: 'right', writingDirection: 'rtl' },
  actionButton: { marginTop: 16, minHeight: 42, backgroundColor: colors.greenDark, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  actionButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', writingDirection: 'rtl' },
  secondaryAction: { marginTop: 10, minHeight: 40, borderWidth: 1, borderColor: colors.line, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  secondaryActionText: { color: colors.inkSoft, fontSize: 11, fontWeight: '800', writingDirection: 'rtl' },
  successBanner: { marginTop: 12, minHeight: 44, backgroundColor: colors.greenLight, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  successBannerText: { color: colors.greenDark, fontSize: 11, fontWeight: '800', textAlign: 'center', writingDirection: 'rtl' },
  error: { color: colors.red, fontSize: 11, marginTop: 12, textAlign: 'right', writingDirection: 'rtl' },
  grid: { marginTop: 18, gap: 18 },
  card: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: colors.ink, textAlign: 'right', writingDirection: 'rtl' },
  detailRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EEF0EC' },
  detailLabel: { flex: 1, minWidth: 100, fontSize: 11, color: colors.muted, textAlign: 'right', writingDirection: 'rtl' },
  detailValue: { flex: 1.3, minWidth: 140, fontSize: 11, fontWeight: '700', color: colors.ink, textAlign: 'right', writingDirection: 'rtl' },
  emptyDetail: { color: colors.muted, fontSize: 11, marginTop: 12, textAlign: 'right', writingDirection: 'rtl' },
  timeline: { marginTop: 18 },
  timelineRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 12 },
  timelineRail: { width: 18, alignItems: 'center' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#CFD7D1' },
  timelineDotDone: { backgroundColor: colors.green },
  timelineDotActive: { backgroundColor: colors.amber },
  timelineCopy: { flex: 1, paddingBottom: 16 },
  timelineTitle: { color: colors.ink, fontSize: 12, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  timelineNote: { color: colors.muted, fontSize: 10, marginTop: 6, lineHeight: 18, textAlign: 'right', writingDirection: 'rtl' },
  offerList: { marginTop: 18, gap: 12 },
  offerItem: { backgroundColor: '#F9FAF7', borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 12 },
  offerHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  offerHeaderText: { flex: 1, minWidth: 0, alignItems: 'flex-end' },
  offerSupplier: { color: colors.ink, fontSize: 12, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  offerMeta: { color: colors.muted, fontSize: 9, marginTop: 5, textAlign: 'right', writingDirection: 'rtl' },
  offerTotal: { color: colors.greenDark, fontSize: 14, fontWeight: '900', textAlign: 'left' },
  offerNotes: { color: colors.muted, fontSize: 10, marginTop: 10, textAlign: 'right', writingDirection: 'rtl' },
  offerFooter: { marginTop: 12, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  offerBadge: { minHeight: 26, paddingHorizontal: 8, borderRadius: 6, backgroundColor: '#EAEFEA', justifyContent: 'center' },
  offerBadgeText: { color: colors.muted, fontSize: 9, fontWeight: '800', writingDirection: 'rtl' },
  awardButton: { minHeight: 34, paddingHorizontal: 12, borderRadius: 7, backgroundColor: colors.greenDark, justifyContent: 'center' },
  awardButtonText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', writingDirection: 'rtl' },
  pill: { minHeight: 28, paddingHorizontal: 10, borderRadius: 8, justifyContent: 'center' },
  pillText: { fontSize: 9, fontWeight: '800', writingDirection: 'rtl' },
});
