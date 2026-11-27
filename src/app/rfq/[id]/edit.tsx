import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiFeedback } from '@/components/b2b/ApiFeedback';
import { AppHeader } from '@/components/b2b/AppHeader';
import { FeedbackBanner, MotionPressable, ScreenEntrance } from '@/components/b2b/motion';
import { colors } from '@/components/b2b/palette';
import { containerStyle, useResponsive } from '@/components/b2b/responsive';
import {
  errorMessage,
  schemaFields,
  useApiMutation,
  useApiQuery,
  type ApiRfq,
  type ApiSchemaVersion,
} from '@/data/api';
import { useAuth } from '@/state/AuthContext';

type RfqPayload = { rfq: ApiRfq };
type SchemaPayload = { version: ApiSchemaVersion };
type FormValues = Record<string, string>;

function toDateInput(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

export default function EditDraftRfqScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { gutter } = useResponsive();
  const { hasPermission } = useAuth();
  const rfqQuery = useApiQuery<RfqPayload>(id ? `/api/rfqs/${id}` : null);
  const rfq = rfqQuery.data?.rfq;
  const schemaQuery = useApiQuery<SchemaPayload>(rfq?.schemaVersionId ? `/api/schema-versions/${rfq.schemaVersionId}` : null);
  const fields = useMemo(() => schemaFields(schemaQuery.data?.version?.schemaJson), [schemaQuery.data?.version?.schemaJson]);
  const updateRfq = useApiMutation<{ rfq: ApiRfq }>();
  const initialized = useRef('');

  const [title, setTitle] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [currency, setCurrency] = useState('');
  const [destination, setDestination] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [formValues, setFormValues] = useState<FormValues>({});
  const [error, setError] = useState('');

  useEffect(() => {
    if (!rfq || initialized.current === rfq.id) return;
    initialized.current = rfq.id;
    setTitle(rfq.title);
    setQuantity(String(rfq.quantity));
    setUnit(rfq.unit);
    setCurrency(rfq.currency);
    setDestination(rfq.destination);
    setTargetDate(toDateInput(rfq.targetDate));
    setFormValues(Object.fromEntries(
      Object.entries(rfq.requirements ?? {}).map(([key, value]) => [key, value == null ? '' : String(value)]),
    ));
  }, [rfq]);

  const handleSubmit = async () => {
    setError('');
    if (!rfq) return;
    const parsedQuantity = Number(quantity);
    if (!title.trim()) {
      setError('يرجى إدخال عنوان الطلب.');
      return;
    }
    if (!Number.isSafeInteger(parsedQuantity) || parsedQuantity <= 0) {
      setError('يرجى إدخال كمية صحيحة أكبر من صفر.');
      return;
    }
    if (!unit.trim() || !destination.trim()) {
      setError('يرجى تحديد وحدة القياس وجهة التسليم.');
      return;
    }
    if (!/^[A-Za-z]{3}$/.test(currency.trim())) {
      setError('يرجى إدخال رمز عملة من ثلاثة أحرف، مثل SAR.');
      return;
    }
    const missingRequired = fields.filter((field) => field.required && !(formValues[field.id] ?? '').trim());
    if (missingRequired.length > 0) {
      setError(`يرجى ملء الحقول المطلوبة: ${missingRequired.map((field) => field.label).join('، ')}`);
      return;
    }
    let parsedTargetDate: string | null = null;
    if (targetDate.trim()) {
      const date = new Date(targetDate.trim());
      if (Number.isNaN(date.getTime())) {
        setError('صيغة الموعد غير صحيحة.');
        return;
      }
      parsedTargetDate = date.toISOString();
    }
    const requirements = Object.fromEntries(fields.map((field) => {
      const value = (formValues[field.id] ?? '').trim();
      return [field.id, field.type === 'number' && value ? Number(value) : value];
    }));

    try {
      await updateRfq.mutateAsync({
        path: `/api/rfqs/${rfq.id}`,
        method: 'PATCH',
        body: {
          title: title.trim(),
          quantity: parsedQuantity,
          unit: unit.trim(),
          currency: currency.trim().toUpperCase(),
          destination: destination.trim(),
          targetDate: parsedTargetDate,
          requirements,
        },
      });
      router.replace({ pathname: '/rfq/[id]' as any, params: { id: rfq.id } } as any);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };

  const loading = rfqQuery.isLoading || Boolean(rfq) && schemaQuery.isLoading;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppHeader active="request" />
      <ScrollView contentContainerStyle={[styles.page, { paddingHorizontal: gutter }]} showsVerticalScrollIndicator={false}>
        <ScreenEntrance style={styles.content}>
          <View style={styles.topRow}>
            <View style={styles.headingCopy}>
              <Text style={styles.kicker}>تعديل طلب التوريد</Text>
              <Text style={styles.title}>تحديث بيانات المسودة</Text>
              <Text style={styles.subtitle}>تُحفظ التعديلات على المسودة فقط، ثم تعود إلى التفاصيل لنشر الطلب.</Text>
            </View>
            <Link href={rfq ? ({ pathname: '/rfq/[id]' as any, params: { id: rfq.id } } as any) : '/workspace' as any} asChild>
              <MotionPressable accessibilityRole="button" style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>← إلغاء التعديل</Text>
              </MotionPressable>
            </Link>
          </View>

          <ApiFeedback
            loading={loading}
            error={rfqQuery.error ?? schemaQuery.error ?? updateRfq.error}
            empty={!loading && !rfq}
            emptyTitle="المسودة غير متاحة"
            emptyBody="تأكد من أن الطلب ما زال مسودة وأن لديك صلاحية تعديله."
            onRetry={() => { void rfqQuery.refetch(); void schemaQuery.refetch(); }}
          />

          {rfq && rfq.status !== 'DRAFT' ? (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>تم نشر هذا الطلب، لذلك لم يعد قابلاً للتعديل.</Text>
            </View>
          ) : null}

          {rfq && rfq.status === 'DRAFT' && hasPermission('rfq.manage') ? (
            <View style={styles.formCard}>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>رقم الطلب</Text>
                <Text style={styles.metaValue}>{rfq.id}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>القطاع</Text>
                <Text style={styles.metaValue}>{rfq.industry?.nameAr ?? '—'}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>إصدار المخطط</Text>
                <Text style={styles.metaValue}>{schemaQuery.data?.version?.version ?? '—'}</Text>
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>عنوان الطلب</Text>
                <TextInput accessibilityLabel="عنوان الطلب" value={title} onChangeText={setTitle} style={styles.input} textAlign="right" />
              </View>

              <View style={styles.fieldRow}>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>الكمية</Text>
                  <TextInput accessibilityLabel="الكمية" value={quantity} onChangeText={setQuantity} style={styles.input} keyboardType="numeric" textAlign="right" />
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>الوحدة</Text>
                  <TextInput accessibilityLabel="الوحدة" value={unit} onChangeText={setUnit} style={styles.input} textAlign="right" />
                </View>
              </View>

              <View style={styles.fieldRow}>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>العملة</Text>
                  <TextInput accessibilityLabel="العملة" value={currency} onChangeText={setCurrency} style={styles.input} maxLength={3} autoCapitalize="characters" textAlign="right" />
                </View>
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>الموعد المستهدف</Text>
                  <TextInput accessibilityLabel="الموعد المستهدف" value={targetDate} onChangeText={setTargetDate} style={styles.input} placeholder="YYYY-MM-DD" placeholderTextColor="#8A948D" textAlign="right" />
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>جهة التسليم</Text>
                <TextInput accessibilityLabel="جهة التسليم" value={destination} onChangeText={setDestination} style={styles.input} textAlign="right" />
              </View>

              {fields.length > 0 ? (
                <View style={styles.requirements}>
                  <Text style={styles.sectionTitle}>المواصفات</Text>
                  {fields.map((field) => (
                    <View key={field.id} style={styles.field}>
                      <Text style={styles.fieldLabel}>
                        {field.label}
                        {field.required ? ' *' : ''}
                      </Text>
                      {field.type === 'choice' ? (
                        <View style={styles.choiceList}>
                          {(field.options ?? []).map((option) => (
                            <MotionPressable
                              key={option}
                              accessibilityRole="button"
                              onPress={() => { setFormValues((current) => ({ ...current, [field.id]: option })); setError(''); }}
                              style={[styles.choiceButton, (formValues[field.id] ?? '') === option && styles.choiceButtonSelected]}
                            >
                              <Text style={[styles.choiceText, (formValues[field.id] ?? '') === option && styles.choiceTextSelected]}>
                                {option}
                              </Text>
                            </MotionPressable>
                          ))}
                        </View>
                      ) : (
                        <TextInput
                          accessibilityLabel={field.label}
                          value={formValues[field.id] ?? ''}
                          onChangeText={(value) => { setFormValues((current) => ({ ...current, [field.id]: value })); setError(''); }}
                          style={styles.input}
                          keyboardType={field.type === 'number' ? 'numeric' : 'default'}
                          multiline={field.type !== 'number'}
                          textAlign="right"
                        />
                      )}
                    </View>
                  ))}
                </View>
              ) : null}

              {error ? <FeedbackBanner text={error} tone="error" /> : null}

              <View style={styles.actions}>
                <MotionPressable
                  accessibilityRole="button"
                  disabled={updateRfq.isPending}
                  onPress={() => { void handleSubmit(); }}
                  style={[styles.primaryButton, updateRfq.isPending && styles.buttonDisabled]}
                >
                  <Text style={styles.primaryButtonText}>{updateRfq.isPending ? 'جارٍ الحفظ…' : 'حفظ التعديلات'}</Text>
                </MotionPressable>
              </View>
            </View>
          ) : null}
        </ScreenEntrance>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.cream },
  page: { paddingBottom: 32 },
  content: { ...containerStyle, paddingTop: 28 },
  topRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headingCopy: { flex: 1, minWidth: 220, alignItems: 'flex-end' },
  kicker: { color: colors.green, fontSize: 11, fontWeight: '800', writingDirection: 'rtl' },
  title: { color: colors.ink, fontSize: 26, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl', marginTop: 8 },
  subtitle: { color: colors.muted, fontSize: 11, textAlign: 'right', writingDirection: 'rtl', marginTop: 6 },
  secondaryButton: { minHeight: 42, paddingHorizontal: 14, borderRadius: 8, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: colors.greenDark, fontSize: 11, fontWeight: '800', writingDirection: 'rtl' },
  notice: { marginTop: 18, backgroundColor: '#F5F4EE', borderRadius: 9, padding: 12 },
  noticeText: { color: colors.inkSoft, fontSize: 11, textAlign: 'right', writingDirection: 'rtl' },
  formCard: { marginTop: 18, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 16 },
  metaRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EEF0EC' },
  metaLabel: { color: colors.muted, fontSize: 10, writingDirection: 'rtl' },
  metaValue: { color: colors.ink, fontSize: 10, fontWeight: '800', writingDirection: 'rtl' },
  field: { flex: 1, minWidth: 140, marginTop: 16 },
  fieldRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 12 },
  fieldLabel: { color: colors.ink, fontSize: 11, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl', marginBottom: 7 },
  input: { minHeight: 46, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FBFBF9', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, color: colors.ink, fontSize: 12, textAlign: 'right', writingDirection: 'rtl' },
  requirements: { marginTop: 20, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 4 },
  sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl', marginTop: 12 },
  choiceList: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  choiceButton: { borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9 },
  choiceButtonSelected: { borderColor: colors.greenDark, backgroundColor: colors.greenLight },
  choiceText: { color: colors.inkSoft, fontSize: 10, writingDirection: 'rtl' },
  choiceTextSelected: { color: colors.greenDark, fontWeight: '800' },
  error: { color: colors.red, fontSize: 11, textAlign: 'right', writingDirection: 'rtl', marginTop: 16 },
  actions: { marginTop: 22 },
  primaryButton: { minHeight: 48, borderRadius: 9, backgroundColor: colors.greenDark, alignItems: 'center', justifyContent: 'center' },
  buttonDisabled: { opacity: 0.55 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', writingDirection: 'rtl' },
});
