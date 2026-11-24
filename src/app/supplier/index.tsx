import { Link } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiFeedback } from '@/components/b2b/ApiFeedback';
import { AppHeader } from '@/components/b2b/AppHeader';
import { colors } from '@/components/b2b/palette';
import { containerStyle, useResponsive } from '@/components/b2b/responsive';
import {
  formatDate,
  formatNumber,
  useApiQuery,
  type ApiRfqInvitation,
} from '@/data/api';
import { useAuth } from '@/state/AuthContext';

type InvitationsPayload = { invitations: ApiRfqInvitation[] };

const invitationLabels: Record<string, string> = {
  PENDING: 'بانتظار الرد',
  ACCEPTED: 'تم تقديم العرض',
  DECLINED: 'معتذرة',
  EXPIRED: 'منتهية',
};

export default function SupplierGatewayScreen() {
  const { gutter } = useResponsive();
  const { account } = useAuth();
  const invitationsQuery = useApiQuery<InvitationsPayload>('/api/supplier-invitations?pageSize=100');
  const invitations = invitationsQuery.data?.invitations ?? [];
  const pending = invitations.filter((item) => item.status === 'PENDING').length;
  const accepted = invitations.filter((item) => item.status === 'ACCEPTED').length;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppHeader active="supplier" />
      <ScrollView contentContainerStyle={[styles.page, { paddingHorizontal: gutter }]} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.heading}>
            <View style={styles.headingCopy}>
              <Text style={styles.kicker}>بوابة المورد</Text>
              <Text style={styles.title}>مرحبًا {account?.companyName ?? 'بمورد'}</Text>
              <Text style={styles.subtitle}>تابع الدعوات الواردة وقدّم عروضك على طلبات التوريد المنشورة.</Text>
            </View>
            <Link href={'/suppliers' as any} asChild>
              <Text style={styles.link}>← استعراض السوق</Text>
            </Link>
          </View>

          <View style={styles.stats}>
            <Metric label="الدعوات" value={formatNumber(invitations.length).padStart(2, '0')} />
            <Metric label="بانتظار العرض" value={formatNumber(pending).padStart(2, '0')} />
            <Metric label="عروض مقدمة" value={formatNumber(accepted).padStart(2, '0')} />
          </View>

          <ApiFeedback
            loading={invitationsQuery.isLoading}
            error={invitationsQuery.error}
            empty={!invitationsQuery.isLoading && invitations.length === 0}
            emptyTitle="لا توجد دعوات حاليًا"
            emptyBody="ستظهر الدعوات هنا بعد أن يرسل المشترون طلبات توريد إلى موردك المعتمد."
            onRetry={() => { void invitationsQuery.refetch(); }}
          />

          <Text style={styles.sectionTitle}>طلبات مدعو إليها</Text>
          <View style={styles.list}>
            {invitations.map((invitation) => {
              const rfq = invitation.rfq;
              const status = invitationLabels[invitation.status] ?? invitation.status;
              return (
                <View key={invitation.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderCopy}>
                      <Text style={styles.cardTitle}>{rfq?.title ?? 'طلب توريد'}</Text>
                      <Text style={styles.cardMeta}>{rfq?.id ?? invitation.rfqId}</Text>
                    </View>
                    <View style={[styles.badge, invitation.status === 'PENDING' ? styles.badgePending : styles.badgeAccepted]}>
                      <Text style={[styles.badgeText, invitation.status === 'PENDING' ? styles.badgeTextPending : styles.badgeTextAccepted]}>
                        {status}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.facts}>
                    <Fact label="الكمية" value={rfq ? `${formatNumber(rfq.quantity)} ${rfq.unit}` : '—'} />
                    <Fact label="الوجهة" value={rfq?.destination ?? '—'} />
                    <Fact label="تاريخ الدعوة" value={formatDate(invitation.sentAt)} />
                  </View>
                  <Link
                    href={{ pathname: '/supplier/rfqs/[id]' as any, params: { id: invitation.rfqId } } as any}
                    asChild
                  >
                    <Text style={styles.action}>
                      {invitation.status === 'PENDING' ? 'مراجعة وتقديم عرض ←' : 'عرض التفاصيل ←'}
                    </Text>
                  </Link>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.cream },
  page: { paddingBottom: 30 },
  content: { ...containerStyle, paddingTop: 28 },
  heading: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headingCopy: { flex: 1, minWidth: 220, alignItems: 'flex-end' },
  kicker: { color: colors.green, fontSize: 11, fontWeight: '800', writingDirection: 'rtl' },
  title: { color: colors.ink, fontSize: 26, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl', marginTop: 8 },
  subtitle: { color: colors.muted, fontSize: 11, textAlign: 'right', writingDirection: 'rtl', marginTop: 6 },
  link: { color: colors.greenDark, fontSize: 11, fontWeight: '800', writingDirection: 'rtl' },
  stats: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10, marginTop: 18 },
  metric: { flexGrow: 1, flexBasis: 140, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 14 },
  metricLabel: { color: colors.muted, fontSize: 10, textAlign: 'right', writingDirection: 'rtl' },
  metricValue: { color: colors.ink, fontSize: 24, fontWeight: '900', textAlign: 'right', marginTop: 9 },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl', marginTop: 24, marginBottom: 12 },
  list: { gap: 12 },
  card: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 16 },
  cardHeader: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  cardHeaderCopy: { flex: 1, minWidth: 0, alignItems: 'flex-end' },
  cardTitle: { color: colors.ink, fontSize: 15, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  cardMeta: { color: colors.muted, fontSize: 9, textAlign: 'right', writingDirection: 'rtl', marginTop: 5 },
  badge: { minHeight: 26, paddingHorizontal: 9, borderRadius: 7, justifyContent: 'center' },
  badgePending: { backgroundColor: colors.amberLight },
  badgeAccepted: { backgroundColor: colors.greenLight },
  badgeText: { fontSize: 9, fontWeight: '800', writingDirection: 'rtl' },
  badgeTextPending: { color: colors.amber },
  badgeTextAccepted: { color: colors.greenDark },
  facts: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10, marginTop: 15 },
  fact: { flex: 1, minWidth: 100, backgroundColor: '#F7F9F5', borderRadius: 8, padding: 9 },
  factLabel: { color: colors.muted, fontSize: 8, textAlign: 'right', writingDirection: 'rtl' },
  factValue: { color: colors.ink, fontSize: 11, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl', marginTop: 5 },
  action: { color: colors.greenDark, fontSize: 11, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl', marginTop: 16 },
});
