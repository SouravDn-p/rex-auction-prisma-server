export const loginPath = {
  post: {
    summary: "Login a user",
    description:
      "Authenticate user credentials. Sets accessToken and refreshToken in secure HTTP-only cookies. Tokens are not returned in the JSON body.",
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
                example: "john.doe@example.com",
              },
              password: {
                type: "string",
                format: "password",
                description: "User password",
                example: "P@ssword123!",
              },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: "Logged in successfully",
        headers: {
          "Set-Cookie": {
            schema: { type: "string" },
            description: "Sets accessToken and refreshToken in secure HTTP-only cookies",
          },
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
                        id: { type: "integer", example: 1 },
                        name: { type: "string", example: "John Doe" },
                        email: { type: "string", example: "john.doe@example.com" },
                        role: { type: "string", example: "USER" },
                        isActive: { type: "boolean", example: true },
                        createdAt: { type: "string", format: "date-time" },
                        updatedAt: { type: "string", format: "date-time" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      400: { description: "Validation error" },
      401: { description: "Invalid credentials" },
      403: { description: "Email not verified — a new OTP has been sent" },
    },
  },
};
