import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { asaasWebhookController } from '../controllers/asaasWebhookController.js';
import { mercadoPagoWebhookController } from '../controllers/mercadoPagoWebhookController.js';

const router = Router();

router.post('/asaas', asyncHandler(asaasWebhookController));
router.post('/mercado-pago', asyncHandler(mercadoPagoWebhookController));

export default router;
