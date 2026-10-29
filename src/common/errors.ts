import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Xato kodlari. Frontend matnni shu kod bo'yicha o'z tilida (uz / ru) ko'rsatadi; `message` — o'zbekcha standart matn
 * (loglar va kodni tarjima qilmaydigan mijozlar uchun), `detail` — texnik izoh (qaysi atir, qaysi id).
 */
export type ErrorCode =
  // ── umumiy ──
  | 'not_found'
  | 'unauthorized'
  | 'forbidden'
  | 'invalid_input'
  | 'too_many_attempts'
  // ── xodimlar va kirish ──
  | 'wrong_pin'
  | 'invalid_pin'
  | 'pin_taken'
  | 'last_admin'
  | 'self_action'
  | 'user_has_history'
  // ── katalog ──
  | 'name_required'
  | 'name_taken'
  | 'in_use'
  | 'group_locked'
  | 'image_required'
  | 'family_required'
  | 'invalid_price'
  | 'description_required'
  | 'invalid_image'
  // ── ombor va hujjatlar ──
  | 'invalid_qty'
  | 'invalid_amount'
  | 'duplicate_line'
  | 'unknown_stock_item'
  | 'future_date'
  | 'overpaid'
  | 'empty_lines'
  // ── buyurtmalar ──
  | 'empty_order'
  | 'product_unavailable'
  | 'flakon_unavailable'
  | 'invalid_slot'
  | 'phone_invalid'
  | 'address_required'
  | 'invalid_status'
  | 'order_finished'
  | 'payment_required'
  | 'lines_locked'
  // ── mijoz ──
  | 'invalid_init_data'
  | 'review_not_allowed'
  | 'already_reviewed'
  // ── Telegram ──
  | 'telegram_token_invalid'
  | 'telegram_unreachable'
  | 'telegram_not_connected'
  | 'telegram_error'
  | 'broadcast_running'
  | 'no_recipients'
  // ── demo ──
  | 'demo_disabled';

const STATUS: Partial<Record<ErrorCode, HttpStatus>> = {
  unauthorized: HttpStatus.UNAUTHORIZED,
  wrong_pin: HttpStatus.UNAUTHORIZED,
  invalid_init_data: HttpStatus.UNAUTHORIZED,
  forbidden: HttpStatus.FORBIDDEN,
  self_action: HttpStatus.FORBIDDEN,
  review_not_allowed: HttpStatus.FORBIDDEN,
  demo_disabled: HttpStatus.FORBIDDEN,
  not_found: HttpStatus.NOT_FOUND,
  pin_taken: HttpStatus.CONFLICT,
  last_admin: HttpStatus.CONFLICT,
  user_has_history: HttpStatus.CONFLICT,
  name_taken: HttpStatus.CONFLICT,
  in_use: HttpStatus.CONFLICT,
  group_locked: HttpStatus.CONFLICT,
  invalid_status: HttpStatus.CONFLICT,
  order_finished: HttpStatus.CONFLICT,
  lines_locked: HttpStatus.CONFLICT,
  already_reviewed: HttpStatus.CONFLICT,
  telegram_not_connected: HttpStatus.CONFLICT,
  broadcast_running: HttpStatus.CONFLICT,
  too_many_attempts: HttpStatus.TOO_MANY_REQUESTS,
  telegram_unreachable: HttpStatus.BAD_GATEWAY,
  telegram_error: HttpStatus.BAD_GATEWAY,
};

const MESSAGES: Record<ErrorCode, string> = {
  not_found: 'Topilmadi',
  unauthorized: 'Avval tizimga kiring',
  forbidden: 'Bu amal sizning rolingiz uchun emas',
  invalid_input: "So'rov ma'lumotlari noto'g'ri",
  too_many_attempts: "Ko'p marta urinildi — birozdan keyin qayta urinib ko'ring",
  wrong_pin: "PIN noto'g'ri",
  invalid_pin: "PIN 4–8 ta raqamdan iborat bo'lsin",
  pin_taken: 'Bu PIN boshqa xodimda bor — boshqasini tanlang',
  last_admin: 'Kamida bitta faol admin qolishi kerak',
  self_action: "O'zingizni o'chira, nofaol qila yoki admin rolidan olib tashlay olmaysiz",
  user_has_history: "Xodim buyurtma va hujjatlarda qayd etilgan — o'chirish o'rniga nofaol qiling",
  name_required: 'Nomini kiriting',
  name_taken: 'Bunday nom allaqachon bor',
  in_use: "Ishlatilmoqda — o'chirib bo'lmaydi",
  group_locked: "Kategoriyada atirlar bor — turini o'zgartirib bo'lmaydi",
  image_required: 'Rasm tanlang',
  family_required: 'Kamida bitta aromat oilasini tanlang',
  invalid_price: "Narx noto'g'ri",
  description_required: 'Tavsifni ikkala tilda yozing',
  invalid_image: "Rasm JPG, PNG, WEBP yoki AVIF bo'lishi va 5 MB dan oshmasligi kerak",
  invalid_qty: "Miqdor noto'g'ri",
  invalid_amount: "Summa noto'g'ri",
  duplicate_line: 'Bir pozitsiya ikki marta kiritilgan',
  unknown_stock_item: 'Ombor pozitsiyasi topilmadi',
  future_date: "Sana kelajakda bo'lmasin",
  overpaid: "To'lov summadan ko'p bo'lmasin",
  empty_lines: 'Kamida bitta pozitsiya va miqdor kiriting',
  empty_order: "Savat bo'sh",
  product_unavailable: "Atir sotuvda yo'q",
  flakon_unavailable: 'Flakon topilmadi',
  invalid_slot: 'Tanlangan kun yoki soat mavjud emas',
  phone_invalid: "Telefon raqam noto'g'ri",
  address_required: 'Yetkazib berish manzilini kiriting',
  invalid_status: "Buyurtmani bu holatga o'tkazib bo'lmaydi",
  order_finished: 'Buyurtma yopilgan (berilgan yoki bekor qilingan)',
  payment_required: "To'lov turini tanlang",
  lines_locked: "Tovar ombordan chiqarilgan — qatorlarni o'zgartirib bo'lmaydi",
  invalid_init_data: "Telegram ma'lumoti tasdiqlanmadi — ilovani bot orqali qayta oching",
  review_not_allowed: 'Sharhni faqat shu atirni xarid qilgan mijoz yoza oladi',
  already_reviewed: 'Bu atirga sharh yozgansiz',
  telegram_token_invalid: "Bot tokeni noto'g'ri — @BotFather bergan tokenni to'liq nusxalang",
  telegram_unreachable: "Telegram serveriga ulanib bo'lmadi — internetni tekshiring",
  telegram_not_connected: 'Avval bot tokenini kiriting',
  telegram_error: 'Telegram xato qaytardi',
  broadcast_running: "Rassilka davom etmoqda — tugashini kuting yoki to'xtating",
  no_recipients: "Qabul qiluvchilar yo'q",
  demo_disabled: "Demo rejimi o'chiq (.env: DEMO=1)",
};

/** Javob tanasi: `{ statusCode, code, message, detail? }`. */
export function appError(code: ErrorCode, detail?: string): HttpException {
  const status = STATUS[code] ?? HttpStatus.BAD_REQUEST;
  return new HttpException(
    { statusCode: status, code, message: MESSAGES[code], ...(detail && { detail }) },
    status,
  );
}

export function fail(code: ErrorCode, detail?: string): never {
  throw appError(code, detail);
}
