import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import prisma from '../config/db';

export const getProducts = async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user?.businessId;
    const products = await prisma.product.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(products);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: 'Server error', error: String(error) });
  }
};

export const createProduct = async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user?.businessId;
    const { name, description, buyPrice, sellPrice, stock, minStock } = req.body;
    
    if (!name || sellPrice === undefined) {
      res.status(400).json({ message: 'Name and sellPrice are required' });
      return;
    }

    const product = await prisma.product.create({
      data: {
        name,
        description,
        buyPrice: Number(buyPrice || 0),
        sellPrice: Number(sellPrice),
        stock: Number(stock || 0),
        minStock: Number(minStock || 5),
        businessId: businessId!
      }
    });
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateProduct = async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user?.businessId;
    const { id } = req.params;

    // Check if belongs to business
    const existing = await prisma.product.findFirst({ where: { id, businessId } });
    if (!existing) {
       res.status(404).json({ message: 'Product not found' });
       return;
    }

    const updated = await prisma.product.update({
      where: { id },
      data: req.body
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteProduct = async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user?.businessId;
    const { id } = req.params;

    const existing = await prisma.product.findFirst({ where: { id, businessId } });
    if (!existing) {
       res.status(404).json({ message: 'Product not found' });
       return;
    }

    await prisma.product.delete({ where: { id } });
    res.json({ message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};
