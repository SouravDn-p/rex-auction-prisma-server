import { Router } from "express";
import { AuthController } from "./auth.controller.ts";
import { registerDto } from "./dto/register.dto.ts";
import { loginDto } from "./dto/login.dto.ts";
import { verifyOtpDto, resendOtpDto } from "./dto/verify-otp.dto.ts";
import { forgotPasswordDto, resetPasswordDto } from "./dto/password-reset.dto.ts";
import { validateDto } from "../../common/guards/validate-dto.middleware.ts";
import { protect } from "../../common/guards/auth.middleware.ts";

const router = Router();
const authController = new AuthController();

// Registration & verification
router.post('/register', validateDto(registerDto), (req, res, next) => authController.register(req, res, next));
router.post('/verify-email', validateDto(verifyOtpDto), (req, res, next) => authController.verifyEmail(req, res, next));
router.post('/resend-otp', validateDto(resendOtpDto), (req, res, next) => authController.resendOtp(req, res, next));

// Password reset
router.post('/forgot-password', validateDto(forgotPasswordDto), (req, res, next) => authController.forgotPassword(req, res, next));
router.post('/reset-password', validateDto(resetPasswordDto), (req, res, next) => authController.resetPassword(req, res, next));

// Login / logout
router.post('/login', validateDto(loginDto), (req, res, next) => authController.login(req, res, next));
router.post('/logout', protect, (req, res, next) => authController.logout(req, res, next));
router.post('/logout-all', protect, (req, res, next) => authController.logoutAll(req, res, next));

// Session management
router.get('/sessions', protect, (req, res, next) => authController.getSessions(req, res, next));
router.delete('/sessions/:sessionId', protect, (req, res, next) => authController.revokeSession(req, res, next));

// Token refresh
router.post('/refresh-token', (req, res, next) => authController.refreshToken(req, res, next));

// Profile
router.get('/me', protect, (req, res, next) => authController.getProfile(req, res, next));

// Google OAuth
router.get('/google', (req, res, next) => authController.googleAuth(req, res, next));
router.get('/google/callback', (req, res, next) => authController.googleCallback(req, res, next));

export default router;