import { Router } from 'express';
import {
  createAppointmentServiceController,
  createProductController,
  createProfessionalController,
  deleteAppointmentServiceController,
  deleteProductController,
  deleteProfessionalController,
  listAppointmentRequestsController,
  listAppointmentServicesController,
  listOrdersController,
  listProductsController,
  listProfessionalsController,
  updateAppointmentRequestStatusController,
  updateAppointmentServiceController,
  updateOrderPaymentStatusController,
  updateOrderStatusController,
  updateProductController,
  updateProfessionalController,
} from '../controllers/moduleController.js';
import { requireAdminAuth } from '../middlewares/requireAdminAuth.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import {
  appointmentRequestStatusBodySchema,
  appointmentServiceBodySchema,
  businessIdParamsSchema,
  orderPaymentStatusBodySchema,
  orderStatusBodySchema,
  productBodySchema,
  professionalBodySchema,
  scopedResourceParamsSchema,
} from '../validators/moduleValidators.js';

const router = Router();

router.use(requireAdminAuth);
router.get('/businesses/:businessId/professionals', validateRequest({ params: businessIdParamsSchema }), listProfessionalsController);
router.post(
  '/businesses/:businessId/professionals',
  validateRequest({ params: businessIdParamsSchema, body: professionalBodySchema }),
  createProfessionalController,
);
router.put(
  '/businesses/:businessId/professionals/:id',
  validateRequest({ params: scopedResourceParamsSchema, body: professionalBodySchema }),
  updateProfessionalController,
);
router.delete(
  '/businesses/:businessId/professionals/:id',
  validateRequest({ params: scopedResourceParamsSchema }),
  deleteProfessionalController,
);

router.get(
  '/businesses/:businessId/appointment-services',
  validateRequest({ params: businessIdParamsSchema }),
  listAppointmentServicesController,
);
router.post(
  '/businesses/:businessId/appointment-services',
  validateRequest({ params: businessIdParamsSchema, body: appointmentServiceBodySchema }),
  createAppointmentServiceController,
);
router.put(
  '/businesses/:businessId/appointment-services/:id',
  validateRequest({ params: scopedResourceParamsSchema, body: appointmentServiceBodySchema }),
  updateAppointmentServiceController,
);
router.delete(
  '/businesses/:businessId/appointment-services/:id',
  validateRequest({ params: scopedResourceParamsSchema }),
  deleteAppointmentServiceController,
);

router.get('/businesses/:businessId/products', validateRequest({ params: businessIdParamsSchema }), listProductsController);
router.post(
  '/businesses/:businessId/products',
  validateRequest({ params: businessIdParamsSchema, body: productBodySchema }),
  createProductController,
);
router.put(
  '/businesses/:businessId/products/:id',
  validateRequest({ params: scopedResourceParamsSchema, body: productBodySchema }),
  updateProductController,
);
router.delete(
  '/businesses/:businessId/products/:id',
  validateRequest({ params: scopedResourceParamsSchema }),
  deleteProductController,
);

router.get(
  '/businesses/:businessId/appointment-requests',
  validateRequest({ params: businessIdParamsSchema }),
  listAppointmentRequestsController,
);
router.patch(
  '/businesses/:businessId/appointment-requests/:id/status',
  validateRequest({ params: scopedResourceParamsSchema, body: appointmentRequestStatusBodySchema }),
  updateAppointmentRequestStatusController,
);

router.get('/businesses/:businessId/orders', validateRequest({ params: businessIdParamsSchema }), listOrdersController);
router.patch(
  '/businesses/:businessId/orders/:id/status',
  validateRequest({ params: scopedResourceParamsSchema, body: orderStatusBodySchema }),
  updateOrderStatusController,
);
router.patch(
  '/businesses/:businessId/orders/:id/payment-status',
  validateRequest({ params: scopedResourceParamsSchema, body: orderPaymentStatusBodySchema }),
  updateOrderPaymentStatusController,
);

export default router;
