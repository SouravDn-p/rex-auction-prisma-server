export const paymentInvoicePath = {
  get: {
    summary: "Get payment invoice HTML",
    description: "Returns invoice HTML for a completed payment.",
    tags: ["Payments"],
    security: [{ cookieAuth: [] }],
    parameters: [
      { name: "invoiceNumber", in: "path", required: true, schema: { type: "string", example: "REX-INV-202606-000001" } },
    ],
    responses: {
      200: { description: "Invoice HTML", content: { "text/html": { schema: { type: "string" } } } },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden" },
      404: { description: "Invoice not found" },
    },
  },
};
