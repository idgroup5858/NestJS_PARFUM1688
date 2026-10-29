import { addDays, todayKey } from '../common/dates';
import { escapeHtml, formatDate, formatNumber, formatOrderNumber, formatPhone } from '../common/format';
import type { OrderStatus } from '../common/types';
import type { Order } from '../orders/order.entity';
import { orderTotals } from '../orders/order-logic';
import type { ShopSettings } from '../settings/settings.service';

/** Bot xabarlari matni (frontend `integrations/telegram/messages.ts`): mijozga — uning tilida, xodimlarga — sozlamadagi tilda. */

/** Mijozga xabar qilinadigan holatlar ("Tayyorlanmoqda" — ichki bosqich, xabarsiz). */
export const CUSTOMER_NOTIFY_STATUSES: OrderStatus[] = ['accepted', 'ready', 'done', 'cancelled'];

type Lang = 'ru' | 'uz';

const money = (value: number, lang: Lang) => `${formatNumber(value)} ${lang === 'ru' ? 'сум' : "so'm"}`;

function slotText(order: Order, lang: Lang): string {
  if (!order.slot) return '';
  const today = todayKey();
  const days: Record<string, [string, string]> = {
    [today]: ['сегодня', 'bugun'],
    [addDays(today, 1)]: ['завтра', 'ertaga'],
    [addDays(today, 2)]: ['послезавтра', 'indinga'],
  };
  const day = days[order.slot.date]?.[lang === 'ru' ? 0 : 1] ?? formatDate(order.slot.date);
  return `${day}, ${String(order.slot.hour).padStart(2, '0')}:00`;
}

/** Buyurtma holati o'zgarganda mijozga; xabar qilinmaydigan holatda — null. */
export function customerStatusMessage(shop: ShopSettings, order: Order, lang: Lang): string | null {
  const number = `<b>${formatOrderNumber(order.number)}</b>`;
  const total = money(orderTotals(order).total, lang);
  const phone = formatPhone(shop.phone);
  const address = escapeHtml(shop.address);
  const slot = slotText(order, lang);
  const delivery = order.fulfillment === 'delivery';
  if (lang === 'ru') {
    switch (order.status) {
      case 'accepted':
        return `✅ Заказ ${number} принят. Мы начали его собирать.${slot ? `\n🕐 ${delivery ? 'Доставка' : 'Самовывоз'}: ${slot}` : ''}`;
      case 'ready':
        return delivery
          ? `🎁 Заказ ${number} готов и скоро будет передан курьеру.\n💰 К оплате курьеру: ${total}`
          : `🎁 Заказ ${number} готов! Ждём вас в магазине${slot ? ` (${slot})` : ''}.\n📍 ${address}\n💰 К оплате: ${total}`;
      case 'done':
        return `💐 Заказ ${number} выдан. Спасибо за покупку! Будем рады видеть вас снова.`;
      case 'cancelled':
        return `❌ Заказ ${number} отменён. Если это ошибка — позвоните нам: ${phone}`;
      default:
        return null;
    }
  }
  switch (order.status) {
    case 'accepted':
      return `✅ ${number} buyurtmangiz qabul qilindi. Tayyorlashni boshladik.${slot ? `\n🕐 ${delivery ? 'Yetkazish' : 'Olib ketish'}: ${slot}` : ''}`;
    case 'ready':
      return delivery
        ? `🎁 ${number} buyurtmangiz tayyor, tez orada kuryerga beriladi.\n💰 Kuryerga to'lov: ${total}`
        : `🎁 ${number} buyurtmangiz tayyor! Do'konda kutamiz${slot ? ` (${slot})` : ''}.\n📍 ${address}\n💰 To'lov: ${total}`;
    case 'done':
      return `💐 ${number} buyurtmangiz topshirildi. Xaridingiz uchun rahmat! Yana kutib qolamiz.`;
    case 'cancelled':
      return `❌ ${number} buyurtmangiz bekor qilindi. Xato bo'lsa, qo'ng'iroq qiling: ${phone}`;
    default:
      return null;
  }
}

/** Yangi bot buyurtmasi — xodimlar chatiga. */
export function staffNewOrderMessage(order: Order, lang: Lang): string {
  const tr = (uz: string, ru: string) => (lang === 'uz' ? uz : ru);
  const lines = order.lines
    .map(
      (line) =>
        `• ${escapeHtml(line.name)} — ${
          line.kind === 'gram'
            ? `${formatNumber(line.qty)} ${tr('g', 'г')}`
            : `${tr('original', 'оригинал')} × ${formatNumber(line.qty)}`
        }`,
    )
    .join('\n');
  const slot = slotText(order, lang);
  const fulfillment =
    order.fulfillment === 'delivery' ? tr('Yetkazib berish', 'Доставка') : tr('Olib ketish', 'Самовывоз');
  return [
    `🛍 <b>${tr('Yangi buyurtma', 'Новый заказ')} ${formatOrderNumber(order.number)}</b>`,
    `👤 ${escapeHtml(order.customerName)}${order.customerPhone ? `, ${formatPhone(order.customerPhone)}` : ''}`,
    `📦 ${fulfillment}${slot ? ` · ${slot}` : ''}`,
    order.address ? `📍 ${escapeHtml(order.address)}` : '',
    lines,
    order.comment ? `💬 ${escapeHtml(order.comment)}` : '',
    `💰 ${money(orderTotals(order).total, lang)}`,
  ]
    .filter(Boolean)
    .join('\n');
}
