import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { AuthLayout, authStyles } from '@/components/b2b/AuthLayout';
import { colors } from '@/components/b2b/palette';
import { useResponsive } from '@/components/b2b/responsive';
import { safeDestination, withNext } from '@/data/navigation';
import { useAuth } from '@/state/AuthContext';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ next?: string }>();
  const { isCompact } = useResponsive();

  async function handleSubmit() {
    setMessage('');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('أدخل بريدًا إلكترونيًا صحيحًا.');
      return;
    }
    if (!password) {
      setError('أدخل كلمة المرور للمتابعة.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      setMessage('تم تسجيل الدخول بنجاح.');
      router.replace(safeDestination(params.next) as any);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'تعذر تسجيل الدخول.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="مرحبًا بعودتك"
      subtitle="سجّل الدخول لمتابعة طلبات التوريد والعروض والعينات."
      asideTitle="قرارات التوريد تبدأ من صورة واضحة."
      asideText="مساحة واحدة لمراجعة احتياجك، مقارنة عروض الموردين، ومتابعة مراحل التصنيع."
    >
      <View style={[authStyles.card, isCompact && authStyles.cardCompact]}>
        <View style={authStyles.field}>
          <Text style={authStyles.label}>البريد الإلكتروني</Text>
          <TextInput
            accessibilityLabel="البريد الإلكتروني"
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

        <View style={authStyles.field}>
          <Text style={authStyles.label}>كلمة المرور</Text>
          <View style={authStyles.passwordWrap}>
            <TextInput
              accessibilityLabel="كلمة المرور"
              value={password}
              onChangeText={setPassword}
              placeholder="أدخل كلمة المرور"
              placeholderTextColor={colors.textMuted}
              secureTextEntry={!passwordVisible}
              autoComplete="current-password"
              style={authStyles.inputWithAction}
              textAlign="right"
            />
            <Pressable accessibilityRole="button" accessibilityLabel={passwordVisible ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} onPress={() => setPasswordVisible(!passwordVisible)} style={authStyles.visibilityButton}>
              <Text style={authStyles.visibilityText}>{passwordVisible ? 'إخفاء' : 'إظهار'}</Text>
            </Pressable>
          </View>
        </View>

        <Pressable accessibilityRole="button" accessibilityState={{ disabled: submitting }} disabled={submitting} onPress={handleSubmit} style={authStyles.primaryButton}>
          <Text style={authStyles.primaryButtonText}>{submitting ? 'جارٍ التحقق…' : 'تسجيل الدخول'}</Text>
        </Pressable>
        {error ? <Text accessibilityRole="alert" style={authStyles.feedback}>{error}</Text> : null}
        {message ? <Text accessibilityLiveRegion="polite" style={authStyles.success}>{message}</Text> : null}

        <View style={authStyles.separator}>
          <View style={authStyles.separatorLine} />
          <Text style={authStyles.separatorText}>مستخدم جديد؟</Text>
          <View style={authStyles.separatorLine} />
        </View>
        <Text style={authStyles.switchText}>
          أنشئ مساحة شركتك عبر{' '}
          <Link href={withNext('/register', params.next) as any} style={authStyles.switchLink}>إنشاء حساب جديد</Link>
        </Text>
      </View>
    </AuthLayout>
  );
}
