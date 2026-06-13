/// <reference types="express" />

declare global {
  namespace Express {
    interface User {
      userId: number;
      email: string;
      role: string;
    }

    interface Request {
      user?: User;
    }
  }
}

export {};
