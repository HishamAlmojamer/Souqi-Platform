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
  formatMoney,
  formatNumber,
  INSPECTION_STATUS,
  statusInfo,
  VERIFICATION_STATUS,
  useApiQuery,
  type ApiInspectionReport,
  type ApiProduct,
} from '@/data/api';

type ProductPayload = { product: ApiProduct };
type ReportsPayload = { reports: ApiInspectionReport[] };

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const productQuery = useApiQuery<ProductPayload>(id ? `/api/products/${id}` : null);
  const product = productQuery.data?.product;
  const reportsQuery = useApiQuery<ReportsPayload>(
    product?.supplierOrgId ? `/api/suppliers/${product.supplierOrgId}/inspection-reports` : null,
  );
  const reports = reportsQuery.data?.reports ?? [];

  return (
    <SafeAreaView style={s.safeArea} edges={['top']}>
      <AppHeader active="suppliers" />
      <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
        <ScreenEntrance style={s.content}>
          <View style={s.headingRow}>
            <View style={s.headingCopy}>
              <Text style={s.kicker}>Product detail</Text>
              <Text style={s.pageTitle}>{product?.title ?? 'تفاصيل المنتج'}</Text>
              <Text style={s.pageSubtitle}>{product?.category ?? '—'}</Text>
            </View>
          </View>

          <ApiFeedback
            loading={productQuery.isLoading}
            error={productQuery.error}
            onRetry={() => { void productQuery.refetch(); }}
          />

          {product ? (
            <View style={[s.grid, s.gridWide]}>
              <View style={s.mainColumn}>
                <View style={s.panel}>
                  <Text style={s.panelTitle}>المواصفات التجارية</Text>
                  <Text style={s.body}>{product.description}</Text>
                  <View style={s.detailRow}>
                    <Text style={s.detailLabel}>السعر التقديري</Text>
                    <Text style={s.detailValue}>{product.priceCents ? formatMoney(product.priceCents, product.currency) : 'عند الطلب'}</Text>
                  </View>
                  <View style={s.detailRow}>
                    <Text style={s.detailLabel}>الحد الأدنى للطلب</Text>
                    <Text style={s.detailValue}>{formatNumber(product.minOrderQuantity)}</Text>
                  </View>
                  <View style={s.detailRow}>
                    <Text style={s.detailLabel}>مهلة الإنتاج</Text>
                    <Text style={s.detailValue}>{product.leadTimeDays ? `${formatNumber(product.leadTimeDays)} يوم` : '—'}</Text>
                  </View>
                  <View style={s.detailRow}>
                    <Text style={s.detailLabel}>الشهادات</Text>
                    <Text style={s.detailValue}>{product.certifications.length ? product.certifications.join('، ') : '—'}</Text>
                  </View>
                </View>

                <View style={s.panel}>
                  <Text style={s.panelTitle}>ملفات المنتج</Text>
                  {product.media?.length ? (
                    product.media.map((media) => (
                      <View key={media.id} style={s.detailRow}>
                        <Text style={s.detailLabel}>{media.kind}</Text>
                        <Text style={s.detailValue}>{media.caption ?? media.objectKey}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={s.empty}>لا توجد صور أو ملفات مرفقة بعد.</Text>
                  )}
                </View>
              </View>

              <View style={s.sideColumn}>
                <View style={s.panel}>
                  <Text style={s.panelTitle}>المصنع</Text>
                  <Text style={s.cardTitle}>{product.supplierOrg?.displayName ?? '—'}</Text>
                  <Text style={s.meta}>{product.supplierOrg?.countryCode ?? '—'}</Text>
                  <View style={{ marginTop: 10 }}>
                    {(() => {
                      const info = statusInfo(VERIFICATION_STATUS, product.supplierOrg?.supplierProfile?.verificationStatus ?? 'UNVERIFIED');
                      return <StatusPill label={info.label} tone={info.tone} small />;
                    })()}
                  </View>
                  <Link href="/rfq/new" asChild>
                    <View style={[s.button, { marginTop: 16 }]}>
                      <Text style={s.buttonText}>اطلب عرض تصنيع</Text>
                    </View>
                  </Link>
                </View>

                <View style={s.panel}>
                  <Text style={s.panelTitle}>تقارير التدقيق والفحص</Text>
                  <Text style={s.panelSubtitle}>تقارير معتمدة قابلة للمراجعة قبل التعاقد.</Text>
                  <ApiFeedback loading={reportsQuery.isLoading} error={reportsQuery.error} onRetry={() => { void reportsQuery.refetch(); }} />
                  {reports.length === 0 && !reportsQuery.isLoading ? <Text style={s.empty}>لا توجد تقارير معتمدة لهذا المصنع.</Text> : null}
                  {reports.map((report) => {
                    const info = statusInfo(INSPECTION_STATUS, report.status);
                    return (
                      <View key={report.id} style={s.card}>
                        <View style={s.cardHeader}>
                          <Text style={s.cardTitle}>{report.kind}</Text>
                          <StatusPill label={info.label} tone={info.tone} small />
                        </View>
                        <Text style={s.meta}>{report.issuer} · {report.reportNumber ?? 'بدون رقم'}</Text>
                        <Text style={s.meta}>تاريخ الإصدار: {formatDate(report.issuedAt)}</Text>
                        <Text style={s.meta}>الملف: {report.objectKey}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          ) : null}
        </ScreenEntrance>
      </ScrollView>
    </SafeAreaView>
  );
}
