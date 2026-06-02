import { Router } from 'express';
import {
  createAdminBusinessAsaasSubaccountController,
  getAdminBusinessFinanceSettingsController,
  getAdminFinanceSettingsController,
  updateAdminBusinessFinanceSettingsController,
  updateAdminFinanceSettingsController,
} from '../controllers/adminFinanceController.js';
import { requireAdminAuth } from '../middlewares/requireAdminAuth.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import {
  adminBusinessFinanceBodySchema,
  adminBusinessFinanceSubaccountBodySchema,
  adminFinanceBusinessParamsSchema,
  adminFinanceSettingsBodySchema,
} from '../validators/adminFinanceValidators.js';

const router = Router();

router.use(requireAdminAuth);
router.get('/settings', getAdminFinanceSettingsController);
router.patch('/settings', validateRequest({ body: adminFinanceSettingsBodySchema }), updateAdminFinanceSettingsController);
router.get(
  '/businesses/:businessId',
  validateRequest({ params: adminFinanceBusinessParamsSchema }),
  getAdminBusinessFinanceSettingsController,
);
router.patch(
  '/businesses/:businessId',
  validateRequest({ params: adminFinanceBusinessParamsSchema, body: adminBusinessFinanceBodySchema }),
  updateAdminBusinessFinanceSettingsController,
);
router.post(
  '/businesses/:businessId/asaas/subaccount',
  validateRequest({
    params: adminFinanceBusinessParamsSchema,
    body: adminBusinessFinanceSubaccountBodySchema,
  }),
  createAdminBusinessAsaasSubaccountController,
);

export default router;
