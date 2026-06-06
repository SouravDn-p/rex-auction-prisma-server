export const getWatchlistAuctionIdPath = {
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
  }