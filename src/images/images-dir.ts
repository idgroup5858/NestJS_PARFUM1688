import { isAbsolute, resolve } from 'node:path';

/**
 * Rasmlar papkasi (`IMAGES_DIR`, standart — backendning `uploads` papkasi; nisbiy yo'l — ishga tushirilgan papkaga
 * nisbatan). Ma'lumotlarda rasm shu papka ichidagi yo'l bilan saqlanadi: "perfumes/dior-sauvage.png" →
 * `/images/perfumes/dior-sauvage.png`. Boshlang'ich katalog rasmlari ham, admin yuklaganlari ham shu yerda.
 */
export function imagesDir(): string {
  const dir = process.env.IMAGES_DIR || 'uploads';
  return isAbsolute(dir) ? dir : resolve(process.cwd(), dir);
}

/** Admin rasm tanlaydigan / yuklaydigan papkalar (frontend `images/index.ts` → IMAGE_FOLDERS). */
export const IMAGE_FOLDERS = ['perfumes', 'notes', 'categories', 'banners', 'flakons'] as const;
export type ImageFolder = (typeof IMAGE_FOLDERS)[number];
