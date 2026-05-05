import { Router, type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';

const TOKEN_EXPIRY = '30d';

function getSecret(): string | null {
  const password = process.env.AUTH_PASSWORD;
  if (!password) return null;
  return createHash('sha256').update(password).digest('hex');
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const secret = getSecret();
  if (!secret) return next();

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    jwt.verify(header.slice(7), secret);
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

export function loginHandler(req: Request, res: Response) {
  const password = process.env.AUTH_PASSWORD;
  if (!password) {
    return res.json({ token: 'no-auth-required' });
  }

  const { password: input } = req.body;
  if (input !== password) {
    return res.status(401).json({ error: '密码错误' });
  }

  const secret = getSecret()!;
  const token = jwt.sign({ iat: Math.floor(Date.now() / 1000) }, secret, { expiresIn: TOKEN_EXPIRY });
  res.json({ token });
}

export function checkHandler(req: Request, res: Response) {
  const secret = getSecret();
  if (!secret) return res.json({ ok: true });

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false });
  }

  try {
    jwt.verify(header.slice(7), secret);
    res.json({ ok: true });
  } catch {
    res.status(401).json({ ok: false });
  }
}

export function createAuthRouter(): Router {
  const router = Router();
  router.post('/login', loginHandler);
  router.get('/check', checkHandler);
  return router;
}
