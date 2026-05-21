export const authpaths = {
  "/auth/register": {
    post: {
      summary: "Register a new user",
      description: "Create a new user account and receive authentication tokens. Access and refresh tokens will also be sent as secure cookies.",
      tags: ["Auth"],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["name", "email", "password"],
              properties: {
                name: {
                  type: "string",
                  description: "Full name of the user (2 to 50 characters)",
                  example: "John Doe"
                },
                email: {
                  type: "string",
                  format: "email",
                  description: "Unique email address",
                  example: "john.doe@example.com"
                },
                password: {
                  type: "string",
                  format: "password",
                  description: "Strong password (min 8 characters, must contain uppercase, lowercase, number, and special character)",
                  example: "P@ssword123!"
                }
              }
            }
          }
        }
      },
      responses: {
        201: {
          description: "Account created successfully",
          headers: {
            "Set-Cookie": {
              schema: {
                type: "string",
                example: "accessToken=xxx; Path=/; HttpOnly; Secure; SameSite=Lax, refreshToken=yyy; Path=/; HttpOnly; Secure; SameSite=Lax"
              },
              description: "Sets accessToken and refreshToken in secure HTTP-only cookies"
            }
          },
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: { type: "string", example: "Account created successfully" },
                  data: {
                    type: "object",
                    properties: {
                      user: {
                        type: "object",
                        properties: {
                          id: { type: "string", example: "ckv1abcde0000xxxx" },
                          name: { type: "string", example: "John Doe" },
                          email: { type: "string", example: "john.doe@example.com" },
                          role: { type: "string", example: "user" },
                          isActive: { type: "boolean", example: true },
                          createdAt: { type: "string", format: "date-time", example: "2026-05-21T03:45:00.000Z" },
                          updatedAt: { type: "string", format: "date-time", example: "2026-05-21T03:45:00.000Z" }
                        }
                      },
                      accessToken: { type: "string", example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: "Validation error"
        },
        409: {
          description: "Email already exists"
        }
      }
    }
  },
  "/auth/login": {
    post: {
      summary: "Login a user",
      description: "Authenticate user credentials. Returns an access token and user object. Sets accessToken and refreshToken in secure HTTP-only cookies.",
      tags: ["Auth"],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["email", "password"],
              properties: {
                email: {
                  type: "string",
                  format: "email",
                  description: "Email address of the account",
                  example: "john.doe@example.com"
                },
                password: {
                  type: "string",
                  format: "password",
                  description: "User password",
                  example: "P@ssword123!"
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: "Logged in successfully",
          headers: {
            "Set-Cookie": {
              schema: {
                type: "string"
              },
              description: "Sets accessToken and refreshToken in secure HTTP-only cookies"
            }
          },
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: { type: "string", example: "Logged in successfully" },
                  data: {
                    type: "object",
                    properties: {
                      user: {
                        type: "object",
                        properties: {
                          id: { type: "string", example: "ckv1abcde0000xxxx" },
                          name: { type: "string", example: "John Doe" },
                          email: { type: "string", example: "john.doe@example.com" },
                          role: { type: "string", example: "user" },
                          isActive: { type: "boolean", example: true },
                          createdAt: { type: "string", format: "date-time" },
                          updatedAt: { type: "string", format: "date-time" }
                        }
                      },
                      accessToken: { type: "string", example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
                    }
                  }
                }
              }
            }
          }
        },
        400: {
          description: "Validation error"
        },
        401: {
          description: "Invalid credentials"
        }
      }
    }
  },
  "/auth/logout": {
    post: {
      summary: "Logout user",
      description: "Logs out the authenticated user by invalidating the refresh token in the database and clearing client-side cookies.",
      tags: ["Auth"],
      security: [
        {
          bearerAuth: []
        }
      ],
      responses: {
        200: {
          description: "Logged out successfully",
          headers: {
            "Set-Cookie": {
              schema: {
                type: "string"
              },
              description: "Clears accessToken and refreshToken cookies"
            }
          },
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: { type: "string", example: "Logged out successfully" }
                }
              }
            }
          }
        },
        401: {
          description: "Unauthorized"
        }
      }
    }
  },
  "/auth/refresh-token": {
    post: {
      summary: "Refresh access token",
      description: "Issues new accessToken and refreshToken. Accepts the refreshToken from either the secure HTTP-only cookies or the request body. Both cookies will be rotated.",
      tags: ["Auth"],
      requestBody: {
        required: false,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                refreshToken: {
                  type: "string",
                  description: "Optional if set in HTTP-only cookie, otherwise required",
                  example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: "Token refreshed successfully",
          headers: {
            "Set-Cookie": {
              schema: {
                type: "string"
              },
              description: "Rotates and sets new accessToken and refreshToken cookies"
            }
          },
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: { type: "string", example: "Token refreshed" },
                  data: {
                    type: "object",
                    properties: {
                      user: {
                        type: "object",
                        properties: {
                          id: { type: "string", example: "ckv1abcde0000xxxx" },
                          name: { type: "string", example: "John Doe" },
                          email: { type: "string", example: "john.doe@example.com" },
                          role: { type: "string", example: "user" },
                          isActive: { type: "boolean", example: true }
                        }
                      },
                      accessToken: { type: "string", example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
                    }
                  }
                }
              }
            }
          }
        },
        401: {
          description: "Invalid or expired refresh token"
        }
      }
    }
  },
  "/auth/me": {
    get: {
      summary: "Get current user profile",
      description: "Retrieve profile information of the currently authenticated user.",
      tags: ["Auth"],
      security: [
        {
          bearerAuth: []
        }
      ],
      responses: {
        200: {
          description: "User profile fetched successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: { type: "string", example: "User fetched successfully" },
                  data: {
                    type: "object",
                    properties: {
                      user: {
                        type: "object",
                        properties: {
                          id: { type: "string", example: "ckv1abcde0000xxxx" },
                          name: { type: "string", example: "John Doe" },
                          email: { type: "string", example: "john.doe@example.com" },
                          role: { type: "string", example: "user" },
                          isActive: { type: "boolean", example: true },
                          createdAt: { type: "string", format: "date-time" },
                          updatedAt: { type: "string", format: "date-time" }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        401: {
          description: "Unauthorized"
        }
      }
    }
  }
};