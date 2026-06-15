export const myPaymentsPath = {
  get: {
    summary: "Get my payment history",
    description: "Buyer retrieves their payment history.",
    tags: ["Payments"],
    security: [{ cookieAuth: [] }],
    parameters: [
      { name: "page", in: "query", schema: { type: "integer", example: 1 } },
      { name: "limit", in: "query", schema: { type: "integer", example: 10 } },
    ],
    responses: {
      200: { description: "Payment history retrieved" },
      401: { description: "Unauthorized" },
    },
  },
};
