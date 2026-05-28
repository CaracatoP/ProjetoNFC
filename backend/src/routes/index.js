import { Router } from 'express';
import adminAuthRoutes from './adminAuthRoutes.js';
import adminBusinessRoutes from './adminBusinessRoutes.js';
import adminClientRoutes from './adminClientRoutes.js';
import adminDashboardRoutes from './adminDashboardRoutes.js';
import adminModuleRoutes from './adminModuleRoutes.js';
import adminUploadRoutes from './adminUploadRoutes.js';
import authRoutes from './authRoutes.js';
import clientPanelRoutes from './clientPanelRoutes.js';
import healthRoutes from './healthRoutes.js';
import publicRoutes from './publicRoutes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/panel', clientPanelRoutes);
router.use('/admin/auth', adminAuthRoutes);
router.use('/admin/dashboard', adminDashboardRoutes);
router.use('/admin/clients', adminClientRoutes);
router.use('/admin', adminModuleRoutes);
router.use('/admin/businesses', adminBusinessRoutes);
router.use('/admin/uploads', adminUploadRoutes);
router.use('/public', publicRoutes);

export default router;
