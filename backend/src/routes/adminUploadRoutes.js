import multer from 'multer';
import { Router } from 'express';
import { env } from '../config/env.js';
import { uploadAdminImageController } from '../controllers/adminUploadController.js';
import { requireAdminAuth } from '../middlewares/requireAdminAuth.js';
import { AppError } from '../utils/appError.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.maxUploadMb * 1024 * 1024,
  },
  fileFilter(_req, file, callback) {
    if (!file.mimetype.startsWith('image/')) {
      callback(new AppError('Apenas imagens sao permitidas', 400, 'upload_invalid_type'));
      return;
    }

    callback(null, true);
  },
});

router.use(requireAdminAuth);
router.post('/image', upload.single('file'), uploadAdminImageController);

export default router;
