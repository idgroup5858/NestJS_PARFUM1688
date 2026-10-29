import type { Order } from './order.entity';
import { orderTotals } from './order-logic';

/**
 * Mijozga ko'rinadigan buyurtma: tannarx, kassir va xodim id lari yo'q. Holatlar tarixi — faqat holat va vaqt.
 */
export function customerOrderView(order: Order) {
  return {
    id: order.id,
    number: order.number,
    source: order.source,
    createdAt: order.createdAt,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    fulfillment: order.fulfillment,
    address: order.address,
    slot: order.slot,
    comment: order.comment,
    lines: order.lines.map(({ unitCost: _cost, flakon, ...line }) => ({
      ...line,
      ...(flakon && { flakon: { flakonId: flakon.flakonId, paid: flakon.paid, price: flakon.price } }),
    })),
    deliveryFee: order.deliveryFee,
    status: order.status,
    payment: order.payment,
    history: order.history.map(({ status, at }) => ({ status, at })),
    totals: orderTotals(order),
  };
}

export type CustomerOrderView = ReturnType<typeof customerOrderView>;
