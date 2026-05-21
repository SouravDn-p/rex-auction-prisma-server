import { type TokenPayload } from '../app/common/utils/jwt.util.ts';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}
