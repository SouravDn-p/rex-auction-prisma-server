export const resendOtpPath = {
  post: {
    summary: "Resend verification OTP",
    description: "Resend the email verification code for an unverified account.",
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
      200: { description: "OTP sent (or silently ignored if email not found)" },
      409: { description: "Email already verified" },
      429: { description: "Rate limited — wait before requesting another code" },
    },
  },
};
