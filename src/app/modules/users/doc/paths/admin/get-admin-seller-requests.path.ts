export const getAdminSellerRequestsPath = {
    get: {
      summary: "ADMIN: Fetch seller requests",
      description: "Get list of all submitted seller requests. Filter by status if requested.",
      tags: ["Admin (Users)"],
      security: [{ cookieAuth: [] }],
      parameters: [
        { name: "page", in: "query", schema: { type: "integer", default: 1 } },
        { name: "limit", in: "query", schema: { type: "integer", default: 20 } },
        { name: "status", in: "query", schema: { type: "string", enum: ["pending", "approved", "rejected"] }, description: "Filter request status" }
      ],
      responses: {
        200: {
          description: "Seller requests retrieved successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  data: {
                    type: "object",
                    properties: {
                      requests: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { type: "integer", example: 3 },
                            userId: { type: "integer" },
                            status: { type: "string", example: "pending" },
                            businessName: { type: "string" },
                            user: {
                              type: "object",
                              properties: {
                                id: { type: "integer" },
                                name: { type: "string" },
                                email: { type: "string" }
                              }
                            }
                          }
                        }
                      },
                      total: { type: "integer" }
                    }
                  }
                }
              }
            }
          }
        },
        401: { description: "Unauthorized" },
        403: { description: "Forbidden - Admin access required" }
      }
    }
  }