export const watchlistPath = {
    get: {
      summary: "Get user watchlist",
      description: "Fetch list of auctions the user has favorited/watched.",
      tags: ["Users"],
      security: [{ cookieAuth: [] }],
      responses: {
        200: {
          description: "Watchlist retrieved successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: { type: "string", example: "Watchlist items retrieved successfully" },
                  data: {
                    type: "object",
                    properties: {
                      watchlist: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { type: "integer", example: 1 },
                            userId: { type: "integer", example: 42 },
                            auctionId: { type: "integer", example: 7 },
                            addedAt: { type: "string", format: "date-time" },
                            auction: {
                              type: "object",
                              properties: {
                                id: { type: "integer", example: 7 },
                                title: { type: "string", example: "Vintage Leather Jacket" },
                                currentBid: { type: "number", example: 350.00 },
                                endTime: { type: "string", format: "date-time" },
                                status: { type: "string", example: "active" }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        401: { description: "Unauthorized" }
      }
    },
    post: {
      summary: "Add auction to watchlist (body)",
      description: "Add an auction by supplying `auctionId` in the body payload.",
      tags: ["Users"],
      security: [{ cookieAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["auctionId"],
              properties: {
                auctionId: { type: "integer", example: 7 }
              }
            }
          }
        }
      },
      responses: {
        201: { description: "Added to watchlist successfully" },
        400: { description: "Validation error" },
        401: { description: "Unauthorized" },
        404: { description: "Auction not found" }
      }
    }
  }