import { Router } from 'express';
import { PaymentController } from './payments.controller.ts';
import { protect, restrictTo } from '../../common/guards/auth.middleware.ts';

const router = Router();
const controller = new PaymentController();

// ─── Buyer: initiate (authenticated — GET so browser can follow it directly) ───
router.get(
  '/initiate/:auctionId',
  protect,
  restrictTo('USER', 'ADMIN'),
  (req, res, next) => controller.initiate(req, res, next)
);

// ─── SSLCommerz callbacks — NO auth, NO rate limiting ─────────────────────────
// These are browser POSTs (success/fail/cancel) or server POSTs (ipn)
// from SSLCommerz servers. They must be publicly accessible.
router.post('/success', (req, res) => controller.success(req, res));
router.post('/fail', (req, res) => controller.fail(req, res));
router.post('/cancel', (req, res) => controller.cancel(req, res));
router.post('/ipn', (req, res) => controller.ipn(req, res));

// ─── Authenticated buyer routes ───────────────────────────────────────────────
router.get('/status/:trxId', protect, (req, res, next) => controller.getStatus(req, res, next));
router.get('/invoice/:invoiceNumber', protect, (req, res, next) => controller.getInvoice(req, res, next));
router.get('/my-payments', protect, (req, res, next) => controller.getMyPayments(req, res, next));

// ─── Admin routes ─────────────────────────────────────────────────────────────
router.get('/admin/all', protect, restrictTo('ADMIN'), (req, res, next) => controller.adminGetPayments(req, res, next));
router.get('/admin/revenue', protect, restrictTo('ADMIN'), (req, res, next) => controller.adminRevenueSummary(req, res, next));

export default router;