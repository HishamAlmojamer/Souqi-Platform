import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiFeedback } from '@/components/b2b/ApiFeedback';
import { AppHeader } from '@/components/b2b/AppHeader';
import { StatusPill } from '@/components/b2b/StatusPill';
import { lifecycleStyles as s } from '@/components/b2b/lifecycleStyles';
import { MotionPressable, ScreenEntrance } from '@/components/b2b/motion';
import {
  errorMessage,
  ESCROW_STATUS,
  formatDate,
  formatMoney,
  SHIPMENT_STATUS,
  statusInfo,
  useApiMutation,
  useApiQuery,
  type ApiEscrowCondition,
  type ApiEscrowHold,
  type ApiPurchaseOrder,
  type ApiShipment,
} from '@/data/api';

type EscrowPayload = { hold: ApiEscrowHold | null; holds: ApiEscrowHold[] };
type ShipmentsPayload = { shipments: ApiShipment[] };
type PoPayload = { purchaseOrder: ApiPurchaseOrder };

const conditionKinds: ApiEscrowCondition['kind'][] = [
  'PRODUCTION_STARTED',
  'SAMPLE_APPROVED',
  'INSPECTION_APPROVED',
  'MILESTONE_DONE',
  'SHIPMENT_DELIVERED',
  'DOCUMENT_APPROVED',
  'MANUAL',
];

