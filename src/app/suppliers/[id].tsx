import { Link, useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiFeedback } from '@/components/b2b/ApiFeedback';
import { AppHeader } from '@/components/b2b/AppHeader';
import { StatusPill } from '@/components/b2b/StatusPill';
import { lifecycleStyles as s } from '@/components/b2b/lifecycleStyles';
import { ScreenEntrance } from '@/components/b2b/motion';
import {
  formatDate,
  formatNumber,
  INSPECTION_STATUS,
  statusInfo,
  supplierCapabilities,
  VERIFICATION_STATUS,
  useApiQuery,
  type ApiInspectionReport,
  type ApiProduct,
  type ApiSupplier,
} from '@/data/api';

type SupplierPayload = { supplier: ApiSupplier & { products?: ApiProduct[]; inspectionReports?: ApiInspectionReport[] } };

export default function SupplierDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useApiQuery<SupplierPayload>(id ? `/api/suppliers/${id}` : null);
  const supplier = query.data?.supplier;
  const capabilities = supplierCapabilities(supplier?.supplierProfile);
  const verification = statusInfo(VERIFICATION_STATUS, supplier?.supplierProfile?.verificationStatus ?? 'UNVERIFIED');

  return (
    <SafeAreaView style={s.safeArea} edges={['top']}>
      <AppHeader active="suppliers" />
      <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
        <ScreenEntrance style={s.content}>
          <View style={s.headingRow}>
            <View style={s.headingCopy}>
              <Text style={s.kicker}>Factory profile</Text>
              <Text style={s.pageTitle}>{supplier?.displayName ?? 'ملف المصنع'}</Text>
              <Text style={s.pageSubtitle}>{supplier?.legalName ?? ''}</Text>
            </View>
            <Link href="/suppliers" asChild>
              <View style={s.returnButton}>
                <Text style={s.returnButtonText}>← العودة للموردين</Text>
              </View>
            </Link>
          </View>

          <ApiFeedback loading={query.isLoading} error={query.error} onRetry={() => { void query.refetch(); }} />

          {supplier ? (
            <View style={[s.grid, s.gridWide]}>
              <View style={s.mainColumn}>
                <View style={s.panel}>
                  <View style={s.cardHeader}>
                    <Text style={s.panelTitle}>بيانات التحقق</Text>
                    <StatusPill label={verification.label} tone={verification.tone} small />
                  </View>
                  <View style={s.detailRow}><Text style={s.detailLabel}>رقم الرخصة</Text><Text style={s.detailValue}>{supplier.supplierProfile?.licenseNumber ?? '—'}</Text></View>
                  <View style={s.detailRow}><Text style={s.detailLabel}>المساحة</Text><Text style={s.detailValue}>{supplier.supplierProfile?.floorAreaSqm ? `${formatNumber(supplier.supplierProfile.floorAreaSqm)} م²` : '—'}</Text></View>
                  <View style={s.detailRow}><Text style={s.detailLabel}>خطوط الإنتاج</Text><Text style={s.detailValue}>{formatNumber(supplier.supplierProfile?.productionLines ?? 0)}</Text></View>
                  <View style={s.detailRow}><Text style={s.detailLabel}>فريق البحث</Text><Text style={s.detailValue}>{formatNumber(supplier.supplierProfile?.rdStaffCount ?? 0)}</Text></View>
                  <View style={s.detailRow}><Text style={s.detailLabel}>الطاقة السنوية</Text><Text style={s.detailValue}>{supplier.supplierProfile?.annualCapacity ?? '—'}</Text></View>
                  <View style={s.detailRow}><Text style={s.detailLabel}>الشهادات</Text><Text style={s.detailValue}>{supplier.supplierProfile?.certifications?.join('، ') ?? '—'}</Text></View>
                  <View style={s.detailRow}><Text style={s.detailLabel}>التخصص</Text><Text style={s.detailValue}>{capabilities.category}</Text></View>
                </View>

                <View style={s.panel}>
                  <Text style={s.panelTitle}>المنتجات</Text>
                  {(supplier.products ?? []).length === 0 ? <Text style={s.empty}>لا توجد منتجات منشورة.</Text> : null}
                  {(supplier.products ?? []).map((product) => (
                    <Link key={product.id} href={`/products/${product.id}`} asChild>
                      <View style={s.card}>
                        <Text style={s.cardTitle}>{product.title}</Text>
                        <Text style={s.meta}>{product.category} · {product.currency}</Text>
                      </View>
                    </Link>
                  ))}
                </View>
              </View>

              <View style={s.sideColumn}>
                <View style={s.panel}>
                  <Text style={s.panelTitle}>تقارير معتمدة</Text>
                  {(supplier.inspectionReports ?? []).length === 0 ? <Text style={s.empty}>لا توجد تقارير معتمدة.</Text> : null}
                  {(supplier.inspectionReports ?? []).map((report) => {
                    const info = statusInfo(INSPECTION_STATUS, report.status);
                    return (
                      <View key={report.id} style={s.card}>
                        <View style={s.cardHeader}>
                          <Text style={s.cardTitle}>{report.kind}</Text>
                          <StatusPill label={info.label} tone={info.tone} small />
                        </View>
                        <Text style={s.meta}>{report.issuer}</Text>
                        <Text style={s.meta}>الصلاحية حتى: {formatDate(report.expiresAt)}</Text>
                        <Text style={s.meta}>{report.objectKey}</Text>
                      </View>
                    );
                  })}
                </View>
                <View style={s.panel}>
                  <Text style={s.panelTitle}>ابدأ التفاوض</Text>
                  <Link href="/rfq/new" asChild>
                    <View style={s.button}>
                      <Text style={s.buttonText}>إرسال طلب عرض</Text>
                    </View>
                  </Link>
                </View>
              </View>
            </View>
          ) : null}
        </ScreenEntrance>
      </ScrollView>
    </SafeAreaView>
  );
}
