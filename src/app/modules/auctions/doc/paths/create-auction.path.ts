export const createAuctionPath = {
  post: {
    summary: "Create auction",
    description: "Seller creates a new auction (status: pending, awaiting admin approval).",
    tags: ["Auctions"],
    security: [{ cookieAuth: [] }],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: [
              "title",
              "description",
              "itemCondition",
              "itemYear",
              "itemReference",
              "itemValuation",
              "history",
              "images",
              "startingPrice",
              "startTime",
              "endTime",
            ],
            properties: {
              title: { type: "string", example: "Vintage Rolex Submariner" },
              description: { type: "string", example: "A well-preserved vintage timepiece." },
              itemCondition: { type: "string", example: "Excellent" },
              itemYear: { type: "integer", example: 1985 },
              itemReference: { type: "string", example: "REF-16800" },
              itemValuation: { type: "number", example: 15000 },
              history: { type: "string", example: "Single owner, full service history." },
              images: {
                type: "array",
                items: { type: "string", format: "uri" },
                example: ["https://example.com/img1.jpg"],
              },
              category: { type: "string", example: "Watches" },
              startingPrice: { type: "number", example: 5000 },
              startTime: { type: "string", format: "date-time" },
              endTime: { type: "string", format: "date-time" },
              notes: { type: "string" },
            },
          },
        },
      },
    },
    responses: {
      201: { description: "Auction created successfully" },
      400: { description: "Validation error" },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden — seller role required" },
    },
  },
};
