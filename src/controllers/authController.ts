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
    const { businessName, name, email, password } = req.body;

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
    const user = await prisma.user.findUnique({ where: { email } });

    if (user && (await bcrypt.compare(password, user.password))) {
      res.json({
        _id: user.id,
        name: user.name,
        email: user.email,
        businessId: user.businessId,
        token: generateToken(user.id, user.businessId),
      });
    } else {
      res.status(401).json({ message: 'Credenciales inválidas' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor', error });
  }
};
