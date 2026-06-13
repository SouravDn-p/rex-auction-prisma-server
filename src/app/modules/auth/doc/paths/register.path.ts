export const registerPath = {
  post: {
    summary: "Register a new user",
    description:
      "Create a new user account. A verification OTP is sent to the provided email. Tokens are issued after email verification via POST /auth/verify-email.",
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
                example: "John Doe",
              },
              email: {
                type: "string",
                format: "email",
                description: "Unique email address",
                example: "john.doe@example.com",
              },
              password: {
                type: "string",
                format: "password",
                description:
                  "Strong password (min 8 characters, must contain uppercase, lowercase, number, and special character)",
                example: "P@ssword123!",
              },
            },
          },
        },
      },
    },
    responses: {
      201: {
        description: "Account created successfully — verify email with OTP",
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
                        id: { type: "integer", example: 1 },
                        name: { type: "string", example: "John Doe" },
                        email: { type: "string", example: "john.doe@example.com" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      400: {
        description: "Validation error",
      },
      409: {
        description: "Email already exists",
      },
    },
  },
};
