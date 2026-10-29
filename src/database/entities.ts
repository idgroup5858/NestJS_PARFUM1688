import { Accord, Banner, Brand, Category, Flakon, Note, Product } from '../catalog/entities';
import { Customer } from '../customers/customer.entity';
import { Expense, ExpenseCategory } from '../expenses/expense.entities';
import { Order } from '../orders/order.entity';
import { Review } from '../reviews/review.entity';
import { StockBalance, StockMovement } from '../stock/stock.entities';
import { TelegramBroadcast, TelegramMessage, TelegramSubscriber } from '../telegram/telegram.entities';
import { User } from '../users/user.entity';
import {
  InventoryCount,
  Purchase,
  Supplier,
  SupplierPayment,
  WriteOff,
} from '../warehouse/warehouse.entities';
import { Counter } from './counters';
import { Setting } from './setting.entity';

export const ENTITIES = [
  Setting,
  Counter,
  User,
  Brand,
  Category,
  Note,
  Accord,
  Product,
  Flakon,
  Banner,
  StockBalance,
  StockMovement,
  Supplier,
  Purchase,
  SupplierPayment,
  InventoryCount,
  WriteOff,
  ExpenseCategory,
  Expense,
  Customer,
  Order,
  Review,
  TelegramSubscriber,
  TelegramMessage,
  TelegramBroadcast,
];
