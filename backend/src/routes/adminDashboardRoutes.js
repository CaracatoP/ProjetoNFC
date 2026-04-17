import { Router } from 'express';
import { getAdminDashboardOverviewController } from '../controllers/adminDashboardController.js';
import { requireAdminAuth } from '../middlewares/requireAdminAuth.js';

const router = Router();

router.use(requireAdminAuth);
router.get('/overview', getAdminDashboardOverviewController);

export default router;
