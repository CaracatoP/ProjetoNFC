import { Router } from 'express';
import {
  getSessionController,
  loginSessionController,
  logoutSessionController,
} from '../controllers/sessionAuthController.js';
import { requireSessionAuth } from '../middlewares/requireSessionAuth.js';
import { adminLoginRateLimiter } from '../middlewares/rateLimit.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { sessionLoginBodySchema } from '../validators/sessionAuthValidators.js';

const router = Router();

router.post('/login', adminLoginRateLimiter, validateRequest({ body: sessionLoginBodySchema }), loginSessionController);
router.get('/me', requireSessionAuth, getSessionController);
router.post('/logout', requireSessionAuth, logoutSessionController);

export default router;
