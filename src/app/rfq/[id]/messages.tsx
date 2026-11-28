import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiFeedback } from '@/components/b2b/ApiFeedback';
import { AppHeader } from '@/components/b2b/AppHeader';
import { lifecycleStyles as s } from '@/components/b2b/lifecycleStyles';
import { MotionPressable, ScreenEntrance } from '@/components/b2b/motion';
import { formatDate, useApiMutation, useApiQuery, type ApiMessage, type ApiRfq, type ApiMessageThread } from '@/data/api';
import { useAuth } from '@/state/AuthContext';

type ThreadsPayload = { threads: ApiMessageThread[] };
type MessagesPayload = { messages: ApiMessage[]; reads: { accountId: string; messageId: string | null; readAt: string }[] };

export default function RfqMessagesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { activeOrganization, account } = useAuth();
  const [body, setBody] = useState('');
  const rfqQuery = useApiQuery<{ rfq: ApiRfq }>(id ? `/api/rfqs/${id}` : null);
  const threadsQuery = useApiQuery<ThreadsPayload>('/api/message-threads?pageSize=100', 10_000, 8_000);
  const thread = useMemo(
    () => (threadsQuery.data?.threads ?? []).find((item) => item.rfqId === id) ?? null,
    [id, threadsQuery.data?.threads],
  );
  const messagesQuery = useApiQuery<MessagesPayload>(thread ? `/api/message-threads/${thread.id}/messages?limit=100` : null, 3_000, 4_000);
  const messages = messagesQuery.data?.messages ?? [];
  const createThread = useApiMutation<{ thread: ApiMessageThread }>();
  const sendMessage = useApiMutation<{ message: ApiMessage }>();
  const markRead = useApiMutation<{ read: boolean }>();

  const create = async () => {
    const rfq = rfqQuery.data?.rfq;
    if (!rfq || !activeOrganization) return;
    await createThread.mutateAsync({
      path: '/api/message-threads',
      body: {
        type: 'RFQ',
        subject: `تفاوض: ${rfq.title}`,
        organizationId: activeOrganization.id,
        participantOrgIds: Array.from(new Set([
          activeOrganization.id,
          rfq.buyerOrgId,
          ...(rfq.invitations ?? []).map((invitation) => invitation.supplierOrgId),
        ])),
        rfqId: rfq.id,
      },
    });
  };

  const send = async () => {
    if (!thread || !body.trim()) return;
    const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await sendMessage.mutateAsync({
      path: `/api/message-threads/${thread.id}/messages`,
      body: { body: body.trim(), idempotencyKey: key },
    });
    setBody('');
  };

  return (
    <SafeAreaView style={s.safeArea} edges={['top']}>
      <AppHeader active="orders" />
      <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
        <ScreenEntrance style={s.content}>
          <View style={s.headingRow}>
            <View style={s.headingCopy}>
              <Text style={s.kicker}>TradeMessenger</Text>
              <Text style={s.pageTitle}>محادثة التفاوض</Text>
              <Text style={s.pageSubtitle}>{rfqQuery.data?.rfq?.title ?? 'طلب العرض'}</Text>
            </View>
          </View>

          <ApiFeedback loading={rfqQuery.isLoading || threadsQuery.isLoading} error={rfqQuery.error ?? threadsQuery.error} onRetry={() => { void threadsQuery.refetch(); }} />

          {!thread ? (
            <View style={s.panel}>
              <Text style={s.panelTitle}>ابدأ محادثة مع المصانع المدعوة</Text>
              <Text style={s.body}>تُنشأ المحادثة مرتبطة بطلب العرض، وتشمل المشتري والموردين المدعوين.</Text>
              <MotionPressable accessibilityRole="button" style={[s.button, { marginTop: 16 }]} onPress={() => { void create(); }} disabled={createThread.isPending}>
                <Text style={s.buttonText}>{createThread.isPending ? 'جارٍ الإنشاء...' : 'إنشاء المحادثة'}</Text>
              </MotionPressable>
            </View>
          ) : (
            <View style={s.panel}>
              <View style={s.cardHeader}>
                <Text style={s.panelTitle}>{thread.subject}</Text>
                <MotionPressable accessibilityRole="button" style={s.chip} onPress={() => { void markRead.mutateAsync({ path: `/api/message-threads/${thread.id}/read` }); }}>
                  <Text style={s.chipText}>تحديد كمقروء</Text>
                </MotionPressable>
              </View>
              <ApiFeedback loading={messagesQuery.isLoading} error={messagesQuery.error} onRetry={() => { void messagesQuery.refetch(); }} />
              <View style={{ gap: 10, marginTop: 8 }}>
                {messages.length === 0 ? <Text style={s.empty}>لا توجد رسائل بعد.</Text> : null}
                {messages.map((message) => (
                  <View key={message.id} style={[s.messageBubble, message.senderAccountId === account?.id && s.messageMine]}>
                    <Text style={s.messageText}>{message.body}</Text>
                    {message.offerJson ? (
                      <Text style={[s.messageText, { color: '#8A6529', marginTop: 6 }]}>
                        عرض: {message.offerJson.title} · {message.offerJson.quantity} × {message.offerJson.unitPriceCents} · {message.offerJson.leadTimeDays} يوم
                      </Text>
                    ) : null}
                    <Text style={s.messageMeta}>{formatDate(message.createdAt)}</Text>
                  </View>
                ))}
              </View>
              <TextInput
                accessibilityLabel="نص الرسالة"
                value={body}
                onChangeText={setBody}
                placeholder="اكتب رسالة أو عرضًا تفاوضيًا..."
                placeholderTextColor="#8A948D"
                style={[s.input, s.inputMultiline]}
                multiline
                textAlign="right"
              />
              <MotionPressable accessibilityRole="button" style={[s.button, { marginTop: 10 }]} onPress={() => { void send(); }} disabled={sendMessage.isPending || !body.trim()}>
                <Text style={s.buttonText}>{sendMessage.isPending ? 'جارٍ الإرسال...' : 'إرسال'}</Text>
              </MotionPressable>
            </View>
          )}
        </ScreenEntrance>
      </ScrollView>
    </SafeAreaView>
  );
}
