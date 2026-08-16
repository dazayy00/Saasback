import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../config/db';

// GET /api/settings — Return current user + business info
export const getSettings = async (req: Request, res: Response) => {
  try {
    const { id, businessId } = (req as any).user;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        business: {
          select: {
            id: true,
            name: true,
            createdAt: true,
          }
        }
      }
    });

    if (!user) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }

    res.json(user);
  } catch (error) {
    console.error('Settings GET error:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

// PUT /api/settings — Update user name, phone, and optionally business name + password
export const updateSettings = async (req: Request, res: Response) => {
  try {
    const { id, businessId } = (req as any).user;
    const { name, phone, businessName, currentPassword, newPassword } = req.body;

    // Validate and update password if requested
    if (newPassword) {
      if (!currentPassword) {
        res.status(400).json({ message: 'Debes proporcionar tu contraseña actual para cambiarla' });
        return;
      }
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) { res.status(404).json({ message: 'Usuario no encontrado' }); return; }

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        res.status(401).json({ message: 'Contraseña actual incorrecta' });
        return;
      }
      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(newPassword, salt);
      await prisma.user.update({ where: { id }, data: { password: hashed } });
    }

    // Update user name and phone
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(phone ? { phone } : {}),
      },
      select: { id: true, name: true, email: true, phone: true, createdAt: true }
    });

    let updatedBusiness = undefined;
    if (businessName) {
      updatedBusiness = await prisma.business.update({
        where: { id: businessId },
        data: { name: businessName }
      });
    }

    res.json({
      message: 'Datos actualizados correctamente',
      user: {
        ...updatedUser,
        businessName: updatedBusiness ? updatedBusiness.name : businessName
      }
    });
  } catch (error) {
    console.error('Settings PUT error:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};
