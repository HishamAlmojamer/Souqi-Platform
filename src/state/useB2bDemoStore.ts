import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { initialRfqs, type DemoRFQ } from '@/data/b2bDemo';

type NewRFQ = Pick<DemoRFQ, 'title' | 'industry' | 'quantity' | 'unit' | 'summary' | 'details'>;

type B2bDemoState = {
  rfqs: DemoRFQ[];
  createRFQ: (request: NewRFQ) => DemoRFQ;
  selectOffer: (rfqId: string, offerId: string) => void;
};

export const useB2bDemoStore = create<B2bDemoState>()(
  persist(
    (set) => ({
      rfqs: initialRfqs,
      createRFQ: (request) => {
        const newRequest: DemoRFQ = {
          ...request,
          id: `SQ-${String(Date.now()).slice(-6)}`,
          status: 'مسودة محلية',
          statusTone: 'muted',
          quoteCount: 0,
          dueDate: 'بانتظار تحديد الموعد',
          offers: [],
          selectedOfferId: undefined,
        };
        set((state) => ({ rfqs: [newRequest, ...state.rfqs] }));
        return newRequest;
      },
      selectOffer: (rfqId, offerId) => {
        set((state) => ({
          rfqs: state.rfqs.map((request) => request.id === rfqId
            ? {
                ...request,
                selectedOfferId: offerId,
                status: 'تم اختيار عرض مورد',
                statusTone: 'green',
                quoteCount: Math.max(request.quoteCount, request.offers?.length ?? 0),
                offers: (request.offers ?? []).map((offer) => ({
                  ...offer,
                  status: offer.id === offerId ? 'selected' : offer.status === 'selected' ? 'competitive' : offer.status,
                })),
              }
            : request),
        }));
      },
    }),
    {
      name: 'souqi-b2b-rfqs-v1',
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (state) => ({ rfqs: state.rfqs }),
    },
  ),
);
