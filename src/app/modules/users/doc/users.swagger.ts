export const usersPaths = {
  "/users/me": {
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
  },
  "/users/me/stats": {
    get: {
      summary: "Get user statistics",
      description: "Retrieve account balance, auctions won count, active bids, and total spent stats.",
      tags: ["Users"],
      security: [{ bearerAuth: [] }],
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
  },
  "/users/me/activities": {
    get: {
      summary: "Get user activity logs",
      description: "Retrieve paginated history of security, bidding, and account events.",
      tags: ["Users"],
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "page", in: "query", schema: { type: "integer", default: 1 }, description: "Page number" },
        { name: "limit", in: "query", schema: { type: "integer", default: 20 }, description: "Items per page" }
      ],
      responses: {
        200: {
          description: "Activities retrieved successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: { type: "string", example: "User activities retrieved successfully" },
                  data: {
                    type: "object",
                    properties: {
                      activities: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { type: "integer", example: 100 },
                            userId: { type: "integer", example: 42 },
                            activityType: { type: "string", example: "profile_updated" },
                            description: { type: "string", example: "Updated profile details" },
                            metadata: { type: "object" },
                            createdAt: { type: "string", format: "date-time" }
                          }
                        }
                      },
                      total: { type: "integer", example: 15 },
                      page: { type: "integer", example: 1 },
                      limit: { type: "integer", example: 20 }
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
  },
  "/users/me/transactions": {
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
  },
  "/users/me/watchlist": {
    get: {
      summary: "Get user watchlist",
      description: "Fetch list of auctions the user has favorited/watched.",
      tags: ["Users"],
      security: [{ bearerAuth: [] }],
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
      security: [{ bearerAuth: [] }],
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
  },
  "/users/me/watchlist/{auctionId}": {
    post: {
      summary: "Add auction to watchlist (param)",
      description: "Add an auction directly via path parameter.",
      tags: ["Users"],
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "auctionId", in: "path", required: true, schema: { type: "integer" }, description: "The auction ID" }
      ],
      responses: {
        201: { description: "Added to watchlist successfully" },
        401: { description: "Unauthorized" },
        404: { description: "Auction not found" }
      }
    },
    delete: {
      summary: "Remove auction from watchlist",
      description: "Remove an auction from watchlist via path parameter.",
      tags: ["Users"],
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "auctionId", in: "path", required: true, schema: { type: "integer" }, description: "The auction ID" }
      ],
      responses: {
        200: { description: "Removed from watchlist successfully" },
        401: { description: "Unauthorized" },
        404: { description: "Watchlist item not found" }
      }
    }
  },
  "/users/me/seller-request": {
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
  },
  "/users/admin/users": {
    get: {
      summary: "ADMIN: Fetch all users",
      description: "List all users on the platform. Accessible only by accounts with ADMIN role.",
      tags: ["Admin (Users)"],
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "page", in: "query", schema: { type: "integer", default: 1 }, description: "Page number" },
        { name: "limit", in: "query", schema: { type: "integer", default: 20 }, description: "Items per page" },
        { name: "search", in: "query", schema: { type: "string" }, description: "Search query for name or email" }
      ],
      responses: {
        200: {
          description: "All users retrieved successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: { type: "string", example: "All users retrieved successfully" },
                  data: {
                    type: "object",
                    properties: {
                      users: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { type: "integer", example: 1 },
                            name: { type: "string", example: "Jane Doe" },
                            email: { type: "string", example: "jane.doe@example.com" },
                            role: { type: "string", example: "ADMIN" },
                            isActive: { type: "boolean", example: true },
                            createdAt: { type: "string", format: "date-time" }
                          }
                        }
                      },
                      total: { type: "integer", example: 88 }
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
  },
  "/users/admin/users/{userId}/status": {
    patch: {
      summary: "ADMIN: Toggle user status",
      description: "Deactivate or reactivate a user account. Deactivated users cannot log in.",
      tags: ["Admin (Users)"],
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "userId", in: "path", required: true, schema: { type: "integer" }, description: "The target user ID" }
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["isActive"],
              properties: {
                isActive: { type: "boolean", example: false }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: "User status updated successfully",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  success: { type: "boolean", example: true },
                  message: { type: "string", example: "User deactivated successfully" },
                  data: {
                    type: "object",
                    properties: {
                      user: {
                        type: "object",
                        properties: {
                          id: { type: "integer", example: 42 },
                          name: { type: "string" },
                          email: { type: "string" },
                          role: { type: "string" },
                          isActive: { type: "boolean", example: false }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        400: { description: "Cannot deactivate own admin account" },
        401: { description: "Unauthorized" },
        403: { description: "Forbidden - Admin access required" },
        404: { description: "User not found" }
      }
    }
  },
  "/users/admin/seller-requests": {
    get: {
      summary: "ADMIN: Fetch seller requests",
      description: "Get list of all submitted seller requests. Filter by status if requested.",
      tags: ["Admin (Users)"],
      security: [{ bearerAuth: [] }],
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
  },
  "/users/admin/seller-requests/{requestId}/review": {
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
};
