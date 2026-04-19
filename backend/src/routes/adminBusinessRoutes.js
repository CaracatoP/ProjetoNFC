import { Router } from 'express';
import { ADMIN_ROLES } from '../../../shared/constants/index.js';
import {
  createAdminBusinessController,
  deleteAdminBusinessController,
  getAdminBusinessController,
  listAdminBusinessesController,
  updateAdminBusinessController,
  updateAdminBusinessStatusController,
} from '../controllers/adminBusinessController.js';
import { requireAdminAuth } from '../middlewares/requireAdminAuth.js';
import { requireAdminRole } from '../middlewares/requireAdminRole.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import {
  adminBusinessCreateBodySchema,
  adminBusinessEditorBodySchema,
  adminBusinessParamsSchema,
  adminBusinessStatusBodySchema,
} from '../validators/adminBusinessValidators.js';

const router = Router();

router.use(requireAdminAuth);
router.get('/', listAdminBusinessesController);
router.patch(
  '/:businessId/status',
  requireAdminRole([ADMIN_ROLES.SUPERADMIN, ADMIN_ROLES.ADMIN]),
  validateRequest({ params: adminBusinessParamsSchema, body: adminBusinessStatusBodySchema }),
  updateAdminBusinessStatusController,
);
router.get('/:businessId', validateRequest({ params: adminBusinessParamsSchema }), getAdminBusinessController);
router.post('/', validateRequest({ body: adminBusinessCreateBodySchema }), createAdminBusinessController);
router.put(
  '/:businessId',
  validateRequest({ params: adminBusinessParamsSchema, body: adminBusinessEditorBodySchema }),
  updateAdminBusinessController,
);
router.delete(
  '/:businessId',
  requireAdminRole([ADMIN_ROLES.SUPERADMIN]),
  validateRequest({ params: adminBusinessParamsSchema }),
  deleteAdminBusinessController,
);

export default router;
