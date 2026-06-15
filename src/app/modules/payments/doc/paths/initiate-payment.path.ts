export const initiatePaymentPath = {
  get: {
    summary: "Initiate auction payment",
    description: "Winner initiates SSLCommerz payment for a won auction. Redirects browser to the payment gateway.",
    tags: ["Payments"],
    security: [{ cookieAuth: [] }],
    parameters: [
      { name: "auctionId", in: "path", required: true, schema: { type: "integer", example: 1 } },
    ],
    responses: {
      302: { description: "Redirect to SSLCommerz gateway" },
      400: { description: "Auction not ended or invalid request" },
      401: { description: "Unauthorized" },
      403: { description: "Not the auction winner" },
      409: { description: "Already paid" },
    },
  },
};
