import multer from 'multer';
import { Router } from 'express';
import { env } from '../config/env.js';
import {
  createClientPanelAppointmentServiceController,
  createClientPanelProductController,
  createClientPanelProfessionalController,
  deleteClientPanelAppointmentServiceController,
  deleteClientPanelProductController,
  deleteClientPanelProfessionalController,
  getClientPanelAnalyticsController,
  getClientPanelBusinessController,
  listClientPanelAppointmentRequestsController,
  listClientPanelAppointmentServicesController,
  listClientPanelOrdersController,
  listClientPanelProductsController,
  listClientPanelProfessionalsController,
  updateClientPanelAppointmentRequestStatusController,
  updateClientPanelAppointmentServiceController,
  updateClientPanelBusinessBasicsController,
  updateClientPanelOrderStatusController,
  updateClientPanelProductController,
  updateClientPanelProfessionalController,
  uploadClientPanelImageController,
} from '../controllers/clientPanelController.js';
import { adminUploadRateLimiter } from '../middlewares/rateLimit.js';
import { requireSessionAuth } from '../middlewares/requireSessionAuth.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { AppError } from '../utils/appError.js';
import { isAcceptedImageFile } from '../utils/imageValidation.js';
import { clientPanelBusinessBasicsBodySchema } from '../validators/clientPanelValidators.js';
import {
  appointmentRequestStatusBodySchema,
  appointmentServiceBodySchema,
  orderStatusBodySchema,
  productBodySchema,
  professionalBodySchema,
  resourceIdParamsSchema,
} from '../validators/moduleValidators.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.maxUploadMb * 1024 * 1024,
  },
  fileFilter(_req, file, callback) {
    if (!isAcceptedImageFile(file)) {
      callback(new AppError('Apenas imagens JPG, PNG, WEBP ou GIF sao permitidas', 400, 'upload_invalid_type'));
      return;
    }

    callback(null, true);
  },
});

router.use(requireSessionAuth);

router.get('/business', getClientPanelBusinessController);
router.put('/business/basics', validateRequest({ body: clientPanelBusinessBasicsBodySchema }), updateClientPanelBusinessBasicsController);
router.get('/analytics', getClientPanelAnalyticsController);

router.post('/uploads/image', adminUploadRateLimiter, upload.single('file'), uploadClientPanelImageController);

router.get('/products', listClientPanelProductsController);
router.post('/products', validateRequest({ body: productBodySchema }), createClientPanelProductController);
router.put('/products/:id', validateRequest({ params: resourceIdParamsSchema, body: productBodySchema }), updateClientPanelProductController);
router.delete('/products/:id', validateRequest({ params: resourceIdParamsSchema }), deleteClientPanelProductController);

router.get('/professionals', listClientPanelProfessionalsController);
router.post('/professionals', validateRequest({ body: professionalBodySchema }), createClientPanelProfessionalController);
router.put('/professionals/:id', validateRequest({ params: resourceIdParamsSchema, body: professionalBodySchema }), updateClientPanelProfessionalController);
router.delete('/professionals/:id', validateRequest({ params: resourceIdParamsSchema }), deleteClientPanelProfessionalController);

router.get('/appointment-services', listClientPanelAppointmentServicesController);
router.post('/appointment-services', validateRequest({ body: appointmentServiceBodySchema }), createClientPanelAppointmentServiceController);
router.put('/appointment-services/:id', validateRequest({ params: resourceIdParamsSchema, body: appointmentServiceBodySchema }), updateClientPanelAppointmentServiceController);
router.delete('/appointment-services/:id', validateRequest({ params: resourceIdParamsSchema }), deleteClientPanelAppointmentServiceController);

router.get('/orders', listClientPanelOrdersController);
router.patch('/orders/:id/status', validateRequest({ params: resourceIdParamsSchema, body: orderStatusBodySchema }), updateClientPanelOrderStatusController);

router.get('/appointment-requests', listClientPanelAppointmentRequestsController);
router.patch('/appointment-requests/:id/status', validateRequest({ params: resourceIdParamsSchema, body: appointmentRequestStatusBodySchema }), updateClientPanelAppointmentRequestStatusController);

export default router;
