import { Router } from 'express';
import { getSettings, updateSettings } from '../controllers/settingsController';
import { protect } from '../middlewares/authMiddleware';

const router = Router();

router.route('/')
  .get(protect, getSettings)
  .put(protect, updateSettings);

export default router;
