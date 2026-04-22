import multer from 'multer';
import { Router } from 'express';
import { env } from '../config/env.js';
import { uploadAdminImageController } from '../controllers/adminUploadController.js';
import { adminUploadRateLimiter } from '../middlewares/rateLimit.js';
import { requireAdminAuth } from '../middlewares/requireAdminAuth.js';
import { AppError } from '../utils/appError.js';
import { getAcceptedImageMimeTypes } from '../utils/imageValidation.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.maxUploadMb * 1024 * 1024,
  },
  fileFilter(_req, file, callback) {
    if (!getAcceptedImageMimeTypes().includes(file.mimetype)) {
      callback(new AppError('Apenas imagens JPG, PNG, WEBP, GIF ou SVG sao permitidas', 400, 'upload_invalid_type'));
      return;
    }

    callback(null, true);
  },
});

router.use(requireAdminAuth);
router.post('/image', adminUploadRateLimiter, upload.single('file'), uploadAdminImageController);

export default router;
