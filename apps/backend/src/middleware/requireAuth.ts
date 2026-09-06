import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "../lib/errors.js";

declare global {
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}

const requireAuth = (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(
      new AppError("UNAUTHENTICATED", "Missing or malformed Authorization header"),
    );
  }
  try {
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: number;
      email: string;
    };
    req.userId = payload.id;
    next();
  } catch (err) {
    return next(new AppError("UNAUTHENTICATED", "Invalid or expired token"));
  }
};

export default requireAuth;
