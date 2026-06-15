import { Router } from "express";
import { BiddingController } from "./bidding.controller.ts";
import { protect } from "../../common/guards/auth.middleware.ts";
import { validateDto } from "../../common/guards/validate-dto.middleware.ts";
import { placeBidDtoSchema, setAutoBidDtoSchema } from "./dto/bidding.dto.ts";

const router = Router();
const controller = new BiddingController();

router.post("/place", protect, validateDto(placeBidDtoSchema), (req, res, next) => controller.placeBid(req, res, next));
router.post("/autobid", protect, validateDto(setAutoBidDtoSchema), (req, res, next) => controller.setAutoBid(req, res, next));
router.delete("/autobid/:auctionId", protect, (req, res, next) => controller.cancelAutoBid(req, res, next));
router.get("/autobid/:auctionId", protect, (req, res, next) => controller.getMyAutoBid(req, res, next));

export default router;