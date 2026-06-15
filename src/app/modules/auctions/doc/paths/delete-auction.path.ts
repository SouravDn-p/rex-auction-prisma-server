export const deleteAuctionPath = {
  delete: {
    summary: "Delete auction",
    description: "Seller deletes an auction while it is still pending.",
    tags: ["Auctions"],
    security: [{ cookieAuth: [] }],
    parameters: [
      { name: "id", in: "path", required: true, schema: { type: "integer", example: 1 } },
    ],
    responses: {
      200: { description: "Auction deleted successfully" },
      400: { description: "Auction not editable" },
      401: { description: "Unauthorized" },
      403: { description: "Forbidden" },
      404: { description: "Auction not found" },
    },
  },
};
