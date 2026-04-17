import { Router } from 'express';
import {
  createAdminBusinessController,
  deleteAdminBusinessController,
  getAdminBusinessController,
  listAdminBusinessesController,
  updateAdminBusinessController,
} from '../controllers/adminBusinessController.js';
import { requireAdminAuth } from '../middlewares/requireAdminAuth.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import {
  adminBusinessCreateBodySchema,
  adminBusinessEditorBodySchema,
  adminBusinessParamsSchema,
} from '../validators/adminBusinessValidators.js';

const router = Router();

router.use(requireAdminAuth);
router.get('/', listAdminBusinessesController);
router.get('/:businessId', validateRequest({ params: adminBusinessParamsSchema }), getAdminBusinessController);
router.post('/', validateRequest({ body: adminBusinessCreateBodySchema }), createAdminBusinessController);
router.put(
  '/:businessId',
  validateRequest({ params: adminBusinessParamsSchema, body: adminBusinessEditorBodySchema }),
  updateAdminBusinessController,
);
router.delete('/:businessId', validateRequest({ params: adminBusinessParamsSchema }), deleteAdminBusinessController);

export default router;
