export const updateAuctionPath = {
  patch: {
    summary: "Update auction",
    description: "Seller updates an auction while it is pending or upcoming.",
    tags: ["Auctions"],
    security: [{ cookieAuth: [] }],
    parameters: [
      { name: "id", in: "path", required: true, schema: { type: "integer", example: 1 } },
    ],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            minProperties: 1,
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              itemCondition: { type: "string" },
              itemYear: { type: "integer" },
              itemReference: { type: "string" },
              itemValuation: { type: "number" },
              history: { type: "string" },
              images: { type: "array", items: { type: "string", format: "uri" } },
              category: { type: "string" },
              startingPrice: { type: "number" },
              startTime: { type: "string", format: "date-time" },
              endTime: { type: "string", format: "date-time" },
              notes: { type: "string" },
            },
          },
        },
      },
    },
    responses: {
      200: { description: "Auction updated successfully" },
      400: { description: "Validation error or auction not editable" },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden" },
      404: { description: "Auction not found" },
    },
  },
};
