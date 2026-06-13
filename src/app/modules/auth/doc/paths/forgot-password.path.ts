export const forgotPasswordPath = {
  post: {
    summary: "Request password reset OTP",
    description:
      "Send a password reset OTP to the user's email. Always returns success to avoid revealing account existence.",
    tags: ["Auth"],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["email"],
            properties: {
              email: { type: "string", format: "email", example: "john.doe@example.com" },
            },
          },
        },
      },
    },
    responses: {
      200: { description: "If the account exists, a reset code has been sent" },
      400: { description: "Validation error" },
    },
  },
};
