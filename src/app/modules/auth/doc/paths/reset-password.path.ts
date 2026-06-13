export const resetPasswordPath = {
  post: {
    summary: "Reset password with OTP",
    description:
      "Reset account password using the OTP from forgot-password. Revokes all active sessions on success.",
    tags: ["Auth"],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["email", "otp", "newPassword"],
            properties: {
              email: { type: "string", format: "email", example: "john.doe@example.com" },
              otp: { type: "string", example: "123456" },
              newPassword: {
                type: "string",
                format: "password",
                example: "NewP@ssword123!",
              },
            },
          },
        },
      },
    },
    responses: {
      200: { description: "Password reset successfully" },
      400: { description: "Invalid or expired OTP / validation error" },
    },
  },
};
