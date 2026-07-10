import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env.ts';

const oAuth2Client = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export interface AuthenticatedUser {
  sub: string;
  email: string;
  name: string;
  picture: string;
}

declare global {
  namespace Express {
    interface Request {
      googleUser?: AuthenticatedUser;
    }
  }
}

/**
 * Middleware that verifies a Google ID token from the Authorization header
 * and attaches the decoded user info to req.googleUser.
 *
 * Expects header: Authorization: Bearer <google_id_token>
 */
export async function requireGoogleAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or malformed Authorization header' });
    return;
  }

  const idToken = authHeader.slice(7);

  try {
    const ticket = await oAuth2Client.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload) {
      res.status(401).json({ error: 'Invalid Google ID token' });
      return;
    }

    req.googleUser = {
      sub: payload.sub,
      email: payload.email || '',
      name: payload.name || '',
      picture: payload.picture || '',
    };

    next();
  } catch (err) {
    console.error('[auth] Google token verification failed:', err);
    res.status(401).json({ error: 'Invalid or expired Google ID token' });
  }
}
