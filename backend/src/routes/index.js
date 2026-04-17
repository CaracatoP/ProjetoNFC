import { Router } from 'express';
import adminAuthRoutes from './adminAuthRoutes.js';
import adminBusinessRoutes from './adminBusinessRoutes.js';
import adminDashboardRoutes from './adminDashboardRoutes.js';
import adminUploadRoutes from './adminUploadRoutes.js';
import healthRoutes from './healthRoutes.js';
import publicRoutes from './publicRoutes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/admin/auth', adminAuthRoutes);
router.use('/admin/dashboard', adminDashboardRoutes);
router.use('/admin/businesses', adminBusinessRoutes);
router.use('/admin/uploads', adminUploadRoutes);
router.use('/public', publicRoutes);

export default router;
