import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/db';

const generateToken = (id: string, businessId: string) => {
  return jwt.sign({ id, businessId }, process.env.JWT_SECRET || 'secret', {
    expiresIn: '30d',
  });
};

export const registerBusiness = async (req: Request, res: Response) => {
  try {
    const { businessName, name, email, password, phone } = req.body;

    const userExists = await prisma.user.findUnique({ where: { email } });
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
            email,
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
      token: generateToken(user.id, user.businessId),
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
      where: { email },
      include: { business: true },
    });

    if (user && (await bcrypt.compare(password, user.password))) {
      res.json({
        _id: user.id,
        name: user.name,
        email: user.email,
        businessId: user.businessId,
        businessName: user.business.name,
        token: generateToken(user.id, user.businessId),
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
    const { phone } = req.body;
    const user = await prisma.user.findFirst({ where: { phone } });

    if (!user) {
      // Return 200 even if it fails to prevent numbering enumeration
      res.status(200).json({ message: 'Si el número existe, se ha enviado un SMS con el código.' });
      return;
    }

    // Generate 6 digit numeric code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: resetCode,
        resetPasswordExpires
      }
    });

    if (!process.env.TWILIO_ACCOUNT_SID) {
      console.log('--- MOCK SMS ---');
      console.log('To:', user.phone);
      console.log('Tu código de recuperación es:', resetCode);
      console.log('------------------');
      res.status(200).json({ message: 'Si el número existe, se ha enviado un SMS con el código. (MOCK EN CONSOLA)' });
      return;
    }

    // Here goes twilio logic
    // const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    // await client.messages.create({ body: `Tu código de recuperación es: ${resetCode}`, from: process.env.TWILIO_PHONE, to: user.phone });

    res.status(200).json({ message: 'Si el número existe, se ha enviado un SMS con el código.' });
  } catch (error) {
    console.error('Forgot Pass Error', error);
    res.status(500).json({ message: 'Hubo un error al enviar el correo' });
  }
};

export const verifyResetCode = async (req: Request, res: Response) => {
  try {
    const { phone, token } = req.body;

    if (!phone || !token) {
      res.status(400).json({ message: 'Teléfono y código PIN son requeridos' });
      return;
    }

    const user = await prisma.user.findFirst({
      where: {
        phone,
        resetPasswordToken: token,
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
    const { phone, token, newPassword } = req.body;

    if (!phone || !token || !newPassword) {
      res.status(400).json({ message: 'Teléfono, PIN y nueva contraseña son requeridos' });
      return;
    }

    const user = await prisma.user.findFirst({
      where: {
        phone,
        resetPasswordToken: token,
        resetPasswordExpires: { gt: new Date() }
      }
    });

    if (!user) {
      res.status(400).json({ message: 'Token inválido o expirado' });
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
