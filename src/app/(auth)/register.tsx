import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { AuthLayout, authStyles } from '@/components/b2b/AuthLayout';
import { MotionPressable } from '@/components/b2b/motion';
import { colors } from '@/components/b2b/palette';
import { useResponsive } from '@/components/b2b/responsive';
import { safeDestination, withNext } from '@/data/navigation';
import { isEmailAlreadyExistsError, useAuth } from '@/state/AuthContext';

type AccountRole = 'buyer' | 'supplier';

export default function RegisterScreen() {
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AccountRole>('buyer');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState('');
  const [duplicateEmail, setDuplicateEmail] = useState(false);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ next?: string }>();
  const { isCompact } = useResponsive();

  async function handleSubmit() {
    setMessage('');
    setDuplicateEmail(false);
    if (!fullName.trim() || !company.trim()) {
      setError('أدخل الاسم واسم المنشأة.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('أدخل بريدًا إلكترونيًا صحيحًا.');
      return;
    }
    if (password.length < 12) {
      setError('يجب ألا تقل كلمة المرور عن ١٢ حرفًا.');
      return;
    }
    if (!acceptedTerms) {
      setError('وافق على الشروط للمتابعة.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await register({ fullName: fullName.trim(), companyName: company.trim(), email: email.trim().toLowerCase(), password, accountType: role });
      setMessage('تم إنشاء الحساب وتسجيل الدخول.');
      router.replace(safeDestination(params.next) as any);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذر إنشاء الحساب.');
      setDuplicateEmail(isEmailAlreadyExistsError(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="أنشئ حسابك في سوقي"
      subtitle="جهّز مساحة عمل شركتك لإدارة التوريد والتصنيع."
      asideTitle="ابدأ بملف واضح لشركتك."
      asideText="اختر نوع حسابك الآن. يمكن إضافة التحقق وإدارة الصلاحيات عند ربط المنصة بخدمة مصادقة فعلية."
    >
      <View style={[authStyles.card, isCompact && authStyles.cardCompact]}>
        <View style={styles.twoFields}>
          <View style={[authStyles.field, styles.halfField]}>
            <Text style={authStyles.label}>الاسم الكامل</Text>
            <TextInput
              accessibilityLabel="الاسم الكامل"
              value={fullName}
              onChangeText={setFullName}
              placeholder="الاسم"
              placeholderTextColor={colors.textMuted}
              autoComplete="name"
              style={authStyles.input}
              textAlign="right"
            />
          </View>
          <View style={[authStyles.field, styles.halfField]}>
            <Text style={authStyles.label}>اسم المنشأة</Text>
            <TextInput
              accessibilityLabel="اسم المنشأة"
              value={company}
              onChangeText={setCompany}
              placeholder="اسم الشركة"
              placeholderTextColor={colors.textMuted}
              autoComplete="organization"
              style={authStyles.input}
              textAlign="right"
            />
          </View>
        </View>

        <View style={authStyles.field}>
          <Text style={authStyles.label}>البريد الإلكتروني للعمل</Text>
          <TextInput
            accessibilityLabel="البريد الإلكتروني للعمل"
            value={email}
            onChangeText={setEmail}
            placeholder="name@company.com"
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            style={authStyles.input}
            textAlign="right"
          />
        </View>

        <Text style={authStyles.roleLabel}>نوع الحساب</Text>
        <View style={authStyles.roleRow}>
          <MotionPressable accessibilityRole="radio" accessibilityState={{ selected: role === 'buyer' }} onPress={() => setRole('buyer')} style={[authStyles.roleButton, role === 'buyer' && authStyles.roleButtonActive]} pressedStyle={authStyles.roleButtonActive} hoverStyle={authStyles.roleButtonHover}>
            <Text style={[authStyles.roleButtonText, role === 'buyer' && authStyles.roleButtonTextActive]}>مشتري / علامة تجارية</Text>
          </MotionPressable>
          <MotionPressable accessibilityRole="radio" accessibilityState={{ selected: role === 'supplier' }} onPress={() => setRole('supplier')} style={[authStyles.roleButton, role === 'supplier' && authStyles.roleButtonActive]} pressedStyle={authStyles.roleButtonActive} hoverStyle={authStyles.roleButtonHover}>
            <Text style={[authStyles.roleButtonText, role === 'supplier' && authStyles.roleButtonTextActive]}>مورد / مصنع</Text>
          </MotionPressable>
        </View>

        <View style={authStyles.field}>
          <Text style={authStyles.label}>كلمة المرور</Text>
          <View style={authStyles.passwordWrap}>
            <TextInput
              accessibilityLabel="كلمة المرور"
              value={password}
              onChangeText={setPassword}
              placeholder="١٢ حرفًا على الأقل"
              placeholderTextColor={colors.textMuted}
              secureTextEntry={!passwordVisible}
              autoComplete="new-password"
              style={authStyles.inputWithAction}
              textAlign="right"
            />
            <MotionPressable accessibilityRole="button" accessibilityLabel={passwordVisible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} onPress={() => setPasswordVisible(!passwordVisible)} style={authStyles.visibilityButton}>
              <Text style={authStyles.visibilityText}>{passwordVisible ? 'إخفاء' : 'إظهار'}</Text>
            </MotionPressable>
          </View>
        </View>

        <MotionPressable accessibilityRole="checkbox" accessibilityState={{ checked: acceptedTerms }} onPress={() => setAcceptedTerms(!acceptedTerms)} style={authStyles.termsRow}>
          <View style={[authStyles.checkbox, acceptedTerms && authStyles.checkboxActive]}>
            <Text style={authStyles.checkboxText}>{acceptedTerms ? '✓' : ''}</Text>
          </View>
          <Text style={authStyles.termsText}>أوافق على شروط الاستخدام وسياسة الخصوصية التجريبية.</Text>
        </MotionPressable>

        <MotionPressable accessibilityRole="button" accessibilityState={{ disabled: submitting }} disabled={submitting} onPress={handleSubmit} style={authStyles.primaryButton} pressedStyle={authStyles.primaryButtonPressed} hoverStyle={authStyles.primaryButtonHover}>
          <Text style={authStyles.primaryButtonText}>{submitting ? 'جارٍ إنشاء الحساب…' : 'إنشاء حساب'}</Text>
        </MotionPressable>
        {error ? (
          <View style={styles.feedbackBox}>
            <Text accessibilityRole="alert" style={authStyles.feedback}>{error}</Text>
            {duplicateEmail ? (
              <Link href={withNext('/login', params.next) as any} asChild><MotionPressable accessibilityRole="link" glow={false}><Text style={[authStyles.switchLink, styles.feedbackLink]}>سجّل الدخول بدلاً من ذلك</Text></MotionPressable></Link>
            ) : null}
          </View>
        ) : null}
        {message ? <Text accessibilityLiveRegion="polite" style={authStyles.success}>{message}</Text> : null}

        <Text style={authStyles.switchText}>
          لديك حساب بالفعل؟{' '}
          <Link href={withNext('/login', params.next) as any} asChild><MotionPressable accessibilityRole="link" glow={false}><Text style={authStyles.switchLink}>تسجيل الدخول</Text></MotionPressable></Link>
        </Text>
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  twoFields: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 9 },
  halfField: { flex: 1, minWidth: 150 },
  feedbackBox: { marginTop: 10, gap: 4 },
  feedbackLink: { fontSize: 9, textAlign: 'right', writingDirection: 'rtl' },
});