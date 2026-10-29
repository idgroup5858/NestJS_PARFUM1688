import { Injectable } from '@nestjs/common';
import type { Dirent } from 'node:fs';
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { join, parse } from 'node:path';
import { fail } from '../common/errors';
import { IMAGE_FOLDERS, imagesDir, type ImageFolder } from './images-dir';

/** Yuklanadigan rasm hajmi chegarasi. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export interface ImageFile {
  /** ma'lumotlarga yoziladigan yo'l: "perfumes/dior-sauvage.png" */
  path: string;
  /** brauzer manzili: "/images/perfumes/dior-sauvage.png" */
  url: string;
  folder: ImageFolder;
  name: string;
  size: number;
  modifiedAt: string;
}

/** Multer'ning xotiradagi fayli (kerakli maydonlari). */
export interface UploadedImage {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** Ro'yxatga va `/images` ga kiradigan fayllar — papkaga qo'lda tashlanganlar ham. SVG — yo'q (ichida skript bo'lishi mumkin). */
export const READABLE = /\.(jpe?g|png|webp|avif)$/i;

/** Ruxsat etilgan tur → kengaytma va fayl boshidagi belgisi (mijoz yuborgan turga ishonilmaydi). */
const FORMATS: Record<string, { ext: string; matches: (head: Buffer) => boolean }> = {
  'image/jpeg': { ext: '.jpg', matches: (h) => h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff },
  'image/png': {
    ext: '.png',
    matches: (h) => h.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  'image/webp': {
    ext: '.webp',
    matches: (h) => h.toString('latin1', 0, 4) === 'RIFF' && h.toString('latin1', 8, 12) === 'WEBP',
  },
  'image/avif': { ext: '.avif', matches: (h) => h.toString('latin1', 4, 12) === 'ftypavif' },
};

/** Fayl nomi: lotin harflari, raqam va "-" (`Dior Sauvage (1).PNG` → `dior-sauvage-1`); bo'sh qolsa — `rasm`. */
export function slugName(original: string): string {
  const slug = parse(original)
    .name.normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return slug || 'rasm';
}

const stem = (name: string) => name.replace(/\.[^./]+$/, '').toLowerCase();

@Injectable()
export class ImagesService {
  /** Papkadagi (yoki hamma papkadagi) rasmlar — nomi bo'yicha tartibda. */
  async list(folder?: ImageFolder): Promise<ImageFile[]> {
    const folders = folder ? [folder] : [...IMAGE_FOLDERS];
    const groups = await Promise.all(
      folders.map(async (name) => {
        // papka hali yo'q — bo'sh (birinchi yuklashda yaratiladi)
        const entries = await readdir(join(imagesDir(), name), { withFileTypes: true }).catch(
          (): Dirent[] => [],
        );
        const files = entries
          .filter((entry) => entry.isFile() && READABLE.test(entry.name))
          .map((entry) => entry.name);
        return Promise.all(files.map((file) => this.info(name, file)));
      }),
    );
    return groups.flat().sort((a, b) => a.path.localeCompare(b.path));
  }

  /** Rasmni papkaga saqlaydi; nom band bo'lsa — `dior-2.png`, `dior-3.png`. */
  async upload(folder: ImageFolder, file: UploadedImage | undefined): Promise<ImageFile> {
    if (!file) fail('invalid_image', 'file is missing');
    const format = FORMATS[file.mimetype] ?? fail('invalid_image', file.mimetype);
    if (file.size > MAX_IMAGE_BYTES) fail('invalid_image', `${file.size} bytes`);
    if (!format.matches(file.buffer)) fail('invalid_image', `not a ${file.mimetype} file`);

    const dir = join(imagesDir(), folder);
    await mkdir(dir, { recursive: true });
    const base = slugName(file.originalname);
    for (let n = 1; ; n++) {
      const name = `${n === 1 ? base : `${base}-${n}`}${format.ext}`;
      try {
        // `wx` — fayl bor bo'lsa yozmaydi (bir vaqtda ikki yuklash bir-birini bosib ketmasin)
        await writeFile(join(dir, name), file.buffer, { flag: 'wx' });
        return this.info(folder, name);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      }
    }
  }

  /**
   * `/images/<papka>/<fayl>` uchun haqiqiy fayl: aniq nomi, bo'lmasa — nomi bir xil, kengaytmasi boshqa fayl
   * ("notes/bergamot.png" → bergamot.jpg). Topilmasa — `null`.
   */
  async resolve(folder: string, file: string): Promise<string | null> {
    if (
      !(IMAGE_FOLDERS as readonly string[]).includes(folder) ||
      !/^[A-Za-z0-9._-]+$/.test(file) ||
      file.startsWith('.')
    ) {
      return null;
    }
    const dir = join(imagesDir(), folder);
    const exact = join(dir, file);
    if (
      READABLE.test(file) &&
      (await stat(exact)
        .then((s) => s.isFile())
        .catch(() => false))
    )
      return exact;
    const entries = await readdir(dir).catch((): string[] => []);
    const match = entries.find((name) => READABLE.test(name) && stem(name) === stem(file));
    return match ? join(dir, match) : null;
  }

  private async info(folder: ImageFolder, name: string): Promise<ImageFile> {
    const { size, mtime } = await stat(join(imagesDir(), folder, name));
    const path = `${folder}/${name}`;
    return { path, url: `/images/${path}`, folder, name, size, modifiedAt: mtime.toISOString() };
  }
}
