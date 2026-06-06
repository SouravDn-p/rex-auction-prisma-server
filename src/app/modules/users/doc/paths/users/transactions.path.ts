export const transactionsPath = {
    get: {
      summary: "Get user transaction logs",
      description: "Fetch full financial transactions (deposits, withdrawals, bid locks, etc.) history.",
      tags: ["Users"],
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "Transactions retrieved successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: { type: "string", example: "User transactions retrieved successfully" },
                  data: {
                    type: "object",
                    properties: {
                      transactions: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { type: "integer", example: 50 },
                            userId: { type: "integer", example: 42 },
                            type: { type: "string", example: "deposit" },
                            amount: { type: "number", example: 2500.00 },
                            referenceType: { type: "string", example: "payment", nullable: true },
                            referenceId: { type: "integer", example: 101, nullable: true },
                            note: { type: "string", example: "Deposited via stripe", nullable: true },
                            createdAt: { type: "string", format: "date-time" }
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
    }
  }