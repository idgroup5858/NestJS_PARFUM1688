# PARFUM1688 API

Manzil: `http://<server>:3001/api`. JSON. Pul — butun so'm, vaqt — ISO satr, sana — `"YYYY-MM-DD"`.

**Kirish.** Xodim: `POST /auth/login` → `Authorization: Bearer <token>` (24 soat). Mijoz ilovasi: o'z tokeni
(`/shop/session` yoki birinchi `/shop/orders` javobida, 365 kun). Rol: **A** — admin, **X** — istalgan xodim
(admin yoki kassir), **M** — mijoz tokeni, **ochiq** — tokensiz.

**Xato javobi:** `{ statusCode, code, message, detail? }`. `code` — mashina uchun (frontend matnni o'z tilida
ko'rsatadi), `message` — o'zbekcha standart matn. Kodlar ro'yxati — `src/common/errors.ts`. Validatsiya xatosi —
`invalid_input` (`detail`: `lines.0.qty: qty must not be less than 1`). Noma'lum maydonlar jimgina tashlanadi.

## Kirish va xodimlar

| Endpoint | Rol | Tana / izoh |
| --- | --- | --- |
| `POST /auth/login` | ochiq | `{ pin }` → `{ token, user }`. IP dan daqiqasiga 10 ta (`too_many_attempts`) |
| `GET /auth/me` | X | joriy xodim |
| `GET /users` | X | PIN'siz ro'yxat |
| `POST /users` | A | `{ name, role, pin, active? }` — `pin_taken` |
| `PATCH /users/:id` | A | `{ name?, role?, pin?, active? }` — `last_admin`, `self_action` |
| `DELETE /users/:id` | A | `user_has_history` — o'rniga `active: false` |

## Sozlamalar va katalog

| Endpoint | Rol | Tana / izoh |
| --- | --- | --- |
| `GET /settings` | X | do'kon sozlamalari |
| `PATCH /settings` | A | `{ name?, phone?, address?, customerAccentId?, minGrams?, gramChips?, lowStockGrams?, lowStockPieces?, receiptFooter? }` |
| `GET /catalog` | X | `{ brands, categories, notes, accords, products, flakons, banners }` (nofaollari ham) |
| `POST /brands`, `PUT /brands/:id`, `DELETE /brands/:id` | A | `{ name, country? }` — `name_taken`, `in_use` |
| `POST/PUT/DELETE /categories[/:id]` | A | `{ name: {ru,uz}, group, image, sort }` — `image_required` (oila), `group_locked`, `in_use` |
| `POST/PUT/DELETE /notes[/:id]` | A | `{ name: {ru,uz}, image }` |
| `POST/PUT/DELETE /accords[/:id]` | A | `{ name: {ru,uz}, color: "#rrggbb" }` |
| `POST /products`, `PUT /products/:id` | A | to'liq atir (`id`, `createdAt` — serverda; id nomdan: "dior-sauvage") — `name_taken`, `family_required`, `description_required` |
| `PATCH /products/:id/active` | A | `{ active }` |
| `DELETE /products/:id` | A | buyurtma / hujjat / harakatda bo'lsa `in_use` |
| `POST/PUT/DELETE /flakons[/:id]`, `PATCH /flakons/:id/active` | A | `{ name, volumeMl, price, image, active }` |
| `POST/PUT/DELETE /banners[/:id]`, `PATCH /banners/:id/active` | A | `{ title, subtitle, button: {ru,uz}, link, image, active, sort }` |
| `GET /images?folder=` | A | galereya: `[{ path: "perfumes/x.png", url: "/images/perfumes/x.png", ... }]` |
| `POST /images` | A | multipart: `file`, `folder` (perfumes / notes / categories / banners / flakons) — JPG, PNG, WEBP, AVIF ≤ 5 MB; fayl `IMAGES_DIR/<papka>` ga yoziladi |
| `GET /images/<papka>/<fayl>` (prefiksiz) | ochiq | rasmning o'zi — `IMAGES_DIR` dan (standart: backendning `uploads` papkasi); kengaytmasi boshqa bo'lsa ham nomi bo'yicha topiladi |

## Ombor

Pozitsiya kaliti: `gram:<atir id>` (gramm), `bottle:<atir id>` (original, dona), `flakon:<flakon id>` (tara, dona).

| Endpoint | Rol | Tana / izoh |
| --- | --- | --- |
| `GET /stock` | X | `[{ key, kind, itemId, name, volumeMl?, unit, qty, avgCost (faqat A), onSale, low }]` |
| `GET /stock/movements?key=&refId=&limit=` | A | harakatlar, eng yangisi birinchi |
| `GET /suppliers` | A | har biri bilan `purchased`, `paid`, `debt` |
| `POST /suppliers`, `PUT /suppliers/:id`, `DELETE /suppliers/:id` | A | `{ name, phone, note? }` — `in_use` |
| `GET /supplier-payments?supplierId=&from=&to=` | A | |
| `POST /supplier-payments` | A | `{ supplierId, date, amount, note? }` — qarzga to'lov |
| `GET /purchases?supplierId=&from=&to=`, `GET /purchases/:id` | A | |
| `POST /purchases` | A | `{ supplierId, date, paid, note?, lines: [{ key, qty, unitCost }] }` — `overpaid`, `future_date`, `duplicate_line`, `unknown_stock_item` |
| `GET /inventories`, `GET /inventories/:id` | A | |
| `POST /inventories` | A | `{ date, note?, lines: [{ key, actual }] }` — "kutilgan" va tannarx serverda |
| `GET /write-offs`, `GET /write-offs/:id` | A | |
| `POST /write-offs` | A | `{ date, reason, note?, lines: [{ key, qty }] }` — qoldiqdan ko'p bo'lsa ham yoziladi (manfiy) |

## Buyurtmalar (kassa)

| Endpoint | Rol | Tana / izoh |
| --- | --- | --- |
| `GET /orders?active=1` | X | kassa navbati (new → ready) |
| `GET /orders?status=done,cancelled&source=bot&from=&to=&customerId=&limit=` | X | tarix (yaratilgan kun bo'yicha) |
| `GET /orders/:id` | X | |
| `POST /orders` | X | kassa sotuvi: `{ name?, phone?, payment, lines: [{ productId, kind, qty, flakon?: { flakonId, paid } }] }` → `done`, tovar darhol chiqadi |
| `PATCH /orders/:id` | X | `{ flakons?: [{ lineId, flakonId \| null, paid }], deliveryFee?, payment?, status? }` — bitta tranzaksiyada |

Holat qoidalari: faqat oldinga (`new → accepted → preparing → ready → done`, bosqich tashlab o'tish mumkin) yoki
`cancelled`; berilgan (`done`) buyurtmani faqat admin bekor qila oladi. `ready` / `done` — tovar ombordan chiqadi
(qatorlarga `unitCost`), `cancelled` — qaytadi. Xatolar:
`invalid_status`, `order_finished`, `payment_required` (`done` uchun), `lines_locked` (tovar chiqqandan keyin tara).

## Mijozlar, sharhlar, chiqimlar

| Endpoint | Rol | Tana / izoh |
| --- | --- | --- |
| `GET /customers?phone=` | X | shu raqam egasi yoki `null` (kassada ismni avtomatik qo'yish) |
| `GET /customers` | A | `orders`, `spent`, `lastOrderAt` bilan |
| `GET /reviews` | A | hammasi |
| `PATCH /reviews/:id` | A | `{ hidden }` |
| `DELETE /reviews/:id` | A | |
| `GET/POST/PUT/DELETE /expense-categories[/:id]` | A | `{ name }` — `in_use` |
| `GET /expenses?from=&to=` | A | |
| `POST /expenses`, `PUT /expenses/:id`, `DELETE /expenses/:id` | A | `{ date, categoryId, amount, payment, note? }` |
| `GET /snapshot` | X | butun baza frontend `Db` ko'rinishida (kassirga — tannarx va moliyasiz) |
| `GET /demo` | ochiq | `{ demo, pins: [{ name, role, pin }] }` — kirish sahifasidagi demo PIN'lar (faqat `DEMO=1`, PIN'i o'zgarmagan xodimlar) |
| `POST /demo/reset` | A | faqat `DEMO=1`: demo ma'lumotlarni tiklash |

## Mijoz ilovasi (`/shop`)

| Endpoint | Rol | Tana / izoh |
| --- | --- | --- |
| `GET /shop/catalog` | ochiq | `{ settings, brands, categories, notes, accords, flakons, products (faol, `available: { grams, bottles }`, `rating`, `sales30d`), banners }` |
| `POST /shop/session` | ochiq | `{ initData }` (Telegram `WebApp.initData`) → `{ token, telegramUser, customer }` — `invalid_init_data` |
| `GET /shop/me` | M | `{ customer, telegramId }` |
| `POST /shop/orders` | M (ixtiyoriy) | `{ name, phone: "998...", fulfillment, address?, slot: { date, hour }, comment?, lines: [{ productId, kind, qty }] }` → `{ order, token, customer }` — `phone_invalid`, `address_required`, `invalid_slot`, `invalid_qty` (`minGrams`), `product_unavailable` |
| `GET /shop/orders`, `GET /shop/orders/:id` | M | o'z buyurtmalari (tannarx va xodim id larisiz, `totals` bilan) |
| `GET /shop/products/:id/reviews` | M (ixtiyoriy) | `{ reviews, average, count, canReview, reviewed }` |
| `POST /shop/products/:id/reviews` | M | `{ rating: 1–5, text }` — `review_not_allowed`, `already_reviewed` |

Yetkazish vaqti: bugun, ertaga yoki indinga, 10:00–21:00; bugun — faqat hali kelmagan soatlar.

## Telegram (`/telegram`, faqat A)

| Endpoint | Tana / izoh |
| --- | --- |
| `GET /telegram` | holat: `connected`, `bot`, `tokenHint`, `polling`, `running`, `lastPollAt`, `lastError`, `webhookUrl`, `miniAppUrl`, `welcome`, `notify` (token qaytmaydi) |
| `POST /telegram/connect` | `{ token }` — boshqa bot bo'lsa eski obunachilar tozalanadi |
| `POST /telegram/refresh`, `/disconnect`, `/delete-webhook` | |
| `PATCH /telegram/settings` | `{ miniAppUrl?, menuButtonText?, polling?, clearError?, welcome?: {...}, notify?: { customers?, staff?, staffChatId?, staffLang? } }` |
| `GET /telegram/profile` | `{ commands, description, shortDescription, menuButton }` |
| `PUT /telegram/commands` | `{ commands: [{ command, description }] }` |
| `PUT /telegram/description` | `{ description, shortDescription }` |
| `PUT /telegram/menu-button` | `{ type: "web_app", text, url }` yoki `{ type: "commands" }` |
| `GET /telegram/subscribers` | `customerId` va `orders` bilan |
| `GET /telegram/messages?chatId=&limit=` | "Xabarlar" |
| `POST /telegram/messages` | `{ chatId, text }` |
| `GET /telegram/broadcasts` | oxirgi 50 ta (jarayondagi ham) |
| `POST /telegram/broadcasts` | `{ text, audience: all \| buyers \| ru \| uz, withButton?, buttonText? }` — serverda ketadi |
| `POST /telegram/broadcasts/test` | `{ text, withButton?, buttonText? }` — xodimlar chatiga |
| `POST /telegram/broadcasts/:id/stop` | |

Bot avtomatik: /start ga salom (Mini App tugmasi bilan), yangi bot buyurtmasi → xodimlar chatiga, holat
(qabul qilindi / tayyor / berildi / bekor) → mijozga o'z tilida.

## Socket.IO

Shu portda (`/socket.io`). Ulanish: `io(url, { auth: { token } })` — xodim, `{ customerToken }` — mijoz, bo'sh — mehmon.

| Voqea | Kimga | Ma'lumot |
| --- | --- | --- |
| `ready` | hammaga | `{ rooms }` |
| `order` | xodimlar; buyurtma egasi (mijoz ko'rinishida) | buyurtma |
| `changed` | xodimlar | `{ scopes: ["catalog" \| "stock" \| "settings" \| "users" \| "warehouse" \| "expenses" \| "customers" \| "reviews" \| "telegram" \| "all"] }` |
| `catalog` | mijoz ilovalari | `{}` — katalogni qayta oling |
| `auth_error` | | token yaroqsiz — ulanish uziladi |

## Frontend sahifalari → endpointlar

| Frontend | Endpoint |
| --- | --- |
| `LoginPage`, `app/session.ts` | `POST /auth/login`, `GET /auth/me` |
| `kassa/pos/CartPanel` | `POST /orders`, `GET /customers?phone=` |
| `kassa/board/OrdersBoardPage`, `OrderModal` | `PATCH /orders/:id` |
| `customer/checkout/CheckoutPage` | `POST /shop/orders` |
| `customer/product/ReviewsSection` | `GET/POST /shop/products/:id/reviews` |
| `admin/catalog/*Page` | `POST/PUT/DELETE/PATCH …/active` katalog endpointlari |
| `admin/catalog/UsersPage` | `/users` |
| `admin/catalog/SettingsPage` | `PATCH /settings`, `POST /demo/reset` |
| `admin/catalog/ReviewsPage` | `PATCH/DELETE /reviews/:id` |
| `admin/ops/PurchaseFormModal`, `InventoryPage`, `WriteOffsPage`, `SuppliersPage` | `/purchases`, `/inventories`, `/write-offs`, `/suppliers`, `/supplier-payments` |
| `admin/ops/ExpensesPage` | `/expenses`, `/expense-categories` |
| `admin/integrations/*` | `/telegram/*` |
| `components/admin/ImagePicker` | `GET/POST /images` |
