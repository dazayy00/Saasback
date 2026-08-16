import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import prisma from '../config/db';

export const getSales = async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user?.businessId;
    const sales = await prisma.sale.findMany({
      where: { businessId },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json(sales);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const createSale = async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user?.businessId;
    const { items } = req.body; // items: [{ productId, quantity, price }]

    if (!items || items.length === 0) {
      res.status(400).json({ message: 'Items are required' });
      return;
    }

    // Calcular el total
    const total = items.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0);

    // Iniciar transacción de BD para crear la venta y descontar inventario
    const sale = await prisma.$transaction(async (tx) => {
      // 1. Crear venta
      const newSale = await tx.sale.create({
        data: {
          total,
          businessId: businessId!,
          items: {
            create: items.map((i: any) => ({
              productId: i.productId,
              quantity: i.quantity,
              price: i.price,
            }))
          }
        },
        include: {
          items: {
            include: {
              product: true
            }
          }
        }
      });

      // 2. Descontar stock
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity
            }
          }
        });
      }

      return newSale;
    });

    res.status(201).json(sale);
  } catch (error) {
    res.status(500).json({ message: 'Server error during sale', error });
  }
};
