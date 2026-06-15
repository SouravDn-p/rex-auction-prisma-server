export const adminPaymentsPath = {
  get: {
    summary: "Admin — list all payments",
    description: "Paginated list of all payments with optional status filter.",
    tags: ["Payments"],
    security: [{ cookieAuth: [] }],
    parameters: [
      { name: "page", in: "query", schema: { type: "integer", example: 1 } },
      { name: "limit", in: "query", schema: { type: "integer", example: 20 } },
      {
        name: "status",
        in: "query",
        schema: {
          type: "string",
          enum: ["PENDING", "PROCESSING", "PAID", "FAILED", "CANCELLED", "REFUNDED"],
        },
      },
    ],
    responses: {
      200: { description: "Payments retrieved" },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden — admin only" },
    },
  },
};
