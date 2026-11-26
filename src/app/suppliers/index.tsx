import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiFeedback } from '@/components/b2b/ApiFeedback';
import { AppHeader } from '@/components/b2b/AppHeader';
import { MotionPressable, ScreenEntrance, Stagger, useEntranceStyle } from '@/components/b2b/motion';
import { colors } from '@/components/b2b/palette';
import { containerStyle, useResponsive } from '@/components/b2b/responsive';
import { formatNumber, supplierCapabilities, useApiQuery, type ApiSupplier } from '@/data/api';

const countryLabels: Record<string, string> = {
  SA: 'السعودية',
  AE: 'الإمارات',
  JO: 'الأردن',
  KW: 'الكويت',
  QA: 'قطر',
  BH: 'البحرين',
  OM: 'عُمان',
  EG: 'مصر',
};

type SuppliersPayload = { suppliers: ApiSupplier[] };
type CountryFilter = 'all' | string;
type SortOption = 'name' | 'score' | 'leadTime';

const sortLabels: Record<SortOption, string> = {
  name: 'الاسم',
  score: 'التقييم',
  leadTime: 'مهلة التسليم',
};

export default function SuppliersDashboardScreen() {
  const { isDesktop, gutter } = useResponsive();
  const wide = isDesktop;
  const suppliersQuery = useApiQuery<SuppliersPayload>('/api/suppliers?pageSize=100');
  const suppliers = useMemo(() => suppliersQuery.data?.suppliers ?? [], [suppliersQuery.data?.suppliers]);
  const capabilities = suppliers.map((supplier) => supplierCapabilities(supplier.supplierProfile));
  const scores = capabilities.flatMap((item) => item.score === null ? [] : [item.score]);
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
  const withLeadTime = suppliers.filter((supplier) => supplier.supplierProfile?.leadTimeDays != null).length;

  const [search, setSearch] = useState('');
  const [country, setCountry] = useState<CountryFilter>('all');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sort, setSort] = useState<SortOption>('name');

  const countries = useMemo(() => Array.from(new Set(suppliers.map((supplier) => supplier.countryCode))).sort(), [suppliers]);
  const decorated = useMemo(() => suppliers.map((supplier) => ({
    supplier,
    capability: supplierCapabilities(supplier.supplierProfile),
  })), [suppliers]);
  const visibleSuppliers = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const result = decorated.filter(({ supplier, capability }) => {
      const matchesQuery = !query || [
        supplier.displayName,
        supplier.legalName,
        supplier.countryCode,
        countryLabels[supplier.countryCode] ?? '',
        capability.category,
        ...capability.specialties,
      ].join(' ').toLocaleLowerCase().includes(query);
      const matchesCountry = country === 'all' || supplier.countryCode === country;
      const matchesVerification = !verifiedOnly || supplier.supplierProfile?.verificationStatus === 'APPROVED';
      return matchesQuery && matchesCountry && matchesVerification;
    });
    return result.sort((left, right) => {
      if (sort === 'score') return (right.capability.score ?? -1) - (left.capability.score ?? -1);
      if (sort === 'leadTime') {
        const leftLead = left.supplier.supplierProfile?.leadTimeDays ?? Number.MAX_SAFE_INTEGER;
        const rightLead = right.supplier.supplierProfile?.leadTimeDays ?? Number.MAX_SAFE_INTEGER;
        return leftLead - rightLead;
      }
      return left.supplier.displayName.localeCompare(right.supplier.displayName, 'ar');
    });
  }, [country, decorated, search, sort, verifiedOnly]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppHeader active="suppliers" />
      <ScrollView contentContainerStyle={[styles.page, { paddingHorizontal: gutter }]} showsVerticalScrollIndicator={false}>
        <ScreenEntrance style={styles.content}>
          <View style={styles.headingRow}>
            <View style={styles.headingCopy}>
              <Text style={styles.kicker}>لوحة الموردين</Text>
              <Text style={styles.pageTitle}>قائمة منسّقة للمصانع والقدرات</Text>
              <Text style={styles.pageSubtitle}>الموردون المعتمدون المسجلون في قاعدة البيانات، مع قدراتهم ومراحل استجابتهم.</Text>
            </View>
            <Link href={'/workspace' as any} asChild>
              <Pressable accessibilityRole="button" style={styles.returnButton}>
                <Text style={styles.returnButtonText}>← العودة</Text>
              </Pressable>
            </Link>
          </View>

          <View style={styles.statsRow}>
            <MetricCard label="الموردون المعتمدون" value={formatNumber(suppliers.length).padStart(2, '0')} detail="من سجل المؤسسات" accent="green" delay={40} />
            <MetricCard label="لديهم مهلة تسليم" value={formatNumber(withLeadTime).padStart(2, '0')} detail="بيانات قابلة للمقارنة" accent="blue" delay={85} />
            <MetricCard label="متوسط التقييم" value={scores.length > 0 ? String(avgScore) : '—'} detail="من ملفات الموردين" accent="amber" delay={130} />
            <MetricCard label="حالة الدليل" value="مباشر" detail="مرتبط بالخادم" accent="ink" delay={175} />
          </View>

          <ApiFeedback
            loading={suppliersQuery.isLoading}
            error={suppliersQuery.error}
            empty={!suppliersQuery.isLoading && suppliers.length === 0}
            emptyTitle="لا يوجد موردون معتمدون بعد"
            emptyBody="سيظهر الموردون هنا بعد اعتماد ملفاتهم من لوحة الإدارة."
            onRetry={() => { void suppliersQuery.refetch(); }}
          />

          <View style={styles.filterPanel}>
            <View style={styles.searchBox}>
              <Text style={styles.searchGlyph}>⌕</Text>
              <TextInput
                accessibilityLabel="البحث في الموردين"
                value={search}
                onChangeText={setSearch}
                placeholder="ابحث بالاسم أو الدولة أو التخصص"
                placeholderTextColor="#8A948D"
                style={styles.searchInput}
                textAlign="right"
                returnKeyType="search"
              />
            </View>
            <View style={styles.filterRow}>
              <MotionPressable
                accessibilityRole="button"
                accessibilityState={{ selected: verifiedOnly }}
                onPress={() => setVerifiedOnly((current) => !current)}
                style={[styles.toggle, verifiedOnly && styles.toggleActive]}
              >
                <Text style={[styles.toggleText, verifiedOnly && styles.toggleTextActive]}>الموثقون فقط</Text>
              </MotionPressable>
              {(Object.keys(sortLabels) as SortOption[]).map((option) => (
                <MotionPressable
                  key={option}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sort === option }}
                  onPress={() => setSort(option)}
                  style={[styles.filterChip, sort === option && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, sort === option && styles.filterChipTextActive]}>
                    {sortLabels[option]}
                  </Text>
                </MotionPressable>
              ))}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.countryRow}>
              <MotionPressable
                accessibilityRole="button"
                accessibilityState={{ selected: country === 'all' }}
                onPress={() => setCountry('all')}
                style={[styles.countryChip, country === 'all' && styles.countryChipActive]}
              >
                <Text style={[styles.countryChipText, country === 'all' && styles.countryChipTextActive]}>كل الدول</Text>
              </MotionPressable>
              {countries.map((code) => (
                <MotionPressable
                  key={code}
                  accessibilityRole="button"
                  accessibilityState={{ selected: country === code }}
                  onPress={() => setCountry(code)}
                  style={[styles.countryChip, country === code && styles.countryChipActive]}
                >
                  <Text style={[styles.countryChipText, country === code && styles.countryChipTextActive]}>
                    {countryLabels[code] ?? code}
                  </Text>
                </MotionPressable>
              ))}
            </ScrollView>
            <Text style={styles.resultCount}>{formatNumber(visibleSuppliers.length)} مورد مطابق</Text>
          </View>

          <View style={[styles.grid, wide && styles.gridWide]}>
            <View style={styles.mainColumn}>
              <Text style={styles.sectionTitle}>الموردون المتاحون</Text>
              <View style={styles.list}>
                {visibleSuppliers.map(({ supplier, capability }, index) => {
                  return (
                    <Stagger key={supplier.id} index={index} baseDelay={130} step={42} translateY={8}>
                    <View style={styles.card}>
                      <View style={styles.cardHeader}>
                        <View style={styles.cardHeaderText}>
                          <Text style={styles.name}>{supplier.displayName}</Text>
                          <Text style={styles.meta}>
                            {countryLabels[supplier.countryCode] ?? supplier.countryCode} · {capability.category}
                          </Text>
                        </View>
                        <View style={[styles.badge, supplier.supplierProfile?.verificationStatus === 'APPROVED' ? styles.badgeVerified : styles.badgeDraft]}>
                          <Text style={[styles.badgeText, supplier.supplierProfile?.verificationStatus === 'APPROVED' && styles.badgeTextVerified]}>
                            {supplier.supplierProfile?.verificationStatus === 'APPROVED' ? 'موثق' : 'قيد المراجعة'}
                          </Text>
                        </View>
                      </View>

                      {capability.specialties.length > 0 ? (
                        <View style={styles.chips}>
                          {capability.specialties.map((specialty) => (
                            <View key={specialty} style={styles.chip}>
                              <Text style={styles.chipText}>{specialty}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}

                      <View style={styles.statsGrid}>
                        <MetricMini label="التقييم" value={capability.score === null ? '—' : String(capability.score)} />
                        <MetricMini label="المهلة" value={supplier.supplierProfile?.leadTimeDays ? `${formatNumber(supplier.supplierProfile.leadTimeDays)} يوم` : '—'} />
                        <MetricMini label="الحد الأدنى" value={supplier.supplierProfile?.minOrderQuantity ? formatNumber(supplier.supplierProfile.minOrderQuantity) : '—'} />
                        <MetricMini label="العروض" value={formatNumber(supplier._count?.quotes ?? 0)} />
                      </View>

                      <View style={styles.cardFooter}>
                        <Text style={styles.footerLabel}>{supplier.status === 'ACTIVE' ? 'نشط' : supplier.status}</Text>
                        <Link href={'/rfq/new' as any} asChild>
                          <Pressable accessibilityRole="button" style={styles.primaryButton}>
                            <Text style={styles.primaryButtonText}>طلب عرض جديد</Text>
                          </Pressable>
                        </Link>
                      </View>
                    </View>
                    </Stagger>
                  );
                })}
              </View>
            </View>

            <View style={styles.sideColumn}>
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>مقارنة سريعة</Text>
                <View style={styles.compareTable}>
                  {visibleSuppliers.map(({ supplier, capability }) => {
                    return (
                      <View key={supplier.id} style={styles.compareRow}>
                        <Text style={styles.compareName} numberOfLines={1}>{supplier.displayName}</Text>
                        <Text style={styles.compareValue}>{capability.score ?? '—'}</Text>
                        <Text style={styles.compareValue}>{supplier.supplierProfile?.leadTimeDays ?? '—'}</Text>
                      </View>
                    );
                  })}
                  {visibleSuppliers.length === 0 ? <Text style={styles.panelEmpty}>لا توجد بيانات للمقارنة.</Text> : null}
                </View>
              </View>

              <View style={styles.panel}>
                <Text style={styles.panelTitle}>إجراءات سريعة</Text>
                <View style={styles.actionList}>
                  <ActionRow href="/rfq/new" label="إنشاء طلب عروض" description="حدّد المواصفات وادعُ الموردين" />
                  <ActionRow href="/orders" label="متابعة الطلبات" description="راجع العروض وأوامر الشراء" />
                  <ActionRow href="/workspace" label="مساحة العمل" description="نظرة عامة على مؤشرات المنصة" />
                </View>
              </View>
            </View>
          </View>
        </ScreenEntrance>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetricCard({ label, value, detail, accent, delay = 0 }: { label: string; value: string; detail: string; accent: 'green' | 'amber' | 'blue' | 'ink'; delay?: number }) {
  const accentColor = accent === 'green' ? colors.green : accent === 'amber' ? colors.amber : accent === 'blue' ? colors.blue : colors.inkSoft;
  const entranceStyle = useEntranceStyle({ delay, duration: 300, translateY: 8 });
  return (
    <Animated.View style={[styles.metricCard, entranceStyle]}>
      <View style={styles.metricTop}>
        <Text style={[styles.metricAccent, { backgroundColor: accentColor }]} />
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricDetail}>{detail}</Text>
    </Animated.View>
  );
}

function MetricMini({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricMini}>
      <Text style={styles.metricMiniLabel}>{label}</Text>
      <Text style={styles.metricMiniValue}>{value}</Text>
    </View>
  );
}

function ActionRow({ href, label, description }: { href: string; label: string; description: string }) {
  return (
    <Link href={href as any} asChild>
      <Pressable accessibilityRole="link" style={styles.actionRow}>
        <Text style={styles.actionLabel}>{label}</Text>
        <Text style={styles.actionDescription}>{description}</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.cream },
  page: { paddingBottom: 30 },
  content: { ...containerStyle, paddingTop: 28 },
  headingRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headingCopy: { flex: 1, minWidth: 220, alignItems: 'flex-end' },
  kicker: { color: colors.goldDeep, fontSize: 11, fontWeight: '800', writingDirection: 'rtl' },
  pageTitle: { color: colors.ink, fontSize: 28, fontWeight: '900', marginTop: 8, textAlign: 'right', writingDirection: 'rtl' },
  pageSubtitle: { color: colors.muted, fontSize: 10, marginTop: 6, textAlign: 'right', writingDirection: 'rtl' },
  returnButton: { minHeight: 42, borderRadius: 8, paddingHorizontal: 14, backgroundColor: colors.goldLight, justifyContent: 'center' },
  returnButtonText: { color: colors.goldDeep, fontSize: 11, fontWeight: '800', writingDirection: 'rtl' },
  statsRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 11, marginTop: 18 },
  metricCard: { flexGrow: 1, flexBasis: 160, minHeight: 110, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 9, padding: 14 },
  metricTop: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7 },
  metricAccent: { width: 6, height: 6, borderRadius: 3 },
  metricLabel: { color: colors.muted, fontSize: 10, fontWeight: '700', writingDirection: 'rtl' },
  metricValue: { color: colors.ink, fontSize: 25, fontWeight: '900', marginTop: 12, textAlign: 'right' },
  metricDetail: { color: '#849088', fontSize: 9, marginTop: 4, writingDirection: 'rtl' },
  grid: { marginTop: 24, gap: 18 },
  gridWide: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'flex-start' },
  mainColumn: { flex: 1.5, minWidth: 280 },
  sideColumn: { flex: 0.8, minWidth: 260 },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '900', marginBottom: 12, textAlign: 'right', writingDirection: 'rtl' },
  list: { gap: 12 },
  card: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 15 },
  cardHeader: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cardHeaderText: { flex: 1, minWidth: 0, alignItems: 'flex-end' },
  name: { color: colors.ink, fontSize: 15, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  meta: { color: colors.muted, fontSize: 10, marginTop: 5, textAlign: 'right', writingDirection: 'rtl' },
  badge: { minHeight: 24, paddingHorizontal: 8, borderRadius: 6, justifyContent: 'center' },
  badgeVerified: { backgroundColor: colors.greenLight },
  badgeDraft: { backgroundColor: '#F5F4EE' },
  badgeText: { fontSize: 9, fontWeight: '800', writingDirection: 'rtl' },
  badgeTextVerified: { color: colors.greenDark },
  chips: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  chip: { backgroundColor: '#F4F5F1', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  chipText: { color: colors.inkSoft, fontSize: 9, fontWeight: '700', writingDirection: 'rtl' },
  statsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  metricMini: { minWidth: 90, backgroundColor: '#F7F9F5', borderRadius: 8, padding: 8 },
  metricMiniLabel: { color: colors.muted, fontSize: 8, textAlign: 'right', writingDirection: 'rtl' },
  metricMiniValue: { color: colors.ink, fontSize: 11, fontWeight: '800', marginTop: 4, textAlign: 'right', writingDirection: 'rtl' },
  cardFooter: { marginTop: 16, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  footerLabel: { color: colors.greenDark, fontSize: 10, fontWeight: '800', writingDirection: 'rtl' },
  primaryButton: { minHeight: 38, paddingHorizontal: 12, borderRadius: 8, backgroundColor: colors.gold, justifyContent: 'center' },
  primaryButtonText: { color: colors.obsidian, fontSize: 10, fontWeight: '800', writingDirection: 'rtl' },
  panel: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 15, marginBottom: 14 },
  panelTitle: { color: colors.ink, fontSize: 15, fontWeight: '900', marginBottom: 12, textAlign: 'right', writingDirection: 'rtl' },
  compareTable: { gap: 10 },
  compareRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#EFF1EC' },
  compareName: { flex: 1, color: colors.ink, fontSize: 10, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },
  compareValue: { color: colors.inkSoft, fontSize: 10, fontWeight: '800' },
  panelEmpty: { color: colors.muted, fontSize: 9, writingDirection: 'rtl' },
  actionList: { gap: 12 },
  actionRow: { backgroundColor: '#F7F8F5', borderRadius: 9, padding: 10 },
  actionLabel: { color: colors.ink, fontSize: 11, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  actionDescription: { color: colors.muted, fontSize: 9, marginTop: 5, textAlign: 'right', writingDirection: 'rtl' },
  filterPanel: { marginTop: 18, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 14 },
  searchBox: { minHeight: 44, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FBFBF9', borderRadius: 8, flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 12 },
  searchGlyph: { color: colors.green, fontSize: 20, marginLeft: 8 },
  searchInput: { flex: 1, paddingVertical: 8, color: colors.ink, fontSize: 11, writingDirection: 'rtl' },
  filterRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  toggle: { minHeight: 34, paddingHorizontal: 12, borderRadius: 7, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  toggleActive: { backgroundColor: colors.greenLight, borderColor: colors.green },
  toggleText: { color: colors.inkSoft, fontSize: 9, fontWeight: '800', writingDirection: 'rtl' },
  toggleTextActive: { color: colors.greenDark },
  filterChip: { minHeight: 34, paddingHorizontal: 12, borderRadius: 7, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  filterChipActive: { backgroundColor: colors.greenDark, borderColor: colors.greenDark },
  filterChipText: { color: colors.inkSoft, fontSize: 9, fontWeight: '800', writingDirection: 'rtl' },
  filterChipTextActive: { color: '#FFFFFF' },
  countryRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginTop: 12, paddingVertical: 2 },
  countryChip: { minHeight: 32, paddingHorizontal: 11, borderRadius: 7, backgroundColor: '#F4F5F1', alignItems: 'center', justifyContent: 'center' },
  countryChipActive: { backgroundColor: colors.goldLight },
  countryChipText: { color: colors.inkSoft, fontSize: 9, fontWeight: '700', writingDirection: 'rtl' },
  countryChipTextActive: { color: colors.goldDeep, fontWeight: '900' },
  resultCount: { color: colors.muted, fontSize: 9, textAlign: 'right', writingDirection: 'rtl', marginTop: 11 },
});
