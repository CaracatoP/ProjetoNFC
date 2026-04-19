import { Router } from 'express';
import {
  getAdminSessionController,
  loginAdminController,
  logoutAdminController,
} from '../controllers/adminAuthController.js';
import { adminLoginRateLimiter } from '../middlewares/rateLimit.js';
import { requireAdminAuth } from '../middlewares/requireAdminAuth.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { adminLoginBodySchema } from '../validators/adminAuthValidators.js';

const router = Router();

router.post('/login', adminLoginRateLimiter, validateRequest({ body: adminLoginBodySchema }), loginAdminController);
router.get('/session', requireAdminAuth, getAdminSessionController);
router.post('/logout', requireAdminAuth, logoutAdminController);

export default router;
