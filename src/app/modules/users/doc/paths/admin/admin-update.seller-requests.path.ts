export const adminUpdateSellerRequestsPath = {
    patch: {
      summary: "ADMIN: Review seller request",
      description: "Approve or reject a pending request to become a seller. Approving automatically updates the user's role to SELLER.",
      tags: ["Admin (Users)"],
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "requestId", in: "path", required: true, schema: { type: "integer" }, description: "The seller request ID" }
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["status"],
              properties: {
                status: { type: "string", enum: ["approved", "rejected"], example: "approved" }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: "Seller request reviewed successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: { type: "string", example: "Seller request successfully approved" },
                  data: {
                    type: "object",
                    properties: {
                      request: {
                        type: "object",
                        properties: {
                          id: { type: "integer", example: 3 },
                          status: { type: "string", example: "approved" },
                          businessName: { type: "string" },
                          reviewedBy: { type: "integer", example: 1 },
                          reviewedAt: { type: "string", format: "date-time" }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        400: { description: "Seller request already reviewed" },
        401: { description: "Unauthorized" },
        403: { description: "Forbidden - Admin access required" },
        404: { description: "Seller request not found" }
      }
    }
  }