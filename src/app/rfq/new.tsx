import { Link, router } from 'expo-router';
import { useMemo, useState } from 'react';
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
  type ApiIndustry,
  type ApiRfq,
  type ApiSchemaVersion,
} from '@/data/api';
import { useAuth } from '@/state/AuthContext';

type FormValues = Record<string, string>;
type AttachmentDraft = { label: string; classification: 'DESIGN' | 'CAD' | 'PDF_SPEC' | 'IMAGE' | 'BRAND_GUIDE' | 'TECHNICAL_SHEET' | 'OTHER' };
type IndustriesPayload = { industries: ApiIndustry[] };
type VersionsPayload = { versions: ApiSchemaVersion[] };
type CreatePayload = { rfq: ApiRfq };

export default function NewRFQScreen() {
  const { isDesktop, gutter } = useResponsive();
  const wide = isDesktop;
  const { activeOrganization, hasPermission } = useAuth();
  const industriesQuery = useApiQuery<IndustriesPayload>('/api/industries?pageSize=100');
  const industries = industriesQuery.data?.industries ?? [];
  const [industryId, setIndustryId] = useState('');
  const [title, setTitle] = useState('');
  const [quantity, setQuantity] = useState('2400');
  const [unit, setUnit] = useState('قطعة');
  const [currency, setCurrency] = useState('SAR');
  const [destination, setDestination] = useState('الرياض، السعودية');
  const [targetDate, setTargetDate] = useState('');
  const [category, setCategory] = useState('');
  const [targetUnitPrice, setTargetUnitPrice] = useState('');
  const [incoterm, setIncoterm] = useState<'EXW' | 'FOB' | 'CIF' | 'DDP'>('FOB');
  const [brandingRequirements, setBrandingRequirements] = useState('');
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [attachmentLabel, setAttachmentLabel] = useState('');
  const [attachmentClassification, setAttachmentClassification] = useState<AttachmentDraft['classification']>('PDF_SPEC');
  const [error, setError] = useState('');
  const [formValues, setFormValues] = useState<FormValues>({});
  const createRfq = useApiMutation<CreatePayload>();
  const publishRfq = useApiMutation<{ rfq: ApiRfq }>();
  const addAttachment = useApiMutation<{ attachment: { id: string } }>();

  const selectedIndustryId = industryId || industries[0]?.id || '';
  const activeIndustry = industries.find((item) => item.id === selectedIndustryId) ?? industries[0];
  const schemaQuery = useApiQuery<VersionsPayload>(
    selectedIndustryId ? `/api/industries/${selectedIndustryId}/schemas?pageSize=100` : null,
  );
  const activeVersion = useMemo(() => {
    const versions = schemaQuery.data?.versions ?? [];
    return versions.find((version) => version.status === 'PUBLISHED') ?? versions[0];
  }, [schemaQuery.data?.versions]);
  const fields = useMemo(() => schemaFields(activeVersion?.schemaJson), [activeVersion?.schemaJson]);

  const updateIndustry = (nextIndustryId: string) => {
    setIndustryId(nextIndustryId);
    setFormValues({});
    setError('');
  };

  const updateField = (fieldId: string, value: string) => {
    setFormValues((current) => ({ ...current, [fieldId]: value }));
    setError('');
  };

  const handleSubmit = async (publish: boolean) => {
    setError('');
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
    const parsedTarget = targetUnitPrice.trim() ? Number(targetUnitPrice) : null;
    if (parsedTarget !== null && (!Number.isSafeInteger(parsedTarget) || parsedTarget <= 0)) {
      setError('يرجى إدخال سعر مستهدف صحيح بالهللات.');
      return;
    }
    if (activeOrganization?.type !== 'BUYER') {
      setError('يلزم حساب تابع لمؤسسة مشتري لإنشاء طلب توريد.');
      return;
    }
    if (!activeIndustry) {
      setError('لم يتم تحميل القطاعات بعد، يرجى المحاولة مجددًا.');
      return;
    }
    if (!activeVersion) {
      setError('لا يوجد مخطط قطاع منشور لهذا القطاع بعد.');
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
      const created = await createRfq.mutateAsync({
        path: '/api/rfqs',
        body: {
          buyerOrgId: activeOrganization.id,
          industryId: activeIndustry.id,
          schemaVersionId: activeVersion.id,
          title: title.trim(),
          category: category.trim() || undefined,
          quantity: parsedQuantity,
          unit: unit.trim(),
          currency: currency.trim().toUpperCase(),
          targetUnitPriceCents: parsedTarget,
          incoterm,
          brandingRequirements: brandingRequirements.trim() || undefined,
          destination: destination.trim(),
          targetDate: parsedTargetDate,
          requirements,
        },
      });
      for (const [index, attachment] of attachments.entries()) {
        await addAttachment.mutateAsync({
          path: `/api/rfqs/${created.rfq.id}/attachments`,
          body: {
            label: attachment.label,
            objectKey: `${activeOrganization.id}/rfq/${created.rfq.id}/attachment-${index + 1}`,
            checksum: `sha256-demo-${Date.now()}-${index}`,
            mimeType: attachment.classification === 'CAD' ? 'application/vnd.autocad.dwg' : 'application/octet-stream',
            sizeBytes: 1024,
            classification: attachment.classification,
            confidentiality: 'INVITED_SUPPLIERS',
          },
        });
      }
      if (publish && hasPermission('rfq.publish')) {
        await publishRfq.mutateAsync({
          path: `/api/rfqs/${created.rfq.id}/status`,
          body: { status: 'PUBLISHED' },
        });
      }
      router.replace({ pathname: '/rfq/[id]' as any, params: { id: created.rfq.id } } as any);
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };

  const loading = industriesQuery.isLoading || (Boolean(selectedIndustryId) && schemaQuery.isLoading);
  const mutationError = createRfq.error ?? publishRfq.error;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppHeader active="request" />
      <ScrollView contentContainerStyle={[styles.page, { paddingHorizontal: gutter }]} showsVerticalScrollIndicator={false}>
        <ScreenEntrance style={[styles.content, wide && styles.contentWide]}>
          <View style={styles.topRow}>
            <View>
              <Text style={styles.kicker}>إنشاء طلب توريد</Text>
              <Text style={styles.pageTitle}>مصمّم طلبات التسعير حسب القطاع</Text>
            </View>
            <Link href={'/workspace' as any} asChild>
              <MotionPressable accessibilityRole="button" style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>← رجوع إلى المساحة</Text>
              </MotionPressable>
            </Link>
          </View>

          <Text style={styles.subTitle}>تُحفظ المواصفات وفق إصدار المخطط المنشور للقطاع وتُرسل إلى الخادم مباشرة.</Text>

          <ApiFeedback
            loading={loading}
            error={industriesQuery.error ?? schemaQuery.error ?? mutationError}
            empty={!loading && industries.length === 0}
            emptyTitle="لا توجد قطاعات متاحة"
            emptyBody="أضف قطاعًا وإصدار مخطط منشورًا من لوحة الإدارة، أو شغّل npm run seed:demo."
            onRetry={() => { void industriesQuery.refetch(); void schemaQuery.refetch(); }}
          />

          {!loading && industries.length > 0 ? (
            <View style={[styles.formCard, wide && styles.formCardWide]}>
              <View style={styles.sectorPickerSection}>
                <Text style={styles.sectionLabel}>القطاع</Text>
                <View style={styles.sectorGrid}>
                  {industries.map((industry) => (
                    <MotionPressable
                      key={industry.id}
                      accessibilityRole="button"
                      onPress={() => updateIndustry(industry.id)}
                      style={[styles.sectorChip, industry.id === selectedIndustryId && styles.sectorChipActive]}
                    >
                      <Text style={[styles.sectorChipText, industry.id === selectedIndustryId && styles.sectorChipTextActive]}>
                        {industry.nameAr}
                      </Text>
                    </MotionPressable>
                  ))}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>عنوان الطلب</Text>
                <TextInput
                  accessibilityLabel="عنوان الطلب"
                  value={title}
                  onChangeText={setTitle}
                  style={styles.input}
                  placeholder="مثال: قمصان قطنية لعلامة نواة"
                  placeholderTextColor="#8A948D"
                  textAlign="right"
                />
              </View>

              <View style={styles.basicFields}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>الكمية المطلوبة</Text>
                  <TextInput
                    accessibilityLabel="الكمية المطلوبة"
                    value={quantity}
                    onChangeText={setQuantity}
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="مثل: 2400"
                    placeholderTextColor="#8A948D"
                    textAlign="right"
                  />
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>الوحدة</Text>
                  <TextInput
                    accessibilityLabel="الوحدة"
                    value={unit}
                    onChangeText={setUnit}
                    style={styles.input}
                    placeholder="قطعة / عبوة / متر"
                    placeholderTextColor="#8A948D"
                    textAlign="right"
                  />
                </View>
              </View>

              <View style={styles.basicFields}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>العملة</Text>
                  <TextInput
                    accessibilityLabel="العملة"
                    value={currency}
                    onChangeText={setCurrency}
                    style={styles.input}
                    maxLength={3}
                    autoCapitalize="characters"
                    placeholder="SAR"
                    placeholderTextColor="#8A948D"
                    textAlign="right"
                  />
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>الموعد المستهدف (اختياري)</Text>
                  <TextInput
                    accessibilityLabel="الموعد المستهدف"
                    value={targetDate}
                    onChangeText={setTargetDate}
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#8A948D"
                    textAlign="right"
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>جهة التسليم</Text>
                <TextInput
                  accessibilityLabel="جهة التسليم"
                  value={destination}
                  onChangeText={setDestination}
                  style={styles.input}
                  placeholder="المدينة والدولة"
                  placeholderTextColor="#8A948D"
                  textAlign="right"
                />
              </View>

              <View style={styles.basicFields}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>الفئة (اختياري)</Text>
                  <TextInput
                    accessibilityLabel="الفئة"
                    value={category}
                    onChangeText={setCategory}
                    style={styles.input}
                    placeholder="مثال: ملابس جاهزة"
                    placeholderTextColor="#8A948D"
                    textAlign="right"
                  />
                </View>
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>السعر المستهدف بالهللات (اختياري)</Text>
                  <TextInput
                    accessibilityLabel="السعر المستهدف"
                    value={targetUnitPrice}
                    onChangeText={setTargetUnitPrice}
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="مثال: 4500"
                    placeholderTextColor="#8A948D"
                    textAlign="right"
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>شرط التجارة (Incoterms)</Text>
                <View style={styles.choiceList}>
                  {(['EXW', 'FOB', 'CIF', 'DDP'] as const).map((term) => (
                    <MotionPressable
                      key={term}
                      accessibilityRole="button"
                      accessibilityState={{ selected: incoterm === term }}
                      onPress={() => setIncoterm(term)}
                      style={[styles.choiceButton, incoterm === term && styles.choiceButtonSelected]}
                    >
                      <Text style={[styles.choiceText, incoterm === term && styles.choiceTextSelected]}>{term}</Text>
                    </MotionPressable>
                  ))}
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>متطلبات العلامة والتغليف (اختياري)</Text>
                <TextInput
                  accessibilityLabel="متطلبات العلامة والتغليف"
                  value={brandingRequirements}
                  onChangeText={setBrandingRequirements}
                  style={[styles.input, styles.textArea]}
                  multiline
                  placeholder="الشعار، الألوان، التعبئة، تعليمات التغليف..."
                  placeholderTextColor="#8A948D"
                  textAlign="right"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>المرفقات الهندسية (بيانات ملف)</Text>
                <Text style={styles.schemaNote}>أضف اسم المرفق ونوعه؛ سيُحفظ مفتاح الملف ضمن مساحة مؤسستك.</Text>
                <TextInput
                  accessibilityLabel="اسم المرفق"
                  value={attachmentLabel}
                  onChangeText={setAttachmentLabel}
                  style={styles.input}
                  placeholder="مثال: مواصفات القماش.pdf"
                  placeholderTextColor="#8A948D"
                  textAlign="right"
                />
                <View style={styles.choiceList}>
                  {(['DESIGN', 'CAD', 'PDF_SPEC', 'IMAGE', 'BRAND_GUIDE', 'TECHNICAL_SHEET', 'OTHER'] as const).map((kind) => (
                    <MotionPressable
                      key={kind}
                      accessibilityRole="button"
                      accessibilityState={{ selected: attachmentClassification === kind }}
                      onPress={() => setAttachmentClassification(kind)}
                      style={[styles.choiceButton, attachmentClassification === kind && styles.choiceButtonSelected]}
                    >
                      <Text style={[styles.choiceText, attachmentClassification === kind && styles.choiceTextSelected]}>{kind}</Text>
                    </MotionPressable>
                  ))}
                </View>
                <MotionPressable
                  accessibilityRole="button"
                  style={styles.secondaryButton}
                  onPress={() => {
                    if (!attachmentLabel.trim()) return;
                    setAttachments((current) => [...current, { label: attachmentLabel.trim(), classification: attachmentClassification }]);
                    setAttachmentLabel('');
                  }}
                >
                  <Text style={styles.secondaryButtonText}>إضافة المرفق</Text>
                </MotionPressable>
                {attachments.map((attachment, index) => (
                  <Text key={`${attachment.label}-${index}`} style={styles.schemaNote}>• {attachment.label} ({attachment.classification})</Text>
                ))}
              </View>

              <View style={styles.divider} />

              {activeVersion ? (
                <Text style={styles.schemaNote}>مخطط القطاع: الإصدار {activeVersion.version}</Text>
              ) : null}
              {fields.map((field) => (
                <View key={field.id} style={styles.fieldGroup}>
                  <Text style={styles.label}>
                    {field.label}
                    {field.required ? <Text style={styles.required}> *</Text> : null}
                  </Text>

                  {field.type === 'choice' ? (
                    <View style={styles.choiceList}>
                      {(field.options ?? []).map((option) => (
                        <MotionPressable
                          key={option}
                          accessibilityRole="button"
                          onPress={() => updateField(field.id, option)}
                          style={[
                            styles.choiceButton,
                            (formValues[field.id] ?? '') === option && styles.choiceButtonSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.choiceText,
                              (formValues[field.id] ?? '') === option && styles.choiceTextSelected,
                            ]}
                          >
                            {option}
                          </Text>
                        </MotionPressable>
                      ))}
                    </View>
                  ) : (
                    <TextInput
                      accessibilityLabel={field.label}
                      value={formValues[field.id] ?? ''}
                      onChangeText={(value) => updateField(field.id, value)}
                      style={styles.input}
                      placeholder={field.placeholder}
                      placeholderTextColor="#8A948D"
                      textAlign="right"
                      keyboardType={field.type === 'number' ? 'numeric' : 'default'}
                      multiline={field.type !== 'number'}
                    />
                  )}
                </View>
              ))}

              {error ? <FeedbackBanner text={error} tone="error" /> : null}

              <View style={styles.actions}>
                <MotionPressable
                  accessibilityRole="button"
                  disabled={createRfq.isPending || publishRfq.isPending}
                  onPress={() => { void handleSubmit(true); }}
                  style={[styles.primaryButton, (createRfq.isPending || publishRfq.isPending) && styles.buttonDisabled]}
                >
                  <Text style={styles.primaryButtonText}>{(createRfq.isPending || publishRfq.isPending) ? 'جارٍ الحفظ والنشر…' : 'حفظ ونشر الطلب'}</Text>
                </MotionPressable>
                <MotionPressable
                  accessibilityRole="button"
                  disabled={createRfq.isPending || publishRfq.isPending}
                  onPress={() => { void handleSubmit(false); }}
                  style={styles.ghostButton}
                >
                  <Text style={styles.ghostButtonText}>{createRfq.isPending ? 'جارٍ الحفظ…' : 'حفظ كمسودة'}</Text>
                </MotionPressable>
                <Link href={'/workspace' as any} asChild>
                  <MotionPressable accessibilityRole="button" style={styles.ghostButton}>
                    <Text style={styles.ghostButtonText}>إلغاء</Text>
                  </MotionPressable>
                </Link>
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
  contentWide: { paddingTop: 32 },
  topRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16 },
  kicker: { fontSize: 11, fontWeight: '800', color: colors.green, textAlign: 'right', writingDirection: 'rtl' },
  pageTitle: { fontSize: 28, fontWeight: '900', color: colors.ink, marginTop: 8, textAlign: 'right', writingDirection: 'rtl' },
  subTitle: { fontSize: 12, color: colors.muted, marginTop: 10, marginBottom: 16, textAlign: 'right', writingDirection: 'rtl' },
  secondaryButton: { minHeight: 42, borderRadius: 8, paddingHorizontal: 14, backgroundColor: colors.greenLight, justifyContent: 'center' },
  secondaryButtonText: { color: colors.greenDark, fontSize: 11, fontWeight: '800', writingDirection: 'rtl' },
  formCard: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 18, marginTop: 16 },
  formCardWide: { padding: 22 },
  sectorPickerSection: { marginBottom: 14 },
  sectionLabel: { fontSize: 12, fontWeight: '800', color: colors.ink, marginBottom: 10, textAlign: 'right', writingDirection: 'rtl' },
  sectorGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  sectorChip: { backgroundColor: '#F2F4F0', borderWidth: 1, borderColor: colors.line, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10 },
  sectorChipActive: { backgroundColor: colors.greenDark, borderColor: colors.greenDark },
  sectorChipText: { fontSize: 11, fontWeight: '700', color: colors.inkSoft, writingDirection: 'rtl' },
  sectorChipTextActive: { color: '#FFF', writingDirection: 'rtl' },
  basicFields: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 12 },
  fieldGroup: { flex: 1, minWidth: 150, marginTop: 14 },
  label: { fontSize: 12, fontWeight: '800', color: colors.ink, marginBottom: 8, textAlign: 'right', writingDirection: 'rtl' },
  required: { color: colors.red },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#FBFBF9',
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.ink,
    fontSize: 12,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  choiceList: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  choiceButton: { borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9 },
  choiceButtonSelected: { borderColor: colors.greenDark, backgroundColor: colors.greenLight },
  choiceText: { fontSize: 10, color: colors.inkSoft, writingDirection: 'rtl' },
  choiceTextSelected: { color: colors.greenDark, fontWeight: '800' },
  divider: { height: 1, backgroundColor: colors.line, marginTop: 18, marginBottom: 2 },
  schemaNote: { color: colors.muted, fontSize: 10, marginTop: 14, textAlign: 'right', writingDirection: 'rtl' },
  error: { color: colors.red, fontSize: 11, marginTop: 14, textAlign: 'right', writingDirection: 'rtl' },
  actions: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 22, gap: 12 },
  primaryButton: { flexGrow: 1, minHeight: 48, borderRadius: 9, backgroundColor: colors.greenDark, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', writingDirection: 'rtl' },
  buttonDisabled: { opacity: 0.6 },
  ghostButton: { minWidth: 110, minHeight: 48, borderRadius: 9, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  ghostButtonText: { color: colors.inkSoft, fontSize: 11, fontWeight: '700', writingDirection: 'rtl' },
});
