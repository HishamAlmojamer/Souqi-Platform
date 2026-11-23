import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiFeedback } from '@/components/b2b/ApiFeedback';
import { AppHeader } from '@/components/b2b/AppHeader';
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

export default function SuppliersDashboardScreen() {
  const { isDesktop, gutter } = useResponsive();
  const wide = isDesktop;
  const suppliersQuery = useApiQuery<SuppliersPayload>('/api/suppliers?pageSize=100');
  const suppliers = suppliersQuery.data?.suppliers ?? [];
  const capabilities = suppliers.map((supplier) => supplierCapabilities(supplier.supplierProfile));
  const scores = capabilities.flatMap((item) => item.score === null ? [] : [item.score]);
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
  const withLeadTime = suppliers.filter((supplier) => supplier.supplierProfile?.leadTimeDays != null).length;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppHeader active="suppliers" />
      <ScrollView contentContainerStyle={[styles.page, { paddingHorizontal: gutter }]} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
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
            <MetricCard label="الموردون المعتمدون" value={formatNumber(suppliers.length).padStart(2, '0')} detail="من سجل المؤسسات" accent="green" />
            <MetricCard label="لديهم مهلة تسليم" value={formatNumber(withLeadTime).padStart(2, '0')} detail="بيانات قابلة للمقارنة" accent="blue" />
            <MetricCard label="متوسط التقييم" value={scores.length > 0 ? String(avgScore) : '—'} detail="من ملفات الموردين" accent="amber" />
            <MetricCard label="حالة الدليل" value="مباشر" detail="مرتبط بالخادم" accent="ink" />
          </View>

          <ApiFeedback
            loading={suppliersQuery.isLoading}
            error={suppliersQuery.error}
            empty={!suppliersQuery.isLoading && suppliers.length === 0}
            emptyTitle="لا يوجد موردون معتمدون بعد"
            emptyBody="سيظهر الموردون هنا بعد اعتماد ملفاتهم من لوحة الإدارة."
            onRetry={() => { void suppliersQuery.refetch(); }}
          />

          <View style={[styles.grid, wide && styles.gridWide]}>
            <View style={styles.mainColumn}>
              <Text style={styles.sectionTitle}>الموردون المتاحون</Text>
              <View style={styles.list}>
                {suppliers.map((supplier) => {
                  const capability = supplierCapabilities(supplier.supplierProfile);
                  return (
                    <View key={supplier.id} style={styles.card}>
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
                  );
                })}
              </View>
            </View>

            <View style={styles.sideColumn}>
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>مقارنة سريعة</Text>
                <View style={styles.compareTable}>
                  {suppliers.map((supplier) => {
                    const capability = supplierCapabilities(supplier.supplierProfile);
                    return (
                      <View key={supplier.id} style={styles.compareRow}>
                        <Text style={styles.compareName} numberOfLines={1}>{supplier.displayName}</Text>
                        <Text style={styles.compareValue}>{capability.score ?? '—'}</Text>
                        <Text style={styles.compareValue}>{supplier.supplierProfile?.leadTimeDays ?? '—'}</Text>
                      </View>
                    );
                  })}
                  {suppliers.length === 0 ? <Text style={styles.panelEmpty}>لا توجد بيانات للمقارنة.</Text> : null}
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
});
