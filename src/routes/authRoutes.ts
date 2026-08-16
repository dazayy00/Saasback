import { Router } from 'express';
import { registerBusiness, loginUser, forgotPassword, verifyResetCode, resetPassword } from '../controllers/authController';

const router = Router();

router.post('/register', registerBusiness);
router.post('/login', loginUser);
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-code', verifyResetCode);
router.post('/reset-password', resetPassword);

export default router;
