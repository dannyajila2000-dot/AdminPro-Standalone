import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { NoSoloLecturaGuard } from '../common/guards/no-solo-lectura.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type RequestUser,
} from '../common/decorators/current-user.decorator';
import { CloudinaryService } from './cloudinary.service';

const CINCO_MB = 5 * 1024 * 1024;

@ApiTags('uploads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}

  @ApiConsumes('multipart/form-data')
  @Post('imagen')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: CINCO_MB },
      fileFilter: (_req, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
          callback(new BadRequestException('Solo se permiten imágenes'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  async subirImagen(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: RequestUser,
  ) {
    if (!file) {
      throw new BadRequestException('No se recibió ningún archivo');
    }

    const url = await this.cloudinaryService.subirImagen(
      file.buffer,
      `backoffice/${user.empresaId}`,
    );

    return { url };
  }

  @ApiConsumes('multipart/form-data')
  @UseGuards(NoSoloLecturaGuard)
  @Post('comprobante')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: CINCO_MB },
      fileFilter: (_req, file, callback) => {
        if (!file.mimetype.startsWith('image/') && file.mimetype !== 'application/pdf') {
          callback(new BadRequestException('Solo se permiten imágenes o archivos PDF'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  async subirComprobante(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: RequestUser,
  ) {
    if (!file) {
      throw new BadRequestException('No se recibió ningún archivo');
    }

    const url = await this.cloudinaryService.subirDocumento(
      file.buffer,
      `backoffice/${user.empresaId}/comprobantes`,
    );

    return { url };
  }
}
