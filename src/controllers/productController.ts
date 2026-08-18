import { Response } from 'express';
import { AuthRequest } from '../middlewares/authMiddleware';
import prisma from '../config/db';
import crypto from 'crypto';

// Helper seguro para insertar en StockEntry sin depender de que prisma generate haya corrido
const insertStockEntry = async (data: {
  productId: string;
  quantity: number;
  previousStock: number;
  newStock: number;
  type: string;
  notes?: string;
  userName?: string;
  businessId: string;
}) => {
  try {
    if ((prisma as any).stockEntry) {
      return await (prisma as any).stockEntry.create({ data });
    }
  } catch (e) {
    // Si falla el delegate de prisma, continuar con el fallback SQL
  }

  // Fallback seguro con SQL directo
  const id = crypto.randomUUID();
  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "StockEntry" ("id", "productId", "quantity", "previousStock", "newStock", "type", "notes", "userName", "businessId", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP);`,
      id,
      data.productId,
      data.quantity,
      data.previousStock,
      data.newStock,
      data.type,
      data.notes || null,
      data.userName || null,
      data.businessId
    );
  } catch (err) {
    console.error('Error insertando StockEntry SQL fallback:', err);
  }
};

// Helper seguro para consultar StockEntry con join de Product
const fetchStockEntries = async (businessId: string) => {
  try {
    if ((prisma as any).stockEntry) {
      return await (prisma as any).stockEntry.findMany({
        where: { businessId },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              barcode: true,
              buyPrice: true,
              sellPrice: true,
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 200
      });
    }
  } catch (e) {
    // Si falla el delegate de prisma, continuar con el fallback SQL
  }

  // Fallback seguro con SQL directo
  try {
    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        se."id",
        se."productId",
        se."quantity",
        se."previousStock",
        se."newStock",
        se."type",
        se."notes",
        se."userName",
        se."businessId",
        se."createdAt",
        json_build_object(
          'id', p."id",
          'name', p."name",
          'barcode', p."barcode",
          'buyPrice', p."buyPrice",
          'sellPrice', p."sellPrice"
        ) as "product"
      FROM "StockEntry" se
      LEFT JOIN "Product" p ON se."productId" = p."id"
      WHERE se."businessId" = $1
      ORDER BY se."createdAt" DESC
      LIMIT 200;
    `, businessId);

    return rows;
  } catch (err) {
    console.error('Error consultando StockEntry SQL fallback:', err);
    return [];
  }
};

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

export const getStockEntries = async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user?.businessId;
    if (!businessId) {
      res.status(401).json({ message: 'No autorizado' });
      return;
    }
    const entries = await fetchStockEntries(businessId);
    res.json(entries);
  } catch (error) {
    console.error("Error fetching stock entries:", error);
    res.status(500).json({ message: 'Error al obtener historial de entradas', error: String(error) });
  }
};

export const createProduct = async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user?.businessId;
    const { name, description, barcode, buyPrice, sellPrice, stock, minStock, notes } = req.body;
    
    if (!name || sellPrice === undefined) {
      res.status(400).json({ message: 'Name and sellPrice are required' });
      return;
    }

    const initialStock = Math.max(0, Number(stock || 0));

    const product = await prisma.product.create({
      data: {
        name,
        description,
        barcode: barcode || null,
        buyPrice: Number(buyPrice || 0),
        sellPrice: Number(sellPrice),
        stock: initialStock,
        minStock: Number(minStock || 5),
        businessId: businessId!
      }
    });

    // Registrar en el historial de entradas si tiene stock inicial
    if (initialStock > 0) {
      await insertStockEntry({
        productId: product.id,
        quantity: initialStock,
        previousStock: 0,
        newStock: initialStock,
        type: 'INITIAL',
        notes: notes || 'Inventario inicial al registrar producto',
        userName: req.user?.name || 'Administrador',
        businessId: businessId!
      });
    }

    res.status(201).json(product);
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ message: 'Ya existe un producto con este código de barras' });
      return;
    }
    console.error('Create Product Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateProduct = async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user?.businessId;
    const id = req.params.id as string;
    
    // Check if belongs to business
    const existing = await prisma.product.findFirst({ where: { id, businessId } });
    if (!existing) {
       res.status(404).json({ message: 'Producto no encontrado' });
       return;
    }

    const { name, description, barcode, buyPrice, sellPrice, stock, minStock, notes } = req.body;
    const newStockVal = stock !== undefined ? Math.max(0, Number(stock)) : existing.stock;
    
    const updated = await prisma.product.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(barcode !== undefined ? { barcode: barcode || null } : {}),
        ...(buyPrice !== undefined ? { buyPrice: Number(buyPrice) } : {}),
        ...(sellPrice !== undefined ? { sellPrice: Number(sellPrice) } : {}),
        stock: newStockVal,
        ...(minStock !== undefined ? { minStock: Math.max(0, Number(minStock)) } : {}),
      }
    });

    // Registrar en historial si hubo cambio en el stock
    if (stock !== undefined && newStockVal !== existing.stock) {
      const diff = newStockVal - existing.stock;
      await insertStockEntry({
        productId: existing.id,
        quantity: diff,
        previousStock: existing.stock,
        newStock: newStockVal,
        type: diff > 0 ? 'ENTRY' : 'ADJUSTMENT',
        notes: notes || (diff > 0 ? 'Ingreso por edición de producto' : 'Ajuste manual de existencias'),
        userName: req.user?.name || 'Administrador',
        businessId: businessId!
      });
    }

    res.json(updated);
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ message: 'El código de barras ya pertenece a otro producto' });
      return;
    }
    console.error('Update Product Error:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

export const adjustStock = async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user?.businessId;
    const id = req.params.id as string;
    const { amount, newStock, notes } = req.body;

    const existing = await prisma.product.findFirst({ where: { id, businessId } });
    if (!existing) {
      res.status(404).json({ message: 'Producto no encontrado' });
      return;
    }

    let finalStock: number;
    let diff: number;

    if (newStock !== undefined) {
      finalStock = Math.max(0, Number(newStock));
      diff = finalStock - existing.stock;
    } else if (amount !== undefined) {
      diff = Number(amount);
      finalStock = Math.max(0, existing.stock + diff);
    } else {
      res.status(400).json({ message: 'Se requiere amount o newStock' });
      return;
    }

    const updated = await prisma.product.update({
      where: { id },
      data: { stock: finalStock }
    });

    // Registrar en historial de entradas
    if (diff !== 0) {
      await insertStockEntry({
        productId: existing.id,
        quantity: diff,
        previousStock: existing.stock,
        newStock: finalStock,
        type: diff > 0 ? 'ENTRY' : 'ADJUSTMENT',
        notes: notes || (diff > 0 ? 'Reabastecimiento de mercancía' : 'Ajuste de inventario'),
        userName: req.user?.name || 'Administrador',
        businessId: businessId!
      });
    }

    res.json(updated);
  } catch (error) {
    console.error('Adjust Stock Error:', error);
    res.status(500).json({ message: 'Error al ajustar el stock' });
  }
};

export const deleteProduct = async (req: AuthRequest, res: Response) => {
  try {
    const businessId = req.user?.businessId;
    const id = req.params.id as string;

    const existing = await prisma.product.findFirst({ where: { id, businessId } });
    if (!existing) {
       res.status(404).json({ message: 'Producto no encontrado' });
       return;
    }

    await prisma.product.delete({ where: { id } });
    res.json({ message: 'Producto eliminado' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar producto' });
  }
};
