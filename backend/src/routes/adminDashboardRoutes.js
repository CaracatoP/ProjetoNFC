import { Router } from 'express';
import {
  getAdminDashboardOverviewController,
  resetAdminDashboardAnalyticsController,
} from '../controllers/adminDashboardController.js';
import { requireAdminAuth } from '../middlewares/requireAdminAuth.js';

const router = Router();

router.use(requireAdminAuth);
router.get('/overview', getAdminDashboardOverviewController);
router.post('/analytics/reset', resetAdminDashboardAnalyticsController);

export default router;
