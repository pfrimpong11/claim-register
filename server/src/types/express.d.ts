declare namespace Express {
  interface Request {
    id: string;
    validatedQuery?: unknown;
    auth?: {
      sessionId: string;
      csrfTokenHash: string;
      user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        roles: string[];
        permissions: string[];
      };
    };
  }
}
