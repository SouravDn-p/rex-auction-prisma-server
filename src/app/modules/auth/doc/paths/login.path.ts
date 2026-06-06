export const loginPath = {
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
  }