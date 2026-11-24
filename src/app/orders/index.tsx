import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiFeedback } from '@/components/b2b/ApiFeedback';
import { AppHeader } from '@/components/b2b/AppHeader';
import { colors, radii, shadows, spacing } from '@/components/b2b/palette';
import { containerStyle, useResponsive } from '@/components/b2b/responsive';
import { StatusPill } from '@/components/b2b/StatusPill';
import { fonts } from '@/components/b2b/typography';
import {
  formatDate,
  formatNumber,
  RFQ_STATUS,
  statusInfo,
  useApiQuery,
  type ApiRfq,
} from '@/data/api';

const filters = [
  { id: 'all', label: 'كل الطلبات' },
  { id: 'offers', label: 'تحتاج مراجعة' },
  { id: 'selected', label: 'تم الترسية' },
  { id: 'draft', label: 'المسودات' },
] as const;

type OrderFilter = typeof filters[number]['id'];
type RfqsPayload = { rfqs: ApiRfq[] };

export default function OrdersScreen() {
  const { width, gutter } = useResponsive();
  const wide = width >= 820;
  const [activeFilter, setActiveFilter] = useState<OrderFilter>('all');
  const [search, setSearch] = useState('');
  const rfqsQuery = useApiQuery<RfqsPayload>('/api/rfqs?pageSize=100');
  const rfqs = useMemo(() => rfqsQuery.data?.rfqs ?? [], [rfqsQuery.data?.rfqs]);

  const counts = useMemo(() => ({
    all: rfqs.length,
    offers: rfqs.filter((request) => request.status === 'PUBLISHED' && (request._count?.quotes ?? 0) > 0).length,
    selected: rfqs.filter((request) => request.status === 'CLOSED').length,
    draft: rfqs.filter((request) => request.status === 'DRAFT').length,
  }), [rfqs]);

  const visibleRfqs = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return rfqs.filter((request) => {
      const matchesFilter = activeFilter === 'all'
        || (activeFilter === 'offers' && request.status === 'PUBLISHED' && (request._count?.quotes ?? 0) > 0)
        || (activeFilter === 'selected' && request.status === 'CLOSED')
        || (activeFilter === 'draft' && request.status === 'DRAFT');
      const searchableText = `${request.id} ${request.title} ${statusInfo(RFQ_STATUS, request.status).label} ${request.industry?.nameAr ?? ''}`.toLocaleLowerCase();
      return matchesFilter && (!normalizedSearch || searchableText.includes(normalizedSearch));
    });
  }, [activeFilter, rfqs, search]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppHeader active="orders" />
      <ScrollView contentContainerStyle={[styles.page, { paddingHorizontal: gutter }]} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={[styles.headingRow, wide && styles.headingRowWide]}>
            <View style={styles.headingCopy}>
              <Text style={styles.kicker}>مركز المتابعة</Text>
              <Text style={styles.pageTitle}>كل طلباتك في مكان واحد</Text>
              <Text style={styles.pageDescription}>راجع عروض الموردين، تابع حالة كل طلب، وانتقل مباشرة إلى تفاصيله.</Text>
            </View>
            <View style={styles.headerActions}>
              <Link href={'/production' as any} asChild>
                <Pressable accessibilityRole="link" style={styles.secondaryHeaderButton}>
                  <Text style={styles.secondaryHeaderButtonText}>أوامر الشراء</Text>
                </Pressable>
              </Link>
              <Link href={'/rfq/new' as any} asChild>
                <Pressable accessibilityRole="button" style={styles.newButton}>
                  <Text style={styles.newButtonText}>＋ طلب جديد</Text>
                </Pressable>
              </Link>
            </View>
          </View>

          <View style={styles.notice}>
            <Text style={styles.noticeMark}>i</Text>
            <Text style={styles.noticeText}>الطلبات والعروض محفوظة في قاعدة البيانات وتُعرض بحسب صلاحياتك ومؤسستك.</Text>
          </View>

          <View style={styles.metrics}>
            <SummaryMetric label="إجمالي الطلبات" value={formatNumber(counts.all)} tone="green" />
            <SummaryMetric label="تحتاج مراجعة" value={formatNumber(counts.offers)} tone="amber" />
            <SummaryMetric label="تم الترسية" value={formatNumber(counts.selected)} tone="blue" />
            <SummaryMetric label="المسودات" value={formatNumber(counts.draft)} tone="muted" />
          </View>

          <View style={styles.toolbar}>
            <View style={styles.searchBox}>
              <Text style={styles.searchGlyph}>⌕</Text>
              <TextInput
                accessibilityLabel="البحث في الطلبات"
                value={search}
                onChangeText={setSearch}
                placeholder="ابحث بالاسم أو الرقم أو القطاع"
                placeholderTextColor="#8A958E"
                style={styles.searchInput}
                textAlign="right"
                returnKeyType="search"
              />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
              {filters.map((filter) => {
                const selected = activeFilter === filter.id;
                return (
                  <Pressable
                    key={filter.id}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    onPress={() => setActiveFilter(filter.id)}
                    style={[styles.filterButton, selected && styles.filterButtonActive]}
                  >
                    <Text style={[styles.filterText, selected && styles.filterTextActive]}>{filter.label}</Text>
                    <Text style={[styles.filterCount, selected && styles.filterCountActive]}>{formatNumber(counts[filter.id])}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.listHeader}>
            <Text style={styles.resultCount}>{formatNumber(visibleRfqs.length)} طلب</Text>
            <Text style={styles.listTitle}>الطلبات</Text>
          </View>

          <ApiFeedback
            loading={rfqsQuery.isLoading}
            error={rfqsQuery.error}
            empty={!rfqsQuery.isLoading && visibleRfqs.length === 0}
            emptyTitle="لا توجد طلبات مطابقة"
            emptyBody="جرّب تغيير عبارة البحث أو اختر تصنيفًا آخر، أو أنشئ طلب توريد جديدًا."
            onRetry={() => { void rfqsQuery.refetch(); }}
          />

          {visibleRfqs.map((request) => {
            const status = statusInfo(RFQ_STATUS, request.status);
            return (
              <Link
                key={request.id}
                href={{ pathname: '/rfq/[id]' as any, params: { id: request.id } } as any}
                asChild
              >
                <Pressable accessibilityRole="link" style={({ pressed }) => [styles.orderRow, pressed && styles.orderRowPressed]}>
                  <View style={styles.rowArrow}><Text style={styles.rowArrowText}>←</Text></View>
                  <View style={styles.rowContent}>
                    <View style={styles.rowTop}>
                      <View style={styles.statusGroup}>
                        <StatusPill label={status.label} tone={status.tone} small />
                        <Text style={styles.orderId}>{request.id}</Text>
                      </View>
                      <Text style={styles.orderTitle}>{request.title}</Text>
                    </View>
                    <Text style={styles.orderSummary} numberOfLines={2}>{request.destination}</Text>
                    <View style={styles.orderMetaRow}>
                      <Text style={styles.metaText}>{formatNumber(request.quantity)} {request.unit}</Text>
                      <Text style={styles.metaDivider}>·</Text>
                      <Text style={styles.metaText}>{request.industry?.nameAr ?? '—'}</Text>
                      <Text style={styles.metaDivider}>·</Text>
                      <Text style={styles.metaText}>{formatNumber(request._count?.quotes ?? 0)} عروض</Text>
                    </View>
                    <View style={styles.rowFooter}>
                      <Text style={styles.dueDate}>الموعد: {formatDate(request.targetDate)}</Text>
                      <Text style={request.status === 'CLOSED' ? styles.selectedOffer : styles.offerHint}>
                        {request.status === 'CLOSED' ? 'تمت ترسية العرض' : request.status === 'PUBLISHED' ? 'مراجعة العروض الواردة' : 'بانتظار نشر الطلب'}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              </Link>
            );
          })}

          <Text style={styles.footer}>سوقي · سجل الطلبات من الخادم · الحالات لا تمثل التزامات تجارية</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryMetric({ label, value, tone }: { label: string; value: string; tone: 'green' | 'amber' | 'blue' | 'muted' }) {
  const toneStyle = tone === 'green' ? styles.metricGreen : tone === 'amber' ? styles.metricAmber : tone === 'blue' ? styles.metricBlue : styles.metricMuted;
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricMark, toneStyle]} />
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.cream },
  page: { paddingBottom: 30 },
  content: { ...containerStyle, paddingTop: 28 },
  headingRow: { flexDirection: 'column', alignItems: 'flex-end', gap: 14 },
  headingRowWide: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' },
  headingCopy: { alignItems: 'flex-end', flex: 1, minWidth: 220 },
  kicker: { color: colors.accentDark, fontFamily: fonts.semiBold, fontSize: 12, writingDirection: 'rtl' },
  pageTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 28, marginTop: spacing.md, textAlign: 'right', writingDirection: 'rtl' },
  pageDescription: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 13, marginTop: spacing.sm, textAlign: 'right', writingDirection: 'rtl' },
  headerActions: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  secondaryHeaderButton: { minHeight: 44, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: spacing.md, justifyContent: 'center' },
  secondaryHeaderButtonText: { color: colors.inkSoft, fontFamily: fonts.semiBold, fontSize: 11, writingDirection: 'rtl' },
  newButton: { minHeight: 44, borderRadius: radii.sm, backgroundColor: colors.primaryDark, paddingHorizontal: spacing.lg, justifyContent: 'center' },
  newButtonText: { color: colors.accent, fontFamily: fonts.semiBold, fontSize: 12, writingDirection: 'rtl' },
  notice: { marginTop: 19, minHeight: 40, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: '#EFF1E9', borderWidth: 1, borderColor: '#E1E5DC', borderRadius: 8, flexDirection: 'row-reverse', alignItems: 'center', gap: 9 },
  noticeMark: { color: colors.green, width: 18, height: 18, borderRadius: 9, backgroundColor: '#DDE8DD', textAlign: 'center', textAlignVertical: 'center', fontSize: 10, fontWeight: '900' },
  noticeText: { flex: 1, color: colors.inkSoft, fontSize: 9, lineHeight: 15, textAlign: 'right', writingDirection: 'rtl' },
  metrics: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  metricCard: { flexGrow: 1, flexBasis: 145, minHeight: 92, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: spacing.md, alignItems: 'flex-end', ...shadows.soft },
  metricMark: { width: 7, height: 7, borderRadius: 4, alignSelf: 'flex-start' },
  metricGreen: { backgroundColor: colors.green },
  metricAmber: { backgroundColor: colors.amber },
  metricBlue: { backgroundColor: colors.blue },
  metricMuted: { backgroundColor: '#97A19A' },
  metricLabel: { color: colors.muted, fontSize: 9, fontWeight: '700', marginTop: 5, writingDirection: 'rtl' },
  metricValue: { color: colors.ink, fontSize: 21, fontWeight: '900', marginTop: 4 },
  toolbar: { marginTop: 19, gap: 11 },
  searchBox: { minHeight: 44, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 8, flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 12 },
  searchGlyph: { color: colors.green, fontSize: 20, marginLeft: 8 },
  searchInput: { flex: 1, paddingVertical: 8, color: colors.ink, fontSize: 11, writingDirection: 'rtl' },
  filters: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', gap: 7, paddingVertical: 2 },
  filterButton: { minHeight: 34, borderWidth: 1, borderColor: colors.line, borderRadius: 7, backgroundColor: colors.paper, paddingHorizontal: 10, flexDirection: 'row-reverse', alignItems: 'center', gap: 7 },
  filterButtonActive: { backgroundColor: colors.greenDark, borderColor: colors.greenDark },
  filterText: { color: colors.inkSoft, fontSize: 9, fontWeight: '700', writingDirection: 'rtl' },
  filterTextActive: { color: '#FFFFFF' },
  filterCount: { color: colors.muted, fontSize: 8, fontWeight: '800' },
  filterCountActive: { color: '#D6E4DC' },
  listHeader: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 9 },
  listTitle: { color: colors.ink, fontSize: 14, fontWeight: '900', writingDirection: 'rtl' },
  resultCount: { color: colors.muted, fontSize: 9, writingDirection: 'rtl' },
  orderRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.md, padding: spacing.lg, marginBottom: spacing.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, ...shadows.soft },
  orderRowPressed: { borderColor: colors.green, backgroundColor: '#F8FBF7' },
  rowArrow: { width: 28, height: 28, borderRadius: 7, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center' },
  rowArrowText: { color: colors.green, fontSize: 14, fontWeight: '900' },
  rowContent: { flex: 1, minWidth: 0 },
  rowTop: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  statusGroup: { flexDirection: 'row-reverse', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  orderId: { color: colors.muted, fontSize: 8, writingDirection: 'rtl' },
  orderTitle: { flexShrink: 1, color: colors.ink, fontSize: 12, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  orderSummary: { color: colors.muted, fontSize: 9, lineHeight: 15, marginTop: 7, textAlign: 'right', writingDirection: 'rtl' },
  orderMetaRow: { flexDirection: 'row-reverse', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  metaText: { color: colors.inkSoft, fontSize: 8, writingDirection: 'rtl' },
  metaDivider: { color: '#AAB3AB', fontSize: 9 },
  rowFooter: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 7, borderTopWidth: 1, borderTopColor: '#EFF0EB', marginTop: 9, paddingTop: 8 },
  dueDate: { color: colors.muted, fontSize: 8, writingDirection: 'rtl' },
  selectedOffer: { color: colors.green, fontSize: 8, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  offerHint: { color: colors.amber, fontSize: 8, fontWeight: '800', writingDirection: 'rtl' },
  footer: { color: '#89948D', fontSize: 8, marginTop: 19, textAlign: 'center', writingDirection: 'rtl' },
});
