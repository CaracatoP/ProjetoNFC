import { Router } from 'express';
import {
  blockAdminClientController,
  createAdminClientController,
  getAdminClientController,
  listAdminClientsController,
  resetAdminClientPasswordController,
  unblockAdminClientController,
  updateAdminClientAccessLevelController,
  updateAdminClientBillingStatusController,
  updateAdminClientController,
  updateAdminClientPlanController,
} from '../controllers/adminClientController.js';
import { requireAdminAuth } from '../middlewares/requireAdminAuth.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import {
  adminClientParamsSchema,
  adminClientsQuerySchema,
  createAdminClientBodySchema,
  resetAdminClientPasswordBodySchema,
  updateAdminClientAccessLevelBodySchema,
  updateAdminClientBillingStatusBodySchema,
  updateAdminClientBodySchema,
  updateAdminClientPlanBodySchema,
} from '../validators/adminClientValidators.js';

const router = Router();

router.use(requireAdminAuth);

router.get('/', validateRequest({ query: adminClientsQuerySchema }), listAdminClientsController);
router.post('/', validateRequest({ body: createAdminClientBodySchema }), createAdminClientController);
router.get('/:clientId', validateRequest({ params: adminClientParamsSchema }), getAdminClientController);
router.put(
  '/:clientId',
  validateRequest({ params: adminClientParamsSchema, body: updateAdminClientBodySchema }),
  updateAdminClientController,
);
router.patch(
  '/:clientId/access-level',
  validateRequest({ params: adminClientParamsSchema, body: updateAdminClientAccessLevelBodySchema }),
  updateAdminClientAccessLevelController,
);
router.patch(
  '/:clientId/reset-password',
  validateRequest({ params: adminClientParamsSchema, body: resetAdminClientPasswordBodySchema }),
  resetAdminClientPasswordController,
);
router.patch('/:clientId/block', validateRequest({ params: adminClientParamsSchema }), blockAdminClientController);
router.patch('/:clientId/unblock', validateRequest({ params: adminClientParamsSchema }), unblockAdminClientController);
router.patch(
  '/:clientId/plan',
  validateRequest({ params: adminClientParamsSchema, body: updateAdminClientPlanBodySchema }),
  updateAdminClientPlanController,
);
router.patch(
  '/:clientId/billing-status',
  validateRequest({ params: adminClientParamsSchema, body: updateAdminClientBillingStatusBodySchema }),
  updateAdminClientBillingStatusController,
);

export default router;
