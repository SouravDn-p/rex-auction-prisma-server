export const verifyEmailPath = {
  post: {
    summary: "Verify email with OTP",
    description:
      "Verify a newly registered account using the 6-digit OTP sent to email. Sets secure HTTP-only auth cookies. Tokens are not returned in the JSON body.",
    tags: ["Auth"],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["email", "otp"],
            properties: {
              email: { type: "string", format: "email", example: "john.doe@example.com" },
              otp: { type: "string", example: "123456", description: "6-digit verification code" },
            },
          },
        },
      },
    },
    responses: {
      200: {
        description: "Email verified successfully",
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
                message: { type: "string", example: "Email verified successfully" },
                data: {
                  type: "object",
                  properties: {
                    user: { type: "object" },
                  },
                },
              },
            },
          },
        },
      },
      400: { description: "Invalid or expired OTP" },
      409: { description: "Email already verified" },
    },
  },
};
