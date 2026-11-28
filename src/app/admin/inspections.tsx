import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiFeedback } from '@/components/b2b/ApiFeedback';
import { AppHeader } from '@/components/b2b/AppHeader';
import { StatusPill } from '@/components/b2b/StatusPill';
import { lifecycleStyles as s } from '@/components/b2b/lifecycleStyles';
import { MotionPressable, ScreenEntrance } from '@/components/b2b/motion';
import {
  formatDate,
  INSPECTION_STATUS,
  statusInfo,
  useApiMutation,
  useApiQuery,
  type ApiInspectionReport,
} from '@/data/api';

type ReportsPayload = { reports: ApiInspectionReport[] };

export default function AdminInspectionsScreen() {
  const reportsQuery = useApiQuery<ReportsPayload>('/api/admin/inspection-reports', 10_000, 10_000);
  const changeStatus = useApiMutation<{ report: ApiInspectionReport }>();
  const reports = reportsQuery.data?.reports ?? [];

  const update = async (report: ApiInspectionReport, status: 'APPROVED' | 'REJECTED') => {
    try {
      await changeStatus.mutateAsync({
        path: `/api/inspection-reports/${report.id}/status`,
        body: { status, notes: status === 'APPROVED' ? 'تمت المراجعة من قبل إدارة المنصة.' : 'مرفوض بعد المراجعة.' },
      });
    } catch {
      // handled by mutation error rendering
    }
  };

  return (
    <SafeAreaView style={s.safeArea} edges={['top']}>
      <AppHeader active="admin" />
      <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
        <ScreenEntrance style={s.content}>
          <View style={s.headingRow}>
            <View style={s.headingCopy}>
              <Text style={s.kicker}>Audit review queue</Text>
              <Text style={s.pageTitle}>مراجعة تقارير التدقيق والفحص</Text>
              <Text style={s.pageSubtitle}>تعتمد هنا تقارير المصانع قبل ظهورها للمشترين كـ «مصنع مدقق».</Text>
            </View>
          </View>

          <ApiFeedback
            loading={reportsQuery.isLoading}
            error={reportsQuery.error ?? changeStatus.error}
            empty={!reportsQuery.isLoading && reports.length === 0}
            emptyTitle="لا توجد تقارير بانتظار المراجعة"
            emptyBody="ستظهر التقارير المقدمة من المصانع والجهات المستقلة هنا."
            onRetry={() => { void reportsQuery.refetch(); }}
          />

          <View style={s.list}>
            {reports.map((report) => {
              const info = statusInfo(INSPECTION_STATUS, report.status);
              return (
                <View key={report.id} style={s.card}>
                  <View style={s.cardHeader}>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={s.cardTitle}>{report.kind} · {report.issuer}</Text>
                      <Text style={s.meta}>{report.organization?.displayName ?? 'مصنع'}</Text>
                    </View>
                    <StatusPill label={info.label} tone={info.tone} small />
                  </View>
                  <View style={s.detailRow}><Text style={s.detailLabel}>رقم التقرير</Text><Text style={s.detailValue}>{report.reportNumber ?? '—'}</Text></View>
                  <View style={s.detailRow}><Text style={s.detailLabel}>تاريخ الإصدار</Text><Text style={s.detailValue}>{formatDate(report.issuedAt)}</Text></View>
                  <View style={s.detailRow}><Text style={s.detailLabel}>النتيجة</Text><Text style={s.detailValue}>{report.score === null ? '—' : `${report.score}/100`}</Text></View>
                  <Text style={s.body}>{report.notes ?? report.scope ?? 'لا توجد ملاحظات.'}</Text>
                  <Text style={s.meta}>الملف: {report.objectKey}</Text>
                  <View style={s.buttonRow}>
                    <MotionPressable accessibilityRole="button" style={s.button} onPress={() => { void update(report, 'APPROVED'); }}>
                      <Text style={s.buttonText}>اعتماد التقرير</Text>
                    </MotionPressable>
                    <MotionPressable accessibilityRole="button" style={[s.button, { backgroundColor: '#FBECE2' }]} onPress={() => { void update(report, 'REJECTED'); }}>
                      <Text style={[s.buttonText, { color: '#8A4A29' }]}>رفض</Text>
                    </MotionPressable>
                  </View>
                </View>
              );
            })}
          </View>
        </ScreenEntrance>
      </ScrollView>
    </SafeAreaView>
  );
}
