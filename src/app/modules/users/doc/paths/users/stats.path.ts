export const statsPath = {
    get: {
      summary: "Get user statistics",
      description: "Retrieve account balance, auctions won count, active bids, and total spent stats.",
      tags: ["Users"],
      security: [{ cookieAuth: [] }],
      responses: {
        200: {
          description: "Stats retrieved successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: { type: "string", example: "User statistics retrieved successfully" },
                  data: {
                    type: "object",
                    properties: {
                      stats: {
                        type: "object",
                        properties: {
                          id: { type: "integer", example: 10 },
                          userId: { type: "integer", example: 42 },
                          accountBalance: { type: "number", example: 5000.50 },
                          auctionsWon: { type: "integer", example: 3 },
                          activeBids: { type: "integer", example: 2 },
                          totalSpent: { type: "number", example: 12000.00 },
                          updatedAt: { type: "string", format: "date-time" }
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
    }
  }