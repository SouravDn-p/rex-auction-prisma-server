import { Router } from "express";
import { AuthController } from "./auth.controller.ts";
import { registerDto } from "./dto/register.dto.ts";
import { loginDto } from "./dto/login.dto.ts";
import { validateDto } from "../../common/guards/validate-dto.middleware.ts";
import { protect } from "../../common/guards/auth.middleware.ts";

const router = Router();
const authController = new AuthController();

router.post('/register', validateDto(registerDto), (req, res, next) => authController.register(req, res, next));
router.post('/login', validateDto(loginDto), (req, res, next) => authController.login(req, res, next));
router.post('/logout', protect, (req, res, next) => authController.logout(req, res, next));
router.post('/refresh-token', (req, res, next) => authController.refreshToken(req, res, next));
router.get('/me', protect, (req, res, next) => authController.getProfile(req, res, next));

export default router;