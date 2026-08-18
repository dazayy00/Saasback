import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';
import { sendResetCodeEmail } from '../utils/mailer';

const generateToken = (id: string, businessId: string, name?: string) => {
  return jwt.sign({ id, businessId, name }, process.env.JWT_SECRET || 'secret', {
    expiresIn: '30d',
  });
};

export const registerBusiness = async (req: Request, res: Response) => {
  try {
    const { businessName, name, email, password, phone } = req.body;

    const userExists = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (userExists) {
      res.status(400).json({ message: 'User already exists' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Creates Business and User in a transaction implicitly
    const business = await prisma.business.create({
      data: {
        name: businessName,
        users: {
          create: {
            name,
            email: email.toLowerCase().trim(),
            phone,
            password: hashedPassword,
          },
        },
      },
      include: {
        users: true,
      },
    });

    const user = business.users[0];
    res.status(201).json({
      _id: user.id,
      name: user.name,
      email: user.email,
      businessId: user.businessId,
      businessName: business.name,
      token: generateToken(user.id, user.businessId, user.name),
    });
  } catch (error) {
    console.error("Auth Register Error:", error);
    res.status(500).json({ message: 'Error en el servidor', error: String(error) });
  }
};

export const loginUser = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { business: true },
    });

    if (user && (await bcrypt.compare(password, user.password))) {
      res.json({
        _id: user.id,
        name: user.name,
        email: user.email,
        businessId: user.businessId,
        businessName: user.business.name,
        token: generateToken(user.id, user.businessId, user.name),
      });
    } else {
      res.status(401).json({ message: 'Credenciales inválidas' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email || !email.trim()) {
      res.status(400).json({ message: 'El correo electrónico es requerido.' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });

    if (!user) {
      // Prevención de enumeración de usuarios
      res.status(200).json({ message: 'Si el correo está registrado, se ha enviado un código de recuperación.' });
      return;
    }

    // Generar código numérico de 6 dígitos
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: resetCode,
        resetPasswordExpires
      }
    });

    // Enviar código por correo electrónico
    await sendResetCodeEmail(user.email, resetCode, user.name);

    res.status(200).json({
      message: 'Si el correo está registrado, se ha enviado un código de recuperación.',
      email: cleanEmail
    });
  } catch (error) {
    console.error('Forgot Pass Error', error);
    res.status(500).json({ message: 'Hubo un error al procesar la solicitud de recuperación.' });
  }
};

export const verifyResetCode = async (req: Request, res: Response) => {
  try {
    const { email, token } = req.body;

    if (!email || !token) {
      res.status(400).json({ message: 'Correo y código PIN son requeridos' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await prisma.user.findFirst({
      where: {
        email: cleanEmail,
        resetPasswordToken: token.trim(),
        resetPasswordExpires: { gt: new Date() }
      }
    });

    if (!user) {
      res.status(400).json({ message: 'Código PIN inválido o expirado' });
      return;
    }

    res.status(200).json({ message: 'Código verificado con éxito', valid: true });
  } catch (error) {
    console.error('Verify Reset Code Error', error);
    res.status(500).json({ message: 'Error interno al verificar el código' });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, token, newPassword } = req.body;

    if (!email || !token || !newPassword) {
      res.status(400).json({ message: 'Correo, PIN y nueva contraseña son requeridos' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await prisma.user.findFirst({
      where: {
        email: cleanEmail,
        resetPasswordToken: token.trim(),
        resetPasswordExpires: { gt: new Date() }
      }
    });

    if (!user) {
      res.status(400).json({ message: 'Código PIN inválido o expirado' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null
      }
    });

    res.status(200).json({ message: 'Contraseña actualizada con éxito' });
  } catch (error) {
    console.error('Reset Pass Error', error);
    res.status(500).json({ message: 'Error interno reestableciendo contraseña' });
  }
};
