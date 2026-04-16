import { Router } from 'express';
import { registerBusiness, loginUser } from '../controllers/authController';

const router = Router();

router.post('/register', registerBusiness);
router.post('/login', loginUser);

export default router;