export default function EscrowScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [error, setError] = useState('');
  const [amount, setAmount] = useState('100000');
  const [carrier, setCarrier] = useState('');
  const [tracking, setTracking] = useState('');
  const [selectedKind, setSelectedKind] = useState<ApiEscrowCondition['kind']>('PRODUCTION_STARTED');

  const poQuery = useApiQuery<PoPayload>(id ? `/api/purchase-orders/${id}` : null);
  const escrowQuery = useApiQuery<EscrowPayload>(id ? `/api/purchase-orders/${id}/escrow` : null, 10_000, 8_000);
  const shipmentsQuery = useApiQuery<ShipmentsPayload>(id ? `/api/purchase-orders/${id}/shipments` : null, 10_000, 8_000);
  const hold = escrowQuery.data?.hold ?? null;
  const shipments = shipmentsQuery.data?.shipments ?? [];
  const createHold = useApiMutation<{ hold: ApiEscrowHold }>();
  const fund = useApiMutation<{ hold: ApiEscrowHold }>();
  const meetCondition = useApiMutation<{ condition: ApiEscrowCondition }>();
  const release = useApiMutation<{ hold: ApiEscrowHold }>();
  const createShipment = useApiMutation<{ shipment: ApiShipment }>();
  const addEvent = useApiMutation<{ shipment: ApiShipment }>();

  const run = async (action: () => Promise<unknown>) => {
    setError('');
    try {
      await action();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };

  const holdStatus = statusInfo(ESCROW_STATUS, hold?.status ?? 'AWAITING_PAYMENT');

  return (
    <SafeAreaView style={s.safeArea} edges={['top']}>
      <AppHeader active="orders" />
      <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
        <ScreenEntrance style={s.content}>
          <View style={s.headingRow}>
            <View style={s.headingCopy}>
              <Text style={s.kicker}>Escrow & Logistics</Text>
              <Text style={s.pageTitle}>الضمان والشحن</Text>
              <Text style={s.pageSubtitle}>{poQuery.data?.purchaseOrder?.rfq?.title ?? 'أمر التوريد'} · وضع تجريبي</Text>
            </View>
          </View>

          {error ? <View style={[s.panel, { borderColor: '#B24E43' }]}><Text style={{ color: '#B24E43', fontSize: 11, textAlign: 'right' }}>{error}</Text></View> : null}
          <ApiFeedback
            loading={escrowQuery.isLoading || shipmentsQuery.isLoading || poQuery.isLoading}
            error={escrowQuery.error ?? shipmentsQuery.error ?? poQuery.error}
            onRetry={() => { void escrowQuery.refetch(); void shipmentsQuery.refetch(); }}
          />

          <View style={[s.grid, s.gridWide]}>
            <View style={s.mainColumn}>
              <View style={s.panel}>
                <View style={s.cardHeader}>
                  <Text style={s.panelTitle}>حجوزات الضمان</Text>
                  <StatusPill label={holdStatus.label} tone={holdStatus.tone} small />
                </View>
                {!hold ? (
                  <>
                    <Text style={s.body}>أنشئ ضمانًا تجريبيًا مرتبطًا بأمر الشراء مع شروط تحرير قابلة للتتبع.</Text>
                    <Text style={s.label}>المبلغ (بالهللات)</Text>
                    <TextInput value={amount} onChangeText={setAmount} keyboardType="numeric" style={s.input} textAlign="right" />
                    <Text style={s.label}>نوع الشرط</Text>
                    <View style={s.chipRow}>
                      {conditionKinds.map((kind) => (
                        <MotionPressable key={kind} accessibilityRole="button" accessibilityState={{ selected: selectedKind === kind }} onPress={() => setSelectedKind(kind)} style={[s.chip, selectedKind === kind && s.chipActive]}>
                          <Text style={[s.chipText, selectedKind === kind && s.chipTextActive]}>{kind}</Text>
                        </MotionPressable>
                      ))}
                    </View>
                    <MotionPressable
                      accessibilityRole="button"
                      style={[s.button, { marginTop: 14 }]}
                      onPress={() => { void run(() => createHold.mutateAsync({
                        path: `/api/purchase-orders/${id}/escrow`,
                        body: {
                          amountCents: Number(amount),
                          currency: 'SAR',
                          idempotencyKey: `escrow-${Date.now()}`,
                          conditions: [
                            { kind: selectedKind, title: selectedKind, percentage: 70 },
                            { kind: 'SHIPMENT_DELIVERED', title: 'تأكيد التسليم', percentage: 30 },
                          ],
                        },
                      })); }}
                    >
                      <Text style={s.buttonText}>إنشاء الضمان</Text>
                    </MotionPressable>
                  </>
                ) : (
                  <>
                    <View style={s.detailRow}><Text style={s.detailLabel}>المبلغ</Text><Text style={s.detailValue}>{formatMoney(hold.amountCents, hold.currency)}</Text></View>
                    <View style={s.detailRow}><Text style={s.detailLabel}>الوضع</Text><Text style={s.detailValue}>{holdStatus.label}</Text></View>
                    <View style={s.detailRow}><Text style={s.detailLabel}>تاريخ التمويل</Text><Text style={s.detailValue}>{formatDate(hold.fundedAt)}</Text></View>
                    <View style={s.buttonRow}>
                      {hold.status === 'AWAITING_PAYMENT' ? (
                        <MotionPressable accessibilityRole="button" style={s.button} onPress={() => { void run(() => fund.mutateAsync({ path: `/api/escrow/${hold.id}/fund` })); }}>
                          <Text style={s.buttonText}>تأكيد تمويل الضمان</Text>
                        </MotionPressable>
                      ) : null}
                      <MotionPressable accessibilityRole="button" style={[s.button, s.buttonDark]} onPress={() => { void run(() => release.mutateAsync({
                        path: `/api/escrow/${hold.id}/release`,
                        body: { status: 'COMPLETED', idempotencyKey: `release-${Date.now()}` },
                      })); }}>
                        <Text style={[s.buttonText, s.buttonTextLight]}>تحرير المبلغ</Text>
                      </MotionPressable>
                    </View>
                  </>
                )}
              </View>

              {hold ? (
                <View style={s.panel}>
                  <Text style={s.panelTitle}>شروط التحرير</Text>
                  {(hold.conditions ?? []).map((condition) => (
                    <View key={condition.id} style={s.card}>
                      <View style={s.cardHeader}>
                        <Text style={s.cardTitle}>{condition.title}</Text>
                        <Text style={s.detailValue}>{condition.percentage}%</Text>
                      </View>
                      <Text style={s.meta}>{condition.kind} · {condition.status}</Text>
                      {condition.status === 'PENDING' ? (
                        <MotionPressable
                          accessibilityRole="button"
                          style={[s.button, { marginTop: 10 }]}
                          onPress={() => { void run(() => meetCondition.mutateAsync({
                            path: `/api/escrow/${hold.id}/conditions/${condition.id}/met`,
                            body: { idempotencyKey: `condition-${condition.id}-${Date.now()}` },
                          })); }}
                        >
                          <Text style={s.buttonText}>تأكيد تحقق الشرط</Text>
                        </MotionPressable>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={s.panel}>
                <Text style={s.panelTitle}>الشحنات</Text>
                <Text style={s.label}>الناقل</Text>
                <TextInput value={carrier} onChangeText={setCarrier} style={s.input} placeholder="اسم شركة الشحن" placeholderTextColor="#8A948D" textAlign="right" />
                <Text style={s.label}>رقم التتبع</Text>
                <TextInput value={tracking} onChangeText={setTracking} style={s.input} placeholder="Tracking number" textAlign="right" />
                <MotionPressable
                  accessibilityRole="button"
                  style={[s.button, { marginTop: 12 }]}
                  onPress={() => { void run(() => createShipment.mutateAsync({
                    path: `/api/purchase-orders/${id}/shipments`,
                    body: {
                      carrier: carrier.trim() || undefined,
                      trackingNumber: tracking.trim() || undefined,
                      documentObjectKey: tracking.trim() ? `shipment/${tracking.trim()}/bol` : undefined,
                    },
                  })); }}
                >
                  <Text style={s.buttonText}>تسجيل شحنة</Text>
                </MotionPressable>

                {shipments.map((shipment) => {
                  const info = statusInfo(SHIPMENT_STATUS, shipment.status);
                  return (
                    <View key={shipment.id} style={[s.card, { marginTop: 12 }]}>
                      <View style={s.cardHeader}>
                        <Text style={s.cardTitle}>{shipment.carrier ?? 'ناقل غير محدد'}</Text>
                        <StatusPill label={info.label} tone={info.tone} small />
                      </View>
                      <Text style={s.meta}>{shipment.trackingNumber ?? 'بدون رقم تتبع'}</Text>
                      {(shipment.events ?? []).map((event) => (
                        <Text key={event.id} style={s.meta}>{statusInfo(SHIPMENT_STATUS, event.status).label} · {formatDate(event.occurredAt)}</Text>
                      ))}
                      {shipment.status !== 'DELIVERED' ? (
                        <MotionPressable
                          accessibilityRole="button"
                          style={[s.button, { marginTop: 10 }]}
                          onPress={() => { void run(() => addEvent.mutateAsync({
                            path: `/api/shipments/${shipment.id}/events`,
                            body: {
                              status: shipment.status === 'CREATED' ? 'PICKED_UP' : shipment.status === 'PICKED_UP' ? 'IN_TRANSIT' : 'DELIVERED',
                              occurredAt: new Date().toISOString(),
                              idempotencyKey: `event-${shipment.id}-${Date.now()}`,
                            },
                          })); }}
                        >
                          <Text style={s.buttonText}>تحديث حالة الشحنة</Text>
                        </MotionPressable>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={s.sideColumn}>
              <View style={s.panel}>
                <Text style={s.panelTitle}>سجل الضمان</Text>
                {(hold?.ledger ?? []).length === 0 ? <Text style={s.empty}>لا توجد قيود مالية بعد.</Text> : null}
                {(hold?.ledger ?? []).map((entry) => (
                  <View key={entry.id} style={s.detailRow}>
                    <Text style={s.detailLabel}>{entry.type}</Text>
                    <Text style={s.detailValue}>{formatMoney(entry.amountCents, entry.currency)}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </ScreenEntrance>
      </ScrollView>
    </SafeAreaView>
  );
}
