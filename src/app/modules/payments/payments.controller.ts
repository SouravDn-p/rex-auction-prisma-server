import type { Request, Response, NextFunction } from 'express';
import { sendSuccess } from '../../common/interceptors/response.util.ts';
import { HTTP_STATUS } from '../../common/constants/http-status.constants.ts';
import { PaymentService } from './payments.service.ts';
import { ENV } from '../../../config/env.config.ts';
import { logger } from '../../common/utils/logger.util.ts';

const getParam = (value: string | string[] | undefined): string => {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
};

export class PaymentController {
  // ── Buyer clicks "Pay Now" → backend redirects to SSLCommerz ──
  async initiate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as any;
      const auctionId = Number(req.params.auctionId);
      const gatewayUrl = await PaymentService.initiate(user.userId, auctionId);
      res.redirect(gatewayUrl);
    } catch (e) {
      next(e);
    }
  }

  // ── SSLCommerz browser redirect after payment ──
  async success(req: Request, res: Response): Promise<void> {
    try {
      const redirectUrl = await PaymentService.handleSuccess(req.body);
      res.redirect(redirectUrl);
    } catch (e) {
      logger.error('Success callback error:', e);
      res.redirect(`${ENV.FRONTEND_URL}/payment/fail?reason=server_error`);
    }
  }

  async fail(req: Request, res: Response): Promise<void> {
    try {
      const redirectUrl = await PaymentService.handleFail(req.body);
      res.redirect(redirectUrl);
    } catch (e) {
      logger.error('Fail callback error:', e);
      res.redirect(`${ENV.FRONTEND_URL}/payment/fail`);
    }
  }

  async cancel(req: Request, res: Response): Promise<void> {
    try {
      const redirectUrl = await PaymentService.handleCancel(req.body);
      res.redirect(redirectUrl);
    } catch (e) {
      logger.error('Cancel callback error:', e);
      res.redirect(`${ENV.FRONTEND_URL}/payment/cancel`);
    }
  }

  // ── SSLCommerz server-to-server IPN — always respond 200 ──
  async ipn(req: Request, res: Response): Promise<void> {
    // Respond immediately — SSLCommerz will retry if it doesn't get 200
    // We do the processing async so the response isn't delayed
    res.status(HTTP_STATUS.OK).send('OK');

    PaymentService.handleIPN(req.body).catch((err) => {
      logger.error('IPN processing error:', err);
    });
  }

  // ── Polling endpoint for /payment/processing page ──
  async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as any;
      const payment = await PaymentService.getPaymentStatus(getParam(req.params.trxId), user.userId);
      sendSuccess(res, HTTP_STATUS.OK, 'Payment status retrieved', { payment });
    } catch (e) {
      next(e);
    }
  }

  // ── Invoice HTML for display / download ──
  async getInvoice(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as any;
      const html = await PaymentService.getInvoice(getParam(req.params.invoiceNumber), user.userId);
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (e) {
      next(e);
    }
  }

  async getMyPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as any;
      const result = await PaymentService.getBuyerPayments(
        user.userId,
        req.query.page ? Number(req.query.page) : undefined,
        req.query.limit ? Number(req.query.limit) : undefined
      );
      sendSuccess(res, HTTP_STATUS.OK, 'Payment history retrieved', result);
    } catch (e) {
      next(e);
    }
  }

  async adminGetPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await PaymentService.adminGetPayments(
        req.query.page ? Number(req.query.page) : undefined,
        req.query.limit ? Number(req.query.limit) : undefined,
        req.query.status as string | undefined
      );
      sendSuccess(res, HTTP_STATUS.OK, 'Payments retrieved', result);
    } catch (e) {
      next(e);
    }
  }

  async adminRevenueSummary(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const summary = await PaymentService.adminRevenueSummary();
      sendSuccess(res, HTTP_STATUS.OK, 'Revenue summary retrieved', summary);
    } catch (e) {
      next(e);
    }
  }
}