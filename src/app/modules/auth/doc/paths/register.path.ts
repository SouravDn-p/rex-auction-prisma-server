export const registerPath = {
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
  }