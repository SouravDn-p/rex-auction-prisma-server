export const getMePath = {
    get: {
      summary: "Get current user profile",
      description: "Retrieve complete profile information for the authenticated user.",
      tags: ["Users"],
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: "Profile retrieved successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: { type: "string", example: "User fetched successfully" },
                  data: {
                    type: "object",
                    properties: {
                      user: {
                        type: "object",
                        properties: {
                          id: { type: "integer", example: 42 },
                          name: { type: "string", example: "John Doe" },
                          email: { type: "string", format: "email", example: "john.doe@example.com" },
                          photo: { type: "string", format: "uri", example: "https://example.com/photo.jpg", nullable: true },
                          cover: { type: "string", format: "uri", example: "https://example.com/cover.jpg", nullable: true },
                          role: { type: "string", example: "USER" },
                          location: { type: "string", example: "New York, USA", nullable: true },
                          isActive: { type: "boolean", example: true },
                          provider: { type: "string", example: "local" },
                          createdAt: { type: "string", format: "date-time" },
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
    },
    patch: {
      summary: "Update user profile",
      description: "Update name, profile image, cover photo, or location of the authenticated user.",
      tags: ["Users"],
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                name: { type: "string", example: "Johnathan Doe", minLength: 2, maxLength: 50 },
                photo: { type: "string", format: "uri", example: "https://example.com/new-photo.jpg" },
                cover: { type: "string", format: "uri", example: "https://example.com/new-cover.jpg" },
                location: { type: "string", example: "San Francisco, CA" }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: "Profile updated successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: { type: "string", example: "User updated successfully" },
                  data: {
                    type: "object",
                    properties: {
                      user: {
                        type: "object",
                        properties: {
                          id: { type: "integer", example: 42 },
                          name: { type: "string", example: "Johnathan Doe" },
                          email: { type: "string", format: "email", example: "john.doe@example.com" },
                          photo: { type: "string", format: "uri", example: "https://example.com/new-photo.jpg" },
                          cover: { type: "string", format: "uri", example: "https://example.com/new-cover.jpg" },
                          role: { type: "string", example: "USER" },
                          location: { type: "string", example: "San Francisco, CA" },
                          isActive: { type: "boolean", example: true },
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
        400: { description: "Validation error" },
        401: { description: "Unauthorized" }
      }
    }
  }