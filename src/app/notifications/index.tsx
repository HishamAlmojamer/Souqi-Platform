import { Link } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiFeedback } from '@/components/b2b/ApiFeedback';
import { AppHeader } from '@/components/b2b/AppHeader';
import { FeedbackBanner, MotionPressable, ScreenEntrance, Stagger, TabIndicator } from '@/components/b2b/motion';
import { colors } from '@/components/b2b/palette';
import { containerStyle, useResponsive } from '@/components/b2b/responsive';
import {
  errorMessage,
  formatDate,
  formatNumber,
  useApiMutation,
  useApiQuery,
  type ApiNotification,
} from '@/data/api';

type NotificationsPayload = { notifications: ApiNotification[]; unreadCount: number };

const kindLabels: Record<ApiNotification['kind'], string> = {
  rfq: 'طلب توريد',
  quote: 'عرض سعر',
  invitation: 'دعوة مورد',
  order: 'أمر شراء',
  sample: 'عينة',
  system: 'النظام',
};

export default function NotificationsScreen() {
  const { gutter } = useResponsive();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [actionError, setActionError] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const notificationsQuery = useApiQuery<NotificationsPayload>('/api/notifications?pageSize=100');
  const markRead = useApiMutation<{ notification: ApiNotification }>();
  const markAll = useApiMutation<{ ok: boolean }>();
  const notifications = notificationsQuery.data?.notifications ?? [];
  const unreadCount = notificationsQuery.data?.unreadCount ?? notifications.filter((item) => !item.read).length;
  const visible = filter === 'unread' ? notifications.filter((item) => !item.read) : notifications;

  const handleMarkAll = async () => {
    setActionError('');
    try {
      await markAll.mutateAsync({ path: '/api/notifications/read-all', method: 'POST' });
    } catch (cause) {
      setActionError(errorMessage(cause));
    }
  };

  const handleMarkOne = async (notificationId: string) => {
    setActionError('');
    setPendingId(notificationId);
    try {
      await markRead.mutateAsync({
        path: `/api/notifications/${notificationId}`,
        method: 'PATCH',
      });
    } catch (cause) {
      setActionError(errorMessage(cause));
    } finally {
      setPendingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <AppHeader active="notifications" />
      <ScrollView contentContainerStyle={[styles.page, { paddingHorizontal: gutter }]} showsVerticalScrollIndicator={false}>
        <ScreenEntrance style={styles.content}>
          <View style={styles.heading}>
            <View style={styles.headingCopy}>
              <Text style={styles.kicker}>مركز الإشعارات</Text>
              <Text style={styles.title}>آخر المستجدات</Text>
              <Text style={styles.subtitle}>تابع تحديثات الطلبات والعروض والأدلة في مكان واحد.</Text>
            </View>
            <MotionPressable
              accessibilityRole="button"
              disabled={markAll.isPending || unreadCount === 0}
              onPress={() => { void handleMarkAll(); }}
              style={[styles.markAll, unreadCount === 0 && styles.markAllDisabled]}
            >
              <Text style={styles.markAllText}>{markAll.isPending ? 'جارٍ التحديث…' : 'تحديد الكل كمقروء'}</Text>
            </MotionPressable>
          </View>

          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>إجمالي الإشعارات</Text>
              <Text style={styles.statValue}>{formatNumber(notifications.length).padStart(2, '0')}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>غير مقروءة</Text>
              <Text style={[styles.statValue, styles.statValueAccent]}>{formatNumber(unreadCount).padStart(2, '0')}</Text>
            </View>
          </View>

          <View style={styles.filters}>
            <MotionPressable
              accessibilityRole="tab"
              accessibilityState={{ selected: filter === 'all' }}
              onPress={() => setFilter('all')}
              style={[styles.filter, filter === 'all' && styles.filterActive]}
            >
              <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>الكل</Text>
              <TabIndicator active={filter === 'all'} color={colors.green} />
            </MotionPressable>
            <MotionPressable
              accessibilityRole="tab"
              accessibilityState={{ selected: filter === 'unread' }}
              onPress={() => setFilter('unread')}
              style={[styles.filter, filter === 'unread' && styles.filterActive]}
            >
              <Text style={[styles.filterText, filter === 'unread' && styles.filterTextActive]}>غير مقروءة</Text>
              <TabIndicator active={filter === 'unread'} color={colors.green} />
            </MotionPressable>
          </View>

          {actionError ? <FeedbackBanner text={actionError} tone="error" /> : null}

          <ApiFeedback
            loading={notificationsQuery.isLoading}
            error={notificationsQuery.error}
            empty={!notificationsQuery.isLoading && visible.length === 0}
            emptyTitle={filter === 'unread' ? 'لا توجد إشعارات غير مقروءة' : 'لا توجد إشعارات بعد'}
            emptyBody="ستظهر هنا تحديثات الطلبات والعروض والأدلة فور تسجيلها."
            onRetry={() => { void notificationsQuery.refetch(); }}
          />

          <View style={styles.list}>
            {visible.map((notification, index) => (
              <Stagger key={notification.id} index={index} baseDelay={130} step={38} translateY={8}>
              <View
                style={[styles.notification, notification.read ? styles.notificationRead : styles.notificationUnread]}
              >
                <View style={styles.notificationHead}>
                  <View style={styles.kindBadge}>
                    <Text style={styles.kindText}>{kindLabels[notification.kind] ?? notification.kind}</Text>
                  </View>
                  <Text style={styles.date}>{formatDate(notification.createdAt)}</Text>
                </View>
                <Text style={styles.notificationTitle}>{notification.title}</Text>
                <Text style={styles.notificationBody}>{notification.body}</Text>
                <View style={styles.actions}>
                  {!notification.read ? (
                    <MotionPressable
                      accessibilityRole="button"
                      disabled={pendingId === notification.id}
                      onPress={() => { void handleMarkOne(notification.id); }}
                      style={styles.readButton}
                    >
                      <Text style={styles.readButtonText}>{pendingId === notification.id ? 'جارٍ التحديث…' : 'تحديد كمقروء'}</Text>
                    </MotionPressable>
                  ) : (
                    <Text style={styles.readLabel}>مقروء</Text>
                  )}
                  {notification.href ? (
                    <Link href={notification.href as any} asChild>
                      <MotionPressable accessibilityRole="link" style={styles.openButton}>
                        <Text style={styles.openButtonText}>فتح ←</Text>
                      </MotionPressable>
                    </Link>
                  ) : null}
                </View>
              </View>
              </Stagger>
            ))}
          </View>
        </ScreenEntrance>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.cream },
  page: { paddingBottom: 32 },
  content: { ...containerStyle, paddingTop: 28 },
  heading: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headingCopy: { flex: 1, minWidth: 220, alignItems: 'flex-end' },
  kicker: { color: colors.green, fontSize: 11, fontWeight: '800', writingDirection: 'rtl' },
  title: { color: colors.ink, fontSize: 26, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl', marginTop: 8 },
  subtitle: { color: colors.muted, fontSize: 11, textAlign: 'right', writingDirection: 'rtl', marginTop: 6 },
  markAll: { minHeight: 42, paddingHorizontal: 14, borderRadius: 8, backgroundColor: colors.greenDark, alignItems: 'center', justifyContent: 'center' },
  markAllDisabled: { opacity: 0.5 },
  markAllText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', writingDirection: 'rtl' },
  stats: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10, marginTop: 18 },
  stat: { flex: 1, minWidth: 140, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 14 },
  statLabel: { color: colors.muted, fontSize: 10, textAlign: 'right', writingDirection: 'rtl' },
  statValue: { color: colors.ink, fontSize: 24, fontWeight: '900', textAlign: 'right', marginTop: 9 },
  statValueAccent: { color: colors.greenDark },
  filters: { flexDirection: 'row-reverse', gap: 8, marginTop: 18, marginBottom: 14 },
  filter: { position: 'relative', overflow: 'hidden', minHeight: 36, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  filterActive: { backgroundColor: colors.greenDark, borderColor: colors.greenDark },
  filterText: { color: colors.inkSoft, fontSize: 10, fontWeight: '800', writingDirection: 'rtl' },
  filterTextActive: { color: '#FFFFFF' },
  error: { color: colors.red, fontSize: 10, textAlign: 'right', writingDirection: 'rtl', marginBottom: 10 },
  list: { gap: 12 },
  notification: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 15 },
  notificationUnread: { borderRightWidth: 4, borderRightColor: colors.green },
  notificationRead: { opacity: 0.78 },
  notificationHead: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  kindBadge: { backgroundColor: colors.greenLight, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 5 },
  kindText: { color: colors.greenDark, fontSize: 8, fontWeight: '800', writingDirection: 'rtl' },
  date: { color: colors.muted, fontSize: 8, writingDirection: 'rtl' },
  notificationTitle: { color: colors.ink, fontSize: 13, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl', marginTop: 12 },
  notificationBody: { color: colors.muted, fontSize: 10, lineHeight: 18, textAlign: 'right', writingDirection: 'rtl', marginTop: 7 },
  actions: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 14, borderTopWidth: 1, borderTopColor: '#EEF0EC', paddingTop: 11 },
  readButton: { minHeight: 32, paddingHorizontal: 10, borderRadius: 7, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  readButtonText: { color: colors.inkSoft, fontSize: 9, fontWeight: '800', writingDirection: 'rtl' },
  readLabel: { color: colors.muted, fontSize: 9, writingDirection: 'rtl' },
  openButton: { minHeight: 32, paddingHorizontal: 10, borderRadius: 7, backgroundColor: colors.greenLight, alignItems: 'center', justifyContent: 'center' },
  openButtonText: { color: colors.greenDark, fontSize: 9, fontWeight: '800', writingDirection: 'rtl' },
});
