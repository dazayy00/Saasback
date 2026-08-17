import { Router } from 'express';
import { getProducts, getStockEntries, createProduct, updateProduct, deleteProduct, adjustStock } from '../controllers/productController';
import { protect } from '../middlewares/authMiddleware';

const router = Router();

router.route('/')
  .get(protect, getProducts)
  .post(protect, createProduct);

router.get('/entries', protect, getStockEntries);

router.post('/:id/adjust-stock', protect, adjustStock);

router.route('/:id')
  .put(protect, updateProduct)
  .delete(protect, deleteProduct);

export default router;
