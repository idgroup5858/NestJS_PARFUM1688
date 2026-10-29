/**
 * Ombordagi har bir pozitsiya kaliti (frontend `domain/stock.ts` bilan bir xil):
 * `gram:<productId>` — razliv atir, grammda; `bottle:<productId>` — original flakon, dona; `flakon:<flakonId>` — tara, dona.
 */
export const STOCK_KINDS = ['gram', 'bottle', 'flakon'] as const;
export type StockKind = (typeof STOCK_KINDS)[number];
export type StockKey = `${StockKind}:${string}`;

export function stockKey(kind: StockKind, id: string): StockKey {
  return `${kind}:${id}`;
}

export function parseStockKey(key: string): { kind: StockKind; id: string } | null {
  const index = key.indexOf(':');
  if (index < 1) return null;
  const kind = key.slice(0, index) as StockKind;
  const id = key.slice(index + 1);
  return STOCK_KINDS.includes(kind) && id ? { kind, id } : null;
}

export function isStockKey(key: string): key is StockKey {
  return parseStockKey(key) !== null;
}

/** O'lchov birligi: razliv — gramm, original flakon va tara — dona. */
export function stockUnit(key: StockKey): 'g' | 'pcs' {
  return key.startsWith('gram:') ? 'g' : 'pcs';
}
