import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import {
  activityFromData,
  useApiQuery,
  type ApiActivity,
  type ApiPurchaseOrder,
  type ApiRfq,
} from '@/data/api';
import { useAuth } from '@/state/AuthContext';

type RfqsPayload = { rfqs: ApiRfq[] };
type OrdersPayload = { purchaseOrders: ApiPurchaseOrder[] };
type OrderPayload = { purchaseOrder: ApiPurchaseOrder };

export function usePlatformOverview() {
  const { apiFetch, token } = useAuth();
  const queryClient = useQueryClient();
  const rfqsQuery = useApiQuery<RfqsPayload>('/api/rfqs?pageSize=100');
  const ordersQuery = useApiQuery<OrdersPayload>('/api/purchase-orders?pageSize=100');
  const rfqs = useMemo(() => rfqsQuery.data?.rfqs ?? [], [rfqsQuery.data?.rfqs]);
  const purchaseOrders = useMemo(() => ordersQuery.data?.purchaseOrders ?? [], [ordersQuery.data?.purchaseOrders]);
  const orderIds = purchaseOrders.slice(0, 12).map((order) => order.id).join(',');

  const detailQueries = useQueries({
    queries: orderIds ? orderIds.split(',').map((id) => ({
      queryKey: ['api', `/api/purchase-orders/${id}`, Boolean(token)],
      queryFn: () => apiFetch<OrderPayload>(`/api/purchase-orders/${id}`),
      enabled: Boolean(token),
      staleTime: 30_000,
      retry: 1,
    })) : [],
  });
  const orderDetails = useMemo(
    () => detailQueries.flatMap((query) => query.data ? [query.data.purchaseOrder] : []),
    [detailQueries],
  );

  const metrics = useMemo(() => ({
    openRfqs: rfqs.filter((rfq) => rfq.status === 'PUBLISHED').length,
    quoteCount: rfqs.reduce((total, rfq) => total + (rfq._count?.quotes ?? 0), 0),
    samplesPending: orderDetails.reduce(
      (total, order) => total + (order.samples ?? []).filter((sample) =>
        ['REQUESTED', 'IN_PREPARATION', 'SHIPPED', 'RECEIVED', 'REVISION_REQUESTED'].includes(sample.status),
      ).length,
      0,
    ),
    activeMilestones: orderDetails.reduce(
      (total, order) => total + (order.milestones ?? []).filter((milestone) => milestone.status === 'ACTIVE').length,
      0,
    ),
  }), [rfqs, orderDetails]);

  const activity = useMemo<ApiActivity[]>(
    () => activityFromData(
      rfqs,
      orderDetails.length > 0 ? orderDetails : purchaseOrders,
    ),
    [rfqs, orderDetails, purchaseOrders],
  );

  return {
    rfqs,
    purchaseOrders,
    orderDetails,
    metrics,
    activity,
    loading: rfqsQuery.isLoading || ordersQuery.isLoading,
    error: rfqsQuery.error ?? ordersQuery.error,
    refetch: () => {
      void rfqsQuery.refetch();
      void ordersQuery.refetch();
      void queryClient.invalidateQueries({ queryKey: ['api', '/api/purchase-orders/'] });
    },
  };
}
