export const createSellerRequestPath = {
    post: {
      summary: "Apply for seller status",
      description: "Submit request to become an authorized seller on the platform, providing business parameters.",
      tags: ["Users"],
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["businessName", "contactPhone", "address", "taxId"],
              properties: {
                businessName: { type: "string", example: "John's Vintage Antiques LLC" },
                contactPhone: { type: "string", example: "+1-555-0199" },
                address: { type: "string", example: "123 Main St, Seattle, WA 98101" },
                taxId: { type: "string", example: "XX-XXXXXXX" },
                additionalNotes: { type: "string", example: "We have 10 years of physical trade experience." }
              }
            }
          }
        }
      },
      responses: {
        201: {
          description: "Seller request submitted successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: { type: "string", example: "Seller request submitted successfully" },
                  data: {
                    type: "object",
                    properties: {
                      request: {
                        type: "object",
                        properties: {
                          id: { type: "integer", example: 3 },
                          userId: { type: "integer", example: 42 },
                          status: { type: "string", example: "pending" },
                          businessName: { type: "string", example: "John's Vintage Antiques LLC" },
                          contactPhone: { type: "string" },
                          address: { type: "string" },
                          taxId: { type: "string" },
                          createdAt: { type: "string", format: "date-time" }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        400: { description: "Pending request already exists or user is already seller/admin" },
        401: { description: "Unauthorized" }
      }
    }
  }