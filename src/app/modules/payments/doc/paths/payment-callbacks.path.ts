export const paymentCallbacksPath = {
  post: {
    summary: "SSLCommerz callback (internal)",
    description: "Public callback endpoint used by SSLCommerz. Not intended for direct client use.",
    tags: ["Payments"],
    responses: {
      200: { description: "Callback acknowledged" },
      302: { description: "Browser redirect (success/fail/cancel)" },
    },
  },
};
