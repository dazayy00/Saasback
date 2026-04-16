import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface AuthPayload {
  id: string;
  businessId: string;
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
}

export const protect = (req: AuthRequest, res: Response, next: NextFunction): void => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as AuthPayload;
      req.user = decoded;
      return next();
    } catch (error) {
      res.status(401).json({ message: 'No autorizado, token falló' });
      return;
    }
  }

  if (!token) {
    res.status(401).json({ message: 'No autorizado, no hay token' });
    return;
  }
};
