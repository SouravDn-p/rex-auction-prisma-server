export const paymentStatusPath = {
  get: {
    summary: "Get payment status",
    description: "Poll payment status by transaction ID (for processing page).",
    tags: ["Payments"],
    security: [{ cookieAuth: [] }],
    parameters: [
      { name: "trxId", in: "path", required: true, schema: { type: "string", example: "REX-1718450000000-AB12CD34" } },
    ],
    responses: {
      200: { description: "Payment status retrieved" },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden" },
      404: { description: "Payment not found" },
    },
  },
};
