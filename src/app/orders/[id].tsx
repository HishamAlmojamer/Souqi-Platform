import { Link, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiFeedback } from '@/components/b2b/ApiFeedback';
import { AppHeader } from '@/components/b2b/AppHeader';
import { FeedbackBanner, MotionPressable, ScreenEntrance } from '@/components/b2b/motion';
import { StatusPill } from '@/components/b2b/StatusPill';
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
  useApiQuery,
  type ApiEvidence,
  type ApiPurchaseOrder,
} from '@/data/api';
import { useAuth } from '@/state/AuthContext';

type OrderPayload = { purchaseOrder: ApiPurchaseOrder };

function seedChecksum() {
  return `sha256-${Date.now().toString(36)}`;
}

export default function PurchaseOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { gutter } = useResponsive();
  const { activeOrganization, hasPermission } = useAuth();
  const orderQuery = useApiQuery<OrderPayload>(id ? `/api/purchase-orders/${id}` : null);
  const order = orderQuery.data?.purchaseOrder;
  const registerEvidence = useApiMutation<{ evidence: ApiEvidence }>();

  const [objectKey, setObjectKey] = useState('');
  const [classification, setClassification] = useState('أدلة الجودة');
  const [checksum, setChecksum] = useState(seedChecksum);
  const [mimeType, setMimeType] = useState('application/pdf');
  const [sizeBytes, setSizeBytes] = useState('248000');
  const [milestoneId, setMilestoneId] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const milestones = order?.milestones ?? [];
  const samples = order?.samples ?? [];
  const evidenceFiles = order?.evidenceFiles ?? [];
  const status = statusInfo(PO_STATUS, order?.status ?? 'ACTIVE');

  const handleEvidence = async () => {
    setFormError('');
    setFormSuccess('');
    const size = Number(sizeBytes);
    if (!activeOrganization) {
      setFormError('لم يتم تحميل المؤسسة الحالية بعد.');
      return;
    }
    if (!objectKey.trim() || !classification.trim() || !mimeType.trim()) {
      setFormError('يرجى إدخال مفتاح الملف والتصنيف ونوع الملف.');
      return;
    }
    if (checksum.trim().length < 8) {
      setFormError('يجب ألا يقل طول بصمة الملف عن ٨ أحرف.');
      return;
    }
    if (!Number.isSafeInteger(size) || size <= 0) {
      setFormError('أدخل حجم ملف صحيحًا بالبايت.');
      return;
    }
    try {
      const result = await registerEvidence.mutateAsync({
        path: '/api/evidence',
        method: 'POST',
        body: {
          organizationId: activeOrganization.id,
          purchaseOrderId: id,
          milestoneId: milestoneId || null,
          objectKey: `${activeOrganization.id}/${objectKey.trim().replace(/^\/+/, '')}`,
          checksum: checksum.trim(),
          mimeType: mimeType.trim(),
          sizeBytes: size,
          classification: classification.trim(),
        },
      });
      setFormSuccess(`تم تسجيل الدليل ${result.evidence?.id ?? ''}.`);
      setObjectKey('');
      setChecksum(seedChecksum());
    } catch (cause) {
      setFormError(errorMessage(cause));
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppHeader active="orders" />
      <ScrollView contentContainerStyle={[styles.page, { paddingHorizontal: gutter }]} showsVerticalScrollIndicator={false}>
        <ScreenEntrance style={styles.content}>
          <View style={styles.topRow}>
            <Link href={'/production' as any} asChild>
              <Pressable accessibilityRole="button" style={styles.backButton}>
                <Text style={styles.backButtonText}>← عودة للتنفيذ</Text>
              </Pressable>
            </Link>
            <View style={styles.headerMeta}>
              <Text style={styles.kicker}>تفاصيل أمر التوريد</Text>
              <Text style={styles.requestId}>{order?.id ?? id}</Text>
            </View>
          </View>

          <ApiFeedback
            loading={orderQuery.isLoading}
            error={orderQuery.error}
            empty={!orderQuery.isLoading && !order}
            emptyTitle="أمر الشراء غير متاح"
            emptyBody="تأكد من أن لديك صلاحية الاطلاع على هذا الأمر."
            onRetry={() => { void orderQuery.refetch(); }}
          />

          {order ? (
            <>
              <View style={styles.summaryCard}>
                <View style={styles.summaryHeader}>
                  <View style={styles.summaryCopy}>
                    <Text style={styles.title}>{order.rfq?.title ?? 'أمر توريد'}</Text>
                    <Text style={styles.subtitle}>{order.supplierOrg?.displayName ?? '—'}</Text>
                  </View>
                  <StatusPill label={status.label} tone={status.tone} />
                </View>
                <View style={styles.facts}>
                  <Fact label="الكمية" value={order.rfq ? `${formatNumber(order.rfq.quantity)} ${order.rfq.unit}` : '—'} />
                  <Fact label="مراجعة العرض" value={formatNumber(order.quote?.revision ?? 0)} />
                  <Fact label="تاريخ الإنشاء" value={formatDate(order.createdAt)} />
                  <Fact label="آخر تحديث" value={formatDate(order.updatedAt)} />
                </View>
                <View style={styles.partyRow}>
                  <Text style={styles.partyText}>المشتري: {order.buyerOrganization?.displayName ?? '—'}</Text>
                  <Text style={styles.partyText}>المورد: {order.supplierOrg?.displayName ?? '—'}</Text>
                </View>
              </View>

              <View style={styles.grid}>
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>مراحل الإنتاج</Text>
                  {milestones.length > 0 ? milestones.map((milestone) => {
                    const milestoneStatus = statusInfo(MILESTONE_STATUS, milestone.status);
                    return (
                      <View key={milestone.id} style={styles.row}>
                        <View style={styles.rowCopy}>
                          <Text style={styles.rowTitle}>{milestone.code}</Text>
                          <Text style={styles.rowMeta}>
                            {milestone.plannedAt ? formatDate(milestone.plannedAt) : 'بدون موعد مخطط'}
                            {milestone.completedAt ? ` · اكتمل ${formatDate(milestone.completedAt)}` : ''}
                          </Text>
                        </View>
                        <StatusPill label={milestoneStatus.label} tone={milestoneStatus.tone} small />
                      </View>
                    );
                  }) : <Text style={styles.emptyDetail}>لا توجد مراحل مسجلة على هذا الأمر.</Text>}
                </View>

                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>العينات</Text>
                  {samples.length > 0 ? samples.map((sample) => {
                    const sampleStatus = statusInfo(SAMPLE_STATUS, sample.status);
                    return (
                      <View key={sample.id} style={styles.row}>
                        <View style={styles.rowCopy}>
                          <Text style={styles.rowTitle}>العينة {formatNumber(sample.version)}</Text>
                          <Text style={styles.rowMeta}>
                            {formatDate(sample.receivedAt ?? sample.shippedAt ?? sample.createdAt)}
                            {sample.notes ? ` · ${sample.notes}` : ''}
                          </Text>
                        </View>
                        <StatusPill label={sampleStatus.label} tone={sampleStatus.tone} small />
                      </View>
                    );
                  }) : <Text style={styles.emptyDetail}>لا توجد عينات مسجلة على هذا الأمر.</Text>}
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>ملفات الأدلة</Text>
                {evidenceFiles.length > 0 ? evidenceFiles.map((evidence) => (
                  <View key={evidence.id} style={styles.evidenceRow}>
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle}>{evidence.classification}</Text>
                      <Text style={styles.rowMeta} numberOfLines={1}>{evidence.objectKey}</Text>
                      <Text style={styles.rowMeta}>
                        {evidence.mimeType ?? '—'} · {evidence.sizeBytes ? `${formatNumber(evidence.sizeBytes)} بايت` : '—'} · {formatDate(evidence.createdAt)}
                      </Text>
                    </View>
                    <View style={styles.evidenceBadge}>
                      <Text style={styles.evidenceBadgeText}>{evidence.scanStatus}</Text>
                    </View>
                  </View>
                )) : <Text style={styles.emptyDetail}>لم تُسجّل أدلة على هذا الأمر بعد.</Text>}

                {hasPermission('evidence.upload') ? (
                  <View style={styles.evidenceForm}>
                    <Text style={styles.formTitle}>تسجيل دليل جديد</Text>
                    <View style={styles.formGrid}>
                      <Field label="مفتاح الملف">
                        <TextInput value={objectKey} onChangeText={setObjectKey} style={styles.input} placeholder="quality/report-01.pdf" placeholderTextColor="#8A948D" textAlign="right" />
                      </Field>
                      <Field label="التصنيف">
                        <TextInput value={classification} onChangeText={setClassification} style={styles.input} textAlign="right" />
                      </Field>
                      <Field label="نوع الملف">
                        <TextInput value={mimeType} onChangeText={setMimeType} style={styles.input} textAlign="right" />
                      </Field>
                      <Field label="الحجم بالبايت">
                        <TextInput value={sizeBytes} onChangeText={setSizeBytes} style={styles.input} keyboardType="numeric" textAlign="right" />
                      </Field>
                      <Field label="بصمة الملف">
                        <TextInput value={checksum} onChangeText={setChecksum} style={styles.input} textAlign="right" />
                      </Field>
                      <Field label="المرحلة (اختياري)">
                        <TextInput value={milestoneId} onChangeText={setMilestoneId} style={styles.input} placeholder="معرّف المرحلة" placeholderTextColor="#8A948D" textAlign="right" />
                      </Field>
                    </View>
                    {formError ? <FeedbackBanner text={formError} tone="error" /> : null}
                    {formSuccess ? <FeedbackBanner text={formSuccess} tone="success" /> : null}
                    <MotionPressable
                      accessibilityRole="button"
                      disabled={registerEvidence.isPending}
                      onPress={() => { void handleEvidence(); }}
                      style={[styles.submit, registerEvidence.isPending && styles.submitDisabled]}
                    >
                      <Text style={styles.submitText}>تسجيل الدليل</Text>
                    </MotionPressable>
                  </View>
                ) : null}
              </View>
            </>
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
  content: { ...containerStyle, paddingTop: 28 },
  topRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  backButton: { minHeight: 42, paddingHorizontal: 14, borderRadius: 8, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center' },
  backButtonText: { color: colors.greenDark, fontSize: 11, fontWeight: '800', writingDirection: 'rtl' },
  headerMeta: { alignItems: 'flex-end' },
  kicker: { color: colors.green, fontSize: 11, fontWeight: '800', writingDirection: 'rtl' },
  requestId: { color: colors.ink, fontSize: 13, fontWeight: '800', writingDirection: 'rtl', marginTop: 5 },
  summaryCard: { marginTop: 18, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 16 },
  summaryHeader: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  summaryCopy: { flex: 1, minWidth: 180, alignItems: 'flex-end' },
  title: { color: colors.ink, fontSize: 21, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  subtitle: { color: colors.muted, fontSize: 11, textAlign: 'right', writingDirection: 'rtl', marginTop: 7 },
  facts: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  fact: { flex: 1, minWidth: 120, backgroundColor: '#F7F9F5', borderRadius: 8, padding: 10 },
  factLabel: { color: colors.muted, fontSize: 8, textAlign: 'right', writingDirection: 'rtl' },
  factValue: { color: colors.ink, fontSize: 11, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl', marginTop: 5 },
  partyRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 12, marginTop: 14 },
  partyText: { color: colors.inkSoft, fontSize: 10, fontWeight: '700', writingDirection: 'rtl' },
  grid: { marginTop: 18, gap: 18 },
  card: { marginTop: 18, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 16 },
  sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl', marginBottom: 12 },
  row: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EEF0EC' },
  rowCopy: { flex: 1, minWidth: 140, alignItems: 'flex-end' },
  rowTitle: { color: colors.ink, fontSize: 11, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  rowMeta: { color: colors.muted, fontSize: 9, textAlign: 'right', writingDirection: 'rtl', marginTop: 5 },
  emptyDetail: { color: colors.muted, fontSize: 10, textAlign: 'right', writingDirection: 'rtl', marginTop: 8 },
  evidenceRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#EEF0EC' },
  evidenceBadge: { backgroundColor: colors.greenLight, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5 },
  evidenceBadgeText: { color: colors.greenDark, fontSize: 8, fontWeight: '800', writingDirection: 'rtl' },
  evidenceForm: { marginTop: 20, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 16 },
  formTitle: { color: colors.ink, fontSize: 13, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl', marginBottom: 12 },
  formGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 12 },
  field: { flex: 1, minWidth: 140, marginBottom: 12 },
  fieldLabel: { color: colors.inkSoft, fontSize: 10, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl', marginBottom: 6 },
  input: { minHeight: 44, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FBFBF9', borderRadius: 8, paddingHorizontal: 11, paddingVertical: 9, color: colors.ink, fontSize: 11, textAlign: 'right', writingDirection: 'rtl' },
  error: { color: colors.red, fontSize: 10, textAlign: 'right', writingDirection: 'rtl', marginTop: 10 },
  success: { color: colors.greenDark, fontSize: 10, textAlign: 'right', writingDirection: 'rtl', marginTop: 10, fontWeight: '800' },
  submit: { minHeight: 44, borderRadius: 8, backgroundColor: colors.greenDark, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  submitDisabled: { opacity: 0.55 },
  submitText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', writingDirection: 'rtl' },
});
