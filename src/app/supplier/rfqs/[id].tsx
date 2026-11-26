import { Link, useLocalSearchParams } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiFeedback } from '@/components/b2b/ApiFeedback';
import { AppHeader } from '@/components/b2b/AppHeader';
import { FeedbackBanner, MotionPressable, ScreenEntrance } from '@/components/b2b/motion';
import { colors } from '@/components/b2b/palette';
import { containerStyle, useResponsive } from '@/components/b2b/responsive';
import {
  errorMessage,
  formatDate,
  formatNumber,
  schemaFields,
  statusInfo,
  RFQ_STATUS,
  useApiMutation,
  useApiQuery,
  type ApiQuote,
  type ApiRfq,
  type ApiSchemaVersion,
} from '@/data/api';
import { useAuth } from '@/state/AuthContext';

type RfqPayload = { rfq: ApiRfq };
type SchemaPayload = { version: ApiSchemaVersion };
type QuotePayload = { quote: ApiQuote };

function defaultValidUntil() {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  return date.toISOString().slice(0, 10);
}

export default function SupplierQuoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { gutter } = useResponsive();
  const { activeOrganization } = useAuth();
  const rfqQuery = useApiQuery<RfqPayload>(id ? `/api/rfqs/${id}` : null);
  const rfq = rfqQuery.data?.rfq;
  const schemaQuery = useApiQuery<SchemaPayload>(rfq?.schemaVersionId ? `/api/schema-versions/${rfq.schemaVersionId}` : null);
  const fields = useMemo(() => schemaFields(schemaQuery.data?.version?.schemaJson), [schemaQuery.data?.version?.schemaJson]);
  const submitQuote = useApiMutation<QuotePayload>();
  const [revision, setRevision] = useState('1');
  const [leadTimeDays, setLeadTimeDays] = useState('14');
  const [unitPriceCents, setUnitPriceCents] = useState('18000');
  const [validUntil, setValidUntil] = useState(defaultValidUntil);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [submittedQuote, setSubmittedQuote] = useState<ApiQuote | null>(null);

  const total = Number(unitPriceCents || 0) * (rfq?.quantity ?? 0);
  const status = statusInfo(RFQ_STATUS, rfq?.status ?? 'DRAFT');

  const handleSubmit = async () => {
    setError('');
    if (!rfq || !activeOrganization) {
      setError('بيانات الطلب أو المؤسسة غير متاحة بعد.');
      return;
    }
    const parsedRevision = Number(revision);
    const parsedLeadTime = Number(leadTimeDays);
    const parsedPrice = Number(unitPriceCents);
    if (!Number.isSafeInteger(parsedRevision) || parsedRevision < 1) {
      setError('رقم المراجعة يجب أن يكون رقمًا صحيحًا.');
      return;
    }
    if (!Number.isSafeInteger(parsedLeadTime) || parsedLeadTime < 1) {
      setError('مهلة التسليم يجب أن تكون بالأيام.');
      return;
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setError('أدخل سعر وحدة صحيحًا بالهللات.');
      return;
    }
    const validDate = new Date(validUntil);
    if (Number.isNaN(validDate.getTime())) {
      setError('تاريخ صلاحية العرض غير صالح.');
      return;
    }

    try {
      const result = await submitQuote.mutateAsync({
        path: '/api/quotes',
        method: 'POST',
        body: {
          rfqId: rfq.id,
          supplierOrgId: activeOrganization.id,
          revision: parsedRevision,
          currency: rfq.currency,
          leadTimeDays: parsedLeadTime,
          validUntil: validDate.toISOString(),
          notes: notes.trim() || null,
          lines: [
            {
              name: rfq.title,
              quantity: rfq.quantity,
              unitPriceCents: Math.round(parsedPrice),
            },
          ],
        },
      });
      setSubmittedQuote(result.quote);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppHeader active="supplier" />
      <ScrollView contentContainerStyle={[styles.page, { paddingHorizontal: gutter }]} showsVerticalScrollIndicator={false}>
        <ScreenEntrance style={styles.content}>
          <View style={styles.topRow}>
            <Link href={'/supplier' as any} asChild>
              <Text style={styles.back}>← عودة للدعوات</Text>
            </Link>
            <Text style={styles.kicker}>تقديم عرض تسعير</Text>
          </View>

          <ApiFeedback
            loading={rfqQuery.isLoading}
            error={rfqQuery.error}
            empty={!rfqQuery.isLoading && !rfq}
            emptyTitle="الطلب غير متاح"
            emptyBody="تأكد من أن لديك دعوة صالحة لمراجعة هذا الطلب."
            onRetry={() => { void rfqQuery.refetch(); }}
          />

          {rfq ? (
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <Text style={styles.title}>{rfq.title}</Text>
                <View style={styles.status}><Text style={styles.statusText}>{status.label}</Text></View>
              </View>
              <Text style={styles.summary}>{rfq.destination}</Text>
              <View style={styles.facts}>
                <Fact label="الكمية" value={`${formatNumber(rfq.quantity)} ${rfq.unit}`} />
                <Fact label="الموعد" value={formatDate(rfq.targetDate)} />
                <Fact label="العملة" value={rfq.currency} />
              </View>
              {fields.length > 0 ? (
                <View style={styles.requirements}>
                  <Text style={styles.sectionTitle}>المواصفات المطلوبة</Text>
                  {fields.map((field) => (
                    <View key={field.id} style={styles.requirementRow}>
                      <Text style={styles.requirementLabel}>{field.label}</Text>
                      <Text style={styles.requirementValue}>{String(rfq.requirements?.[field.id] ?? '—')}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {rfq ? (
            <View style={styles.formCard}>
              <Text style={styles.sectionTitle}>بيانات العرض</Text>
              <View style={styles.fields}>
                <Field label="رقم المراجعة">
                  <TextInput
                    value={revision}
                    onChangeText={setRevision}
                    style={styles.input}
                    keyboardType="numeric"
                    textAlign="right"
                  />
                </Field>
                <Field label="مهلة التسليم (يوم)">
                  <TextInput
                    value={leadTimeDays}
                    onChangeText={setLeadTimeDays}
                    style={styles.input}
                    keyboardType="numeric"
                    textAlign="right"
                  />
                </Field>
                <Field label="سعر الوحدة (هللات)">
                  <TextInput
                    value={unitPriceCents}
                    onChangeText={setUnitPriceCents}
                    style={styles.input}
                    keyboardType="numeric"
                    textAlign="right"
                  />
                </Field>
                <Field label="صلاحية العرض">
                  <TextInput
                    value={validUntil}
                    onChangeText={setValidUntil}
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#8A948D"
                    textAlign="right"
                  />
                </Field>
              </View>
              <Field label="ملاحظات للمشتري">
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  style={[styles.input, styles.textArea]}
                  placeholder="اشرح الخامة أو شروط الإنتاج أو الاستثناءات"
                  placeholderTextColor="#8A948D"
                  textAlign="right"
                  multiline
                />
              </Field>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>الإجمالي التقديري</Text>
                <Text style={styles.totalValue}>{formatNumber(total)} {rfq.currency}</Text>
              </View>
              {error ? <FeedbackBanner text={error} tone="error" /> : null}
              {submittedQuote ? (
                <>
                  <FeedbackBanner text={`تم تسجيل العرض ${submittedQuote.id} بنجاح.`} tone="success" />
                  <Link href={'/supplier' as any} asChild>
                    <Text style={styles.successLink}>العودة إلى الدعوات ←</Text>
                  </Link>
                </>
              ) : null}
              <MotionPressable
                accessibilityRole="button"
                disabled={submitQuote.isPending || rfq.status !== 'PUBLISHED'}
                onPress={() => { void handleSubmit(); }}
                style={[styles.submit, submitQuote.isPending && styles.submitDisabled]}
              >
                <Text style={styles.submitText}>
                  {rfq.status === 'PUBLISHED' ? 'إرسال العرض للمشتري' : 'الطلب غير مفتوح لاستقبال العروض'}
                </Text>
              </MotionPressable>
            </View>
          ) : null}
        </ScreenEntrance>
      </ScrollView>
    </SafeAreaView>
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.cream },
  page: { paddingBottom: 32 },
  content: { ...containerStyle, paddingTop: 24 },
  topRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  back: { color: colors.greenDark, fontSize: 11, fontWeight: '800', writingDirection: 'rtl' },
  kicker: { color: colors.green, fontSize: 11, fontWeight: '800', writingDirection: 'rtl' },
  summaryCard: { marginTop: 18, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 16 },
  summaryHeader: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { flex: 1, minWidth: 180, color: colors.ink, fontSize: 20, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  status: { backgroundColor: colors.greenLight, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 6 },
  statusText: { color: colors.greenDark, fontSize: 9, fontWeight: '800', writingDirection: 'rtl' },
  summary: { color: colors.muted, fontSize: 11, textAlign: 'right', writingDirection: 'rtl', marginTop: 12 },
  facts: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10, marginTop: 15 },
  fact: { flex: 1, minWidth: 95, backgroundColor: '#F7F9F5', borderRadius: 8, padding: 9 },
  factLabel: { color: colors.muted, fontSize: 8, textAlign: 'right', writingDirection: 'rtl' },
  factValue: { color: colors.ink, fontSize: 11, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl', marginTop: 5 },
  requirements: { marginTop: 18, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 14 },
  requirementRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EEF0EC' },
  requirementLabel: { flex: 1, minWidth: 100, color: colors.muted, fontSize: 10, textAlign: 'right', writingDirection: 'rtl' },
  requirementValue: { flex: 1.2, minWidth: 120, color: colors.ink, fontSize: 10, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  formCard: { marginTop: 18, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 16 },
  sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl', marginBottom: 12 },
  fields: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 12 },
  field: { flex: 1, minWidth: 140, marginBottom: 14 },
  fieldLabel: { color: colors.inkSoft, fontSize: 11, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl', marginBottom: 7 },
  input: { minHeight: 46, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FBFBF9', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, color: colors.ink, fontSize: 12, textAlign: 'right', writingDirection: 'rtl' },
  textArea: { minHeight: 90 },
  totalRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 10, backgroundColor: colors.greenLight, borderRadius: 9, padding: 12, marginTop: 4 },
  totalLabel: { color: colors.greenDark, fontSize: 11, fontWeight: '800', writingDirection: 'rtl' },
  totalValue: { color: colors.greenDark, fontSize: 15, fontWeight: '900', writingDirection: 'rtl' },
  error: { color: colors.red, fontSize: 11, textAlign: 'right', writingDirection: 'rtl', marginTop: 12 },
  success: { backgroundColor: colors.greenLight, borderRadius: 9, padding: 12, marginTop: 12 },
  successText: { color: colors.greenDark, fontSize: 11, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  successLink: { color: colors.greenDark, fontSize: 10, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl', marginTop: 7 },
  submit: { minHeight: 48, borderRadius: 9, backgroundColor: colors.greenDark, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  submitDisabled: { opacity: 0.55 },
  submitText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', writingDirection: 'rtl' },
});
