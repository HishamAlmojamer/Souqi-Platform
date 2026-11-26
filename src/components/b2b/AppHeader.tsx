import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandMark } from './BrandMark';
import { PulseBadge, TabIndicator } from './motion';
import { colors, radii, shadows, spacing, withAlpha } from './palette';
import { containerStyle, useResponsive } from './responsive';
import { fonts } from './typography';
import { useApiQuery } from '@/data/api';
import { useAuth } from '@/state/AuthContext';
import { roleLabel } from '@/state/permissions';

type AppHeaderProps = {
  active?: 'home' | 'dashboard' | 'admin' | 'workspace' | 'request' | 'suppliers' | 'production' | 'orders' | 'supplier' | 'notifications';
};

export function AppHeader({ active }: AppHeaderProps) {
  const router = useRouter();
  const { token, role, account, hasPermission, logout } = useAuth();
  const { isDesktop, gutter } = useResponsive();
  const [menuOpen, setMenuOpen] = useState(false);
  const isAdmin = hasPermission('platform.admin');
  const overviewQuery = useApiQuery<{ overview: { pendingSupplierVerifications: number } }>(
    token && isAdmin ? '/api/admin/overview' : null,
    60_000,
  );
  const pendingApprovals = overviewQuery.data?.overview.pendingSupplierVerifications ?? 0;
  const notificationsQuery = useApiQuery<{ unreadCount: number }>(
    token ? '/api/notifications?pageSize=100' : null,
    30_000,
  );
  const unreadCount = notificationsQuery.data?.unreadCount ?? 0;
  const links = [
    { href: '/', label: 'الرئيسية', visible: true, active: active === 'home', badge: 0 },
    { href: '/dashboard', label: 'لوحتي', visible: Boolean(token), active: active === 'dashboard', badge: 0 },
    { href: '/admin', label: 'الإدارة', visible: isAdmin, active: active === 'admin', badge: pendingApprovals },
    { href: '/rfq/new', label: 'طلب عروض جديد', visible: hasPermission('rfq.create'), active: active === 'request', badge: 0 },
    { href: '/orders', label: 'الطلبات', visible: hasPermission('rfq.view') || hasPermission('purchaseOrder.view'), active: active === 'orders', badge: 0 },
    { href: '/production', label: 'التنفيذ', visible: hasPermission('milestone.manage') || hasPermission('purchaseOrder.view'), active: active === 'production', badge: 0 },
    { href: '/suppliers', label: 'الموردون', visible: Boolean(account?.accountType === 'buyer' || hasPermission('supplierProfile.manage')), active: active === 'suppliers', badge: 0 },
    { href: '/supplier', label: 'بوابة المورد', visible: Boolean(account?.accountType === 'supplier' || hasPermission('quote.create')), active: active === 'supplier', badge: 0 },
    { href: '/notifications', label: 'الإشعارات', visible: Boolean(token), active: active === 'notifications', badge: unreadCount },
  ].filter((link) => link.visible);
  const closeMenu = () => setMenuOpen(false);

  return (
    <View style={styles.header}>
      <View style={[styles.inner, { paddingHorizontal: gutter }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="العودة إلى الرئيسية"
          onPress={() => router.navigate('/')}
          style={({ pressed }) => [styles.brand, pressed && styles.brandPressed]}
        >
          <BrandMark size={isDesktop ? 44 : 38} />
          <View style={styles.brandCopy}>
            <Text style={styles.brandName}>سوقي</Text>
            <Text style={styles.brandSub}>للتصنيع والتوريد</Text>
          </View>
        </Pressable>
        {isDesktop ? (
          <View style={styles.nav}>
            {links.map((link) => (
              <HeaderLink key={link.href} href={link.href} label={link.label} active={link.active} badge={link.badge} />
            ))}
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={menuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
            onPress={() => setMenuOpen((open) => !open)}
            style={({ pressed }) => [styles.mobileMenuButton, pressed && styles.mobileButtonPressed]}
          >
            <Text style={styles.mobileButtonText}>{menuOpen ? 'إغلاق' : 'القائمة'}</Text>
          </Pressable>
        )}
        {isDesktop ? token ? (
          <View style={styles.accountCluster}>
            <Text style={styles.accountRole}>{roleLabel(role)}</Text>
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
        {!isDesktop && menuOpen ? (
          <View style={styles.mobileNav}>
            {links.map((link) => (
              <HeaderLink
                key={link.href}
                href={link.href}
                label={link.label}
                active={link.active}
                badge={link.badge}
                onPress={closeMenu}
              />
            ))}
            <View style={styles.mobileAccountRow}>
              {token ? (
                <>
                  <Pressable accessibilityRole="button" onPress={() => { closeMenu(); void logout(); }} style={styles.mobileAccountButton}>
                    <Text style={styles.mobileAccountText}>تسجيل الخروج</Text>
                  </Pressable>
                  <Text style={styles.mobileRole}>{roleLabel(role)}</Text>
                </>
              ) : (
                <Pressable accessibilityRole="button" onPress={() => { closeMenu(); router.navigate('/login' as any); }} style={styles.mobileAccountButton}>
                  <Text style={styles.mobileAccountText}>تسجيل الدخول</Text>
                </Pressable>
              )}
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function HeaderLink({ href, label, active, badge = 0, onPress }: { href: string; label: string; active: boolean; badge?: number; onPress?: () => void }) {
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityState={{ selected: active }}
      onPress={() => {
        onPress?.();
        router.navigate(href as any);
      }}
      style={({ pressed }) => [
        styles.navLink,
        active && styles.navLinkActive,
        pressed && styles.navLinkPressed,
      ]}
    >
      <Text style={[styles.navText, active && styles.navTextActive]}>{label}</Text>
      {badge > 0 ? (
        <PulseBadge style={styles.navBadge}>
          <Text style={styles.navBadgeText}>{badge > 9 ? '٩+' : badge}</Text>
        </PulseBadge>
      ) : null}
      <TabIndicator active={active} color={colors.accent} />
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
    ...containerStyle,
    minHeight: 78,
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
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
  nav: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.xs },
  navLink: {
    position: 'relative',
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
  mobileMenuButton: {
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
  mobileNav: {
    width: '100%',
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  mobileAccountRow: {
    width: '100%',
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  mobileAccountButton: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: withAlpha(colors.accentDark, 0.35),
    borderRadius: radii.sm,
  },
  mobileAccountText: {
    color: colors.accentDark,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    writingDirection: 'rtl',
  },
  mobileRole: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 11, writingDirection: 'rtl' },
});
