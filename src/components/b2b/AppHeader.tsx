import { useRouter } from 'expo-router';
import { useWindowDimensions, Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandMark } from './BrandMark';
import { colors, radii, shadows, spacing, withAlpha } from './palette';
import { fonts } from './typography';
import { useApiQuery } from '@/data/api';
import { useAuth } from '@/state/AuthContext';
import { roleLabel } from '@/state/permissions';

type AppHeaderProps = {
  active?: 'home' | 'dashboard' | 'admin' | 'workspace' | 'request' | 'suppliers' | 'production' | 'orders';
};

export function AppHeader({ active }: AppHeaderProps) {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { token, role, account, hasPermission, logout } = useAuth();
  const wide = width >= 980;
  const isAdmin = hasPermission('platform.admin');
  const overviewQuery = useApiQuery<{ overview: { pendingSupplierVerifications: number } }>(
    token && isAdmin ? '/api/admin/overview' : null,
    60_000,
  );
  const pendingApprovals = overviewQuery.data?.overview.pendingSupplierVerifications ?? 0;

  return (
    <View style={styles.header}>
      <View style={styles.inner}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="العودة إلى الرئيسية"
          onPress={() => router.navigate('/')}
          style={({ pressed }) => [styles.brand, pressed && styles.brandPressed]}
        >
          <BrandMark size={44} />
          <View style={styles.brandCopy}>
            <Text style={styles.brandName}>سوقي</Text>
            <Text style={styles.brandSub}>للتصنيع والتوريد</Text>
          </View>
        </Pressable>
        {wide ? (
          <View style={styles.nav}>
            <HeaderLink href={'/' as any} label="الرئيسية" active={active === 'home'} />
            {token ? <HeaderLink href={'/dashboard' as any} label="لوحتي" active={active === 'dashboard'} /> : null}
            {hasPermission('platform.admin') ? (
              <HeaderLink href={'/admin' as any} label="الإدارة" active={active === 'admin'} badge={pendingApprovals} />
            ) : null}
            {hasPermission('rfq.create') ? (
              <HeaderLink href={'/rfq/new' as any} label="طلب عروض جديد" active={active === 'request'} />
            ) : null}
            {hasPermission('rfq.view') || hasPermission('purchaseOrder.view') ? (
              <HeaderLink href={'/orders' as any} label="الطلبات" active={active === 'orders'} />
            ) : null}
            {hasPermission('milestone.manage') || hasPermission('purchaseOrder.view') ? (
              <HeaderLink href={'/production' as any} label="التنفيذ" active={active === 'production'} />
            ) : null}
            {account?.accountType === 'buyer' || hasPermission('supplierProfile.manage') ? (
              <HeaderLink href={'/suppliers' as any} label="الموردون" active={active === 'suppliers'} />
            ) : null}
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={token ? 'لوحة التحكم' : 'تسجيل الدخول'}
            onPress={() => router.navigate(token ? ('/dashboard' as any) : ('/login' as any))}
            style={({ pressed }) => [styles.mobileButton, pressed && styles.mobileButtonPressed]}
          >
            <Text style={styles.mobileButtonText}>{token ? 'لوحتي ←' : 'تسجيل الدخول ←'}</Text>
          </Pressable>
        )}
        {wide ? token ? (
          <View style={styles.accountCluster}>
            <Text style={styles.accountRole}>{roleLabel(role)}</Text>
            {hasPermission('platform.admin') ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.navigate('/admin' as any)}
                style={({ pressed }) => [styles.adminAccountButton, pressed && styles.accountButtonPressed]}
              >
                <Text style={styles.adminAccountButtonText}>الإدارة</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              onPress={() => router.navigate('/dashboard' as any)}
              style={({ pressed }) => [styles.accountButton, pressed && styles.accountButtonPressed]}
            >
              <Text style={styles.accountButtonText}>لوحتي</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => void logout()}
              style={({ pressed }) => [styles.logoutButton, pressed && styles.accountButtonPressed]}
            >
              <Text style={styles.logoutText}>خروج</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.navigate('/login' as any)}
            style={({ pressed }) => [styles.accountButton, pressed && styles.accountButtonPressed]}
          >
            <Text style={styles.accountButtonText}>تسجيل الدخول</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function HeaderLink({ href, label, active, badge = 0 }: { href: string; label: string; active: boolean; badge?: number }) {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityState={{ selected: active }}
      onPress={() => router.navigate(href as any)}
      style={({ pressed }) => [
        styles.navLink,
        active && styles.navLinkActive,
        pressed && styles.navLinkPressed,
      ]}
    >
      <Text style={[styles.navText, active && styles.navTextActive]}>{label}</Text>
      {badge > 0 ? <View style={styles.navBadge}><Text style={styles.navBadgeText}>{badge > 9 ? '٩+' : badge}</Text></View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: withAlpha(colors.surface, 0.94),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...shadows.header,
  },
  inner: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    minHeight: 78,
    paddingHorizontal: spacing.lg + 4,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  brand: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: spacing.md - 2,
    minHeight: 48,
    paddingHorizontal: 2,
    borderRadius: radii.md,
  },
  brandPressed: { opacity: 0.75 },
  brandCopy: { alignItems: 'flex-end' },
  brandName: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 19,
    lineHeight: 25,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  brandSub: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 1,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  nav: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.xs },
  navLink: {
    minHeight: 42,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  navLinkActive: {
    backgroundColor: colors.accentSoft,
    borderBottomColor: colors.accent,
  },
  navLinkPressed: { backgroundColor: colors.stone, opacity: 0.9 },
  navText: {
    color: colors.textSoft,
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 18,
    writingDirection: 'rtl',
  },
  navTextActive: { color: colors.accentDark, fontFamily: fonts.semiBold },
  navBadge: {
    position: 'absolute',
    top: 2,
    left: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBadgeText: { color: colors.surface, fontFamily: fonts.bold, fontSize: 9, writingDirection: 'rtl' },
  accountButton: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: withAlpha(colors.accentDark, 0.35),
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
  accountButtonPressed: { backgroundColor: colors.accentSoft, borderColor: colors.accentDark },
  accountButtonText: {
    color: colors.accentDark,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    lineHeight: 18,
    writingDirection: 'rtl',
  },
  accountCluster: { flexDirection: 'row-reverse', alignItems: 'center', gap: spacing.sm - 1 },
  accountRole: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 10, writingDirection: 'rtl' },
  adminAccountButton: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: withAlpha(colors.accent, 0.5),
    borderRadius: radii.sm,
    backgroundColor: colors.primaryDark,
  },
  adminAccountButtonText: {
    color: colors.accent,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    lineHeight: 18,
    writingDirection: 'rtl',
  },
  logoutButton: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: colors.stone,
  },
  logoutText: {
    color: colors.textSoft,
    fontFamily: fonts.semiBold,
    fontSize: 11,
    writingDirection: 'rtl',
  },
  mobileButton: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    minHeight: 42,
    borderRadius: radii.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mobileButtonPressed: { backgroundColor: colors.highlight, opacity: 0.94 },
  mobileButtonText: {
    color: colors.obsidian,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    lineHeight: 18,
    writingDirection: 'rtl',
  },
});
