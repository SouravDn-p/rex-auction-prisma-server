export const MESSAGES = {
    AUTH: {
      REGISTER_SUCCESS: 'Account created successfully',
      LOGIN_SUCCESS: 'Logged in successfully',
      LOGOUT_SUCCESS: 'Logged out successfully',
      TOKEN_REFRESHED: 'Token refreshed',
      INVALID_CREDENTIALS: 'Invalid email or password',
      EMAIL_EXISTS: 'An account with this email already exists',
      UNAUTHORIZED: 'You must be logged in to access this resource',
      FORBIDDEN: 'You do not have permission to access this resource',
      TOKEN_INVALID: 'Invalid or expired token',
    },
    USER: {
      FETCHED: 'User fetched successfully',
      UPDATED: 'User updated successfully',
      DELETED: 'User deleted successfully',
      NOT_FOUND: 'User not found',
    },
  } as const;