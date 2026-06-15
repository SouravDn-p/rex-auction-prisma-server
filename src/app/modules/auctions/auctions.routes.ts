import { Router } from "express";
import { AuctionsController } from "./auctions.controller.ts";
import { protect, restrictTo } from "../../common/guards/auth.middleware.ts";
import { validateDto } from "../../common/guards/validate-dto.middleware.ts";
import {
  createAuctionDtoSchema,
  updateAuctionDtoSchema,
  adminReviewAuctionDtoSchema,
  reactionDtoSchema,
} from "./dto/auctions.dto.ts";

const router = Router();
const controller = new AuctionsController();

// ─── Public ───
router.get("/", (req, res, next) => controller.list(req, res, next));

// ─── Seller ───
router.get("/seller/mine", protect, restrictTo("SELLER", "ADMIN"), (req, res, next) => controller.sellerAuctions(req, res, next));
router.post("/", protect, restrictTo("SELLER", "ADMIN"), validateDto(createAuctionDtoSchema), (req, res, next) => controller.create(req, res, next));
router.patch("/:id", protect, restrictTo("SELLER", "ADMIN"), validateDto(updateAuctionDtoSchema), (req, res, next) => controller.update(req, res, next));
router.delete("/:id", protect, restrictTo("SELLER", "ADMIN"), (req, res, next) => controller.remove(req, res, next));

// ─── Admin ───
router.get("/admin/pending", protect, restrictTo("ADMIN"), (req, res, next) => controller.adminListPending(req, res, next));
router.patch("/admin/:id/review", protect, restrictTo("ADMIN"), validateDto(adminReviewAuctionDtoSchema), (req, res, next) => controller.adminReview(req, res, next));

// ─── Reactions (any authenticated user) ───
router.post("/:id/reactions", protect, validateDto(reactionDtoSchema), (req, res, next) => controller.addReaction(req, res, next));
router.delete("/:id/reactions", protect, (req, res, next) => controller.removeReaction(req, res, next));

router.get("/:id", (req, res, next) => controller.getById(req, res, next));

export default router;