import { Body, Controller, Get, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsIn, IsOptional } from 'class-validator';
import { Roles } from '../auth/decorators';
import { IMAGE_FOLDERS, type ImageFolder } from './images-dir';
import { ImagesService, type UploadedImage } from './images.service';

class FolderQuery {
  @IsOptional()
  @IsIn(IMAGE_FOLDERS)
  folder?: ImageFolder;
}

class UploadImageDto {
  @IsIn(IMAGE_FOLDERS)
  folder: ImageFolder;
}

/**
 * Admin galereyasi: papkadagi rasmlar (qo'lda tashlanganlari ham) va kompyuterdan yuklash (multipart: `file`,
 * `folder`). Rasmlarning o'zi — `/images/<papka>/<fayl>` (API prefiksisiz, `main.ts`).
 */
@Roles('admin')
@Controller('images')
export class ImagesController {
  constructor(private readonly images: ImagesService) {}

  @Get()
  list(@Query() query: FolderQuery) {
    return this.images.list(query.folder);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024, files: 1 } }))
  upload(@Body() dto: UploadImageDto, @UploadedFile() file: UploadedImage | undefined) {
    return this.images.upload(dto.folder, file);
  }
}
