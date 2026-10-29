import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { bigintNumber, ID_LENGTH } from '../common/columns';

/** Botga /start bosgan yoki yozgan foydalanuvchi. Bot API'da "obunachilar ro'yxati" yo'q — bot o'zi yig'adi. */
@Entity('telegram_subscribers')
export class TelegramSubscriber {
  /** Telegram user id (shaxsiy chat id si ham shu) */
  @PrimaryColumn({ type: 'bigint', transformer: bigintNumber })
  id: number;

  @Column({ length: 100, default: '' })
  firstName: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  lastName: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  username: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  languageCode: string | null;

  @Column({ type: 'timestamptz' })
  firstSeen: Date;

  @Column({ type: 'timestamptz' })
  lastSeen: Date;

  /** blocked — foydalanuvchi botni to'xtatgan (xabar yuborib bo'lmaydi) */
  @Column({ type: 'varchar', length: 10, default: 'active' })
  status: 'active' | 'blocked';

  @Column({ type: 'int', default: 0 })
  messages: number;
}

/** "Xabarlar": botga kelgan (in) va bot yuborgan (out) xabarlar. */
@Entity('telegram_messages')
@Index(['chatId', 'at'])
export class TelegramMessage {
  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  @Column({ type: 'bigint', transformer: bigintNumber })
  chatId: number;

  @Column({ type: 'varchar', length: 3 })
  direction: 'in' | 'out';

  /** kimdan / kimga (ism) */
  @Column({ length: 150, default: '' })
  name: string;

  @Column({ type: 'text' })
  text: string;

  @Index()
  @Column({ type: 'timestamptz' })
  at: Date;
}

@Entity('telegram_broadcasts')
export class TelegramBroadcast {
  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  @Index()
  @Column({ type: 'timestamptz' })
  at: Date;

  @Column({ type: 'text' })
  text: string;

  /** "all" | "buyers" | "ru" | "uz" */
  @Column({ length: 20 })
  audience: string;

  @Column({ type: 'int', default: 0 })
  total: number;

  @Column({ type: 'int', default: 0 })
  sent: number;

  @Column({ type: 'int', default: 0 })
  failed: number;

  @Column({ type: 'int', default: 0 })
  blocked: number;

  @Column({ type: 'varchar', length: 10 })
  status: 'running' | 'done' | 'stopped';

  @Column({ type: 'varchar', length: ID_LENGTH })
  userId: string;
}
