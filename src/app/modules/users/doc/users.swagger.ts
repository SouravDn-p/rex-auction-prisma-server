import { adminGetUsersPath } from "./paths/admin/admin-get-users.path.ts";
import { adminToggleUsersStatusPath } from "./paths/admin/admin-toggle-users-status.path.ts";
import { adminUpdateSellerRequestsPath } from "./paths/admin/admin-update.seller-requests.path.ts";
import { getAdminSellerRequestsPath } from "./paths/admin/get-admin-seller-requests.path.ts";
import { activitiesPath } from "./paths/users/activities.path.ts";
import { createSellerRequestPath } from "./paths/users/create-seller-request.path.ts";
import { getWatchlistAuctionIdPath } from "./paths/users/get-watchlist-auctionId.path.ts";
import { getMePath } from "./paths/users/getMe.paths.ts";
import { statsPath } from "./paths/users/stats.path.ts";
import { transactionsPath } from "./paths/users/transactions.path.ts";
import { watchlistPath } from "./paths/users/watchlist.path.ts";

export const usersPaths = {
  "/users/me": getMePath,
  "/users/me/stats": statsPath,
  "/users/me/activities": activitiesPath,
  "/users/me/transactions": transactionsPath,
  "/users/me/watchlist": watchlistPath,
  "/users/me/watchlist/{auctionId}": getWatchlistAuctionIdPath,
  "/users/me/seller-request": createSellerRequestPath,
  "/users/admin/users": adminGetUsersPath,
  "/users/admin/users/{userId}/status": adminToggleUsersStatusPath,
  "/users/admin/seller-requests": getAdminSellerRequestsPath,
  "/users/admin/seller-requests/{requestId}/review": adminUpdateSellerRequestsPath,
};