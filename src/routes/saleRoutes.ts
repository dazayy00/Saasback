import { Router } from 'express';
import { getSales, createSale } from '../controllers/saleController';
import { protect } from '../middlewares/authMiddleware';

const router = Router();

router.route('/')
  .get(protect, getSales)
  .post(protect, createSale);

export default router;
