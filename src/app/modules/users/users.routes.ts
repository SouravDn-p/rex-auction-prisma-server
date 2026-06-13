import { Router } from "express";
import { UserRole } from "@prisma/client";
import { UsersController } from "./users.controller.ts";
import { protect, restrictTo } from "../../common/guards/auth.middleware.ts";
import { validateDto } from "../../common/guards/validate-dto.middleware.ts";
import {
  updateUserDtoSchema,
  submitSellerRequestDtoSchema,
  reviewSellerRequestDtoSchema,
  updateUserStatusDtoSchema,
} from "./dto/users.dto.ts";

const router = Router();
const usersController = new UsersController();

// ─── Protected User Routes ──────────────────────────────────────────────────
router.get("/me", protect, (req, res, next) => usersController.getProfile(req, res, next));
router.patch("/me", protect, validateDto(updateUserDtoSchema), (req, res, next) => usersController.updateProfile(req, res, next));
router.get("/me/stats", protect, (req, res, next) => usersController.getStats(req, res, next));
router.get("/me/activities", protect, (req, res, next) => usersController.getActivities(req, res, next));
router.get("/me/transactions", protect, (req, res, next) => usersController.getTransactions(req, res, next));

// Watchlist routes
router.get("/me/watchlist", protect, (req, res, next) => usersController.getWatchlist(req, res, next));
router.post("/me/watchlist", protect, (req, res, next) => usersController.addToWatchlist(req, res, next));
router.post("/me/watchlist/:auctionId", protect, (req, res, next) => usersController.addToWatchlist(req, res, next));
router.delete("/me/watchlist/:auctionId", protect, (req, res, next) => usersController.removeFromWatchlist(req, res, next));

// Onboarding requests
router.post("/me/seller-request", protect, validateDto(submitSellerRequestDtoSchema), (req, res, next) => usersController.submitSellerRequest(req, res, next));

// ─── Admin-Only Routes ───────────────────────────────────────────────────────
router.get("/admin/users", protect, restrictTo(UserRole.ADMIN), (req, res, next) => usersController.adminGetAllUsers(req, res, next));
router.patch("/admin/users/:userId/status", protect, restrictTo(UserRole.ADMIN), validateDto(updateUserStatusDtoSchema), (req, res, next) => usersController.adminUpdateUserStatus(req, res, next));

router.get("/admin/seller-requests", protect, restrictTo(UserRole.ADMIN), (req, res, next) => usersController.adminGetAllSellerRequests(req, res, next));
router.patch("/admin/seller-requests/:requestId/review", protect, restrictTo(UserRole.ADMIN), validateDto(reviewSellerRequestDtoSchema), (req, res, next) => usersController.adminReviewSellerRequest(req, res, next));

export default router;
