import { Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { DataSource } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { Customer } from '../customers/customer.entity';
import type { Order } from '../orders/order.entity';
import { customerOrderView } from '../orders/order.views';

export const STAFF_ROOM = 'staff';
export const SHOP_ROOM = 'shop';
export const customerRoom = (customerId: string) => `customer:${customerId}`;

/** Xodim ekranlari qaysi ma'lumotni qayta olishi kerak. */
export type ChangeScope =
  | 'catalog'
  | 'stock'
  | 'settings'
  | 'users'
  | 'warehouse'
  | 'expenses'
  | 'customers'
  | 'reviews'
  | 'telegram'
  | 'all';

/**
 * Socket.IO — faqat serverdan ekranlarga "o'zgardi" xabari (buyruqlar REST orqali). Ulanishda `auth` bilan:
 *  - `{ token }` (xodim) → `staff`: `order` (buyurtma to'liq) va `changed` ({ scopes }) voqealari;
 *  - `{ customerToken }` (mijoz ilovasi) → `customer:<id>`: o'z buyurtmalari (`order`), va `shop`;
 *  - hech narsasiz → `shop`: `catalog` (katalog / narx / qoldiq o'zgardi — qayta olish).
 * Qayta ulanganda ekran ro'yxatni REST'dan qaytadan oladi (uzilish paytidagi xabarlar yo'qolgan bo'lishi mumkin).
 */
@WebSocketGateway({ cors: { origin: true }, pingInterval: 10_000, pingTimeout: 10_000 })
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger('Realtime');

  @WebSocketServer()
  server?: Server;

  constructor(
    private readonly auth: AuthService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async handleConnection(client: Socket) {
    const rooms = await this.authorize(client).catch(() => null);
    if (!rooms) {
      client.emit('auth_error', { code: 'unauthorized' });
      client.disconnect(true);
      return;
    }
    await client.join(rooms);
    client.emit('ready', { rooms });
  }

  /** Buyurtma o'zgardi — tranzaksiya muvaffaqiyatli tugagandan keyin chaqiriladi. */
  orderChanged(order: Order) {
    if (!this.server) return;
    this.server.to(STAFF_ROOM).emit('order', order);
    if (order.customerId)
      this.server.to(customerRoom(order.customerId)).emit('order', customerOrderView(order));
    // qoldiq o'zgargan bo'lishi mumkin — mijoz katalogidagi "bor / yo'q" belgisi
    if (order.stockApplied || order.status === 'cancelled') this.catalogChanged();
  }

  /** Xodim ekranlariga: shu bo'limlar ma'lumotini qayta oling. */
  changed(...scopes: ChangeScope[]) {
    this.server?.to(STAFF_ROOM).emit('changed', { scopes });
  }

  /** Mijoz ilovalariga: katalogni qayta oling. */
  catalogChanged() {
    this.server?.to(SHOP_ROOM).emit('catalog', {});
  }

  private async authorize(client: Socket): Promise<string[] | null> {
    const auth = (client.handshake.auth ?? {}) as Record<string, unknown>;
    if (typeof auth.token === 'string') {
      const user = await this.auth.verifyStaff(auth.token);
      if (!user) return null;
      client.data.user = user;
      return [STAFF_ROOM];
    }
    if (typeof auth.customerToken === 'string') {
      const session = await this.auth.verifyCustomer(auth.customerToken);
      if (!session) return null;
      // Telegram orqali: boshqa qurilmada buyurtma bergan bo'lsa ham — o'sha mijoz
      const customerId =
        session.customerId ??
        (session.telegramId !== null
          ? ((await this.dataSource.manager.findOneBy(Customer, { telegramId: session.telegramId }))?.id ??
            null)
          : null);
      return customerId ? [SHOP_ROOM, customerRoom(customerId)] : [SHOP_ROOM];
    }
    this.logger.debug(`Mehmon ulanishi: ${client.id}`);
    return [SHOP_ROOM];
  }
}
