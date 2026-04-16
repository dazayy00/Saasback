import { Router } from 'express';
import { getProducts, createProduct, updateProduct, deleteProduct } from '../controllers/productController';
import { protect } from '../middlewares/authMiddleware';

const router = Router();

router.route('/')
  .get(protect, getProducts)
  .post(protect, createProduct);

router.route('/:id')
  .put(protect, updateProduct)
  .delete(protect, deleteProduct);

export default router;
