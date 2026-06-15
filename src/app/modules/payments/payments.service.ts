import SSLCommerzPayment from 'sslcommerz-lts';
import { AuctionStatus, PaymentStatus, TransactionType } from '@prisma/client';
import { Decimal } from 'decimal.js';
import crypto from 'crypto';
import { prisma } from '../../../config/db/database.config.ts';
import { redisConnection } from '../../../config/redis/redis.config.ts';
import { HTTP_STATUS } from '../../common/constants/http-status.constants.ts';
import { MESSAGES } from '../../common/constants/messages.constants.ts';
import { AppError } from '../../common/exceptions/app-error.exception.ts';
import { ENV } from '../../../config/env.config.ts';
import { emailQueue } from '../../../config/bull/queue.config.ts';
import { logger } from '../../common/utils/logger.util.ts';
import {
  generateInvoiceNumber,
  buildInvoiceEmailHtml,
  buildSellerPaymentHtml,
  type InvoiceData,
} from '../../common/utils/payments/invoice.util.ts';

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const PLATFORM_FEE = new Decimal(ENV.PLATFORM_FEE_PERCENT).div(100); // 0.20
const CACHE_TTL_SEC = 3600; // 1 hour
const PENDING_PAYMENT_REUSE_MS = 30 * 60 * 1000; // 30 min

// ─────────────────────────────────────────────────────────────
// Redis keys
// ─────────────────────────────────────────────────────────────
const TRX_CACHE_KEY = (trxId: string) => `payment:trx:${trxId}`;
const IPN_LOCK_KEY = (trxId: string) => `payment:ipn:lock:${trxId}`;
const IPN_PROCESSED_KEY = (trxId: string) => `payment:ipn:processed:${trxId}`;

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const generateTrxId = (): string =>
  `REX-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

const getSslczInstance = () =>
  new SSLCommerzPayment(
    ENV.SSLCOMMERZ_STORE_ID,
    ENV.SSLCOMMERZ_STORE_PASSWORD,
    ENV.SSLCOMMERZ_IS_LIVE
  );

const computeSplit = (amount: Decimal) => {
  const serviceFee = amount.mul(PLATFORM_FEE).toDecimalPlaces(2);
  const sellerProceeds = amount.minus(serviceFee).toDecimalPlaces(2);
  return { serviceFee, sellerProceeds };
};

// ─────────────────────────────────────────────────────────────
// Acquire a distributed IPN lock (prevents duplicate processing
// if SSLCommerz sends IPN twice within seconds)
// ─────────────────────────────────────────────────────────────
const acquireIpnLock = async (trxId: string): Promise<boolean> => {
  const result = await redisConnection.set(
    IPN_LOCK_KEY(trxId),
    '1',
    'EX',
    30,  // 30-second lock
    'NX'
  );
  return result === 'OK';
};

const releaseIpnLock = async (trxId: string): Promise<void> => {
  await redisConnection.del(IPN_LOCK_KEY(trxId));
};

const markIpnProcessed = async (trxId: string): Promise<void> => {
  // Keep this flag for 24h — belt-and-suspenders idempotency beyond the lock
  await redisConnection.set(IPN_PROCESSED_KEY(trxId), '1', 'EX', 86400);
};

const isIpnAlreadyProcessed = async (trxId: string): Promise<boolean> => {
  const result = await redisConnection.get(IPN_PROCESSED_KEY(trxId));
  return result === '1';
};

// ─────────────────────────────────────────────────────────────
// Fetch full payment with all relations needed downstream
// ─────────────────────────────────────────────────────────────
const fetchPaymentFull = async (trxId: string) => {
  return prisma.payment.findUnique({
    where: { trxId },
    include: {
      auction: {
        include: {
          seller: { select: { id: true, name: true, email: true } },
        },
      },
      buyer: { select: { id: true, name: true, email: true } },
    },
  });
};

// ─────────────────────────────────────────────────────────────
export class PaymentService {

  // ═══════════════════════════════════════════════════════════
  // PHASE 1 — INITIATE
  // POST /payments/initiate/:auctionId
  //
  // Validates winner → creates pending Payment → calls SSLCommerz
  // init API → returns GatewayPageURL for browser redirect
  // ═══════════════════════════════════════════════════════════
  static async initiate(buyerId: number, auctionId: number): Promise<string> {
    // ── 1. Validate auction ended and buyer is the winner ──
    const endedAuction = await prisma.endedAuction.findUnique({
      where: { originalAuctionId: auctionId },
      include: {
        auction: {
          include: { seller: { select: { id: true, name: true, email: true } } },
        },
        winner: { select: { id: true, name: true, email: true } },
      },
    });

    if (!endedAuction) {
      throw new AppError(MESSAGES.PAYMENT.AUCTION_NOT_ENDED, HTTP_STATUS.BAD_REQUEST);
    }

    if (endedAuction.winnerId !== buyerId) {
      throw new AppError(MESSAGES.PAYMENT.AUCTION_NOT_WON, HTTP_STATUS.FORBIDDEN);
    }

    if (endedAuction.paymentStatus === PaymentStatus.PAID) {
      throw new AppError(MESSAGES.PAYMENT.ALREADY_PAID, HTTP_STATUS.CONFLICT);
    }

    // ── 2. Reuse a recent pending payment to avoid duplicate init ──
    const recentPending = await prisma.payment.findFirst({
      where: {
        auctionId,
        buyerId,
        status: PaymentStatus.PENDING,
        createdAt: { gt: new Date(Date.now() - PENDING_PAYMENT_REUSE_MS) },
      },
    });

    let payment = recentPending;

    if (!payment) {
      const totalAmount = new Decimal(endedAuction.finalPrice.toString());
      const { serviceFee, sellerProceeds } = computeSplit(totalAmount);
      const trxId = generateTrxId();

      payment = await prisma.payment.create({
        data: {
          trxId,
          auctionId,
          buyerId,
          amount: totalAmount,
          serviceFee,
          sellerProceeds,
          status: PaymentStatus.PENDING,
        },
      });

      logger.info(`Payment created | trxId: ${trxId} | auctionId: ${auctionId} | buyerId: ${buyerId}`);
    }

    // ── 3. Build SSLCommerz init payload ──
    const sslData = {
      store_id: ENV.SSLCOMMERZ_STORE_ID,
      store_passwd: ENV.SSLCOMMERZ_STORE_PASSWORD,
      total_amount: payment.amount.toString(),
      currency: 'BDT',
      tran_id: payment.trxId,

      // Callback URLs — these hit YOUR server
      success_url: `${ENV.BACKEND_URL}/api/v1/payments/success`,
      fail_url: `${ENV.BACKEND_URL}/api/v1/payments/fail`,
      cancel_url: `${ENV.BACKEND_URL}/api/v1/payments/cancel`,
      ipn_url: `${ENV.BACKEND_URL}/api/v1/payments/ipn`,

      product_name: `Rex Auction — ${endedAuction.auction.title}`,
      product_category: 'Auction',
      product_profile: 'general',

      cus_name: endedAuction.winner!.name,
      cus_email: endedAuction.winner!.email,
      cus_add1: 'N/A',
      cus_city: 'Dhaka',
      cus_country: 'Bangladesh',
      cus_phone: '01000000000',

      shipping_method: 'NO',
      num_of_item: 1,
      emi_option: 0,

      // Pass-through metadata — returned back in success/IPN payload
      value_a: String(auctionId),
      value_b: String(buyerId),
    };

    const sslcz = getSslczInstance();
    const response = await sslcz.init(sslData);

    if (!response?.GatewayPageURL) {
      logger.error('SSLCommerz init failed', response);
      throw new AppError(
        'Failed to initialize payment gateway. Please try again.',
        HTTP_STATUS.BAD_GATEWAY
      );
    }

    // Cache the trxId → auctionId mapping for quick IPN lookups
    await redisConnection.set(TRX_CACHE_KEY(payment.trxId), String(auctionId), 'EX', CACHE_TTL_SEC);

    logger.info(`SSLCommerz session created | trxId: ${payment.trxId} | redirecting buyer`);

    return response.GatewayPageURL;
  }

  // ═══════════════════════════════════════════════════════════
  // PHASE 2a — SUCCESS CALLBACK
  // POST /payments/success (SSLCommerz redirects buyer's browser here)
  //
  // Validates the transaction → moves status PENDING → PROCESSING
  // Does NOT touch wallet yet — that's IPN's job.
  // ═══════════════════════════════════════════════════════════
  static async handleSuccess(sslPayload: Record<string, string>): Promise<string> {
    const tran_id = sslPayload.tran_id;
    const val_id = sslPayload.val_id;
    const status = sslPayload.status;

    if (!tran_id) {
      return `${ENV.FRONTEND_URL}/payment/fail?reason=missing_trx`;
    }

    logger.info(`Success callback received | trxId: ${tran_id} | status: ${status}`);

    // ── Guard: SSLCommerz status must be VALID ──
    if (status !== 'VALID' && status !== 'VALIDATED') {
      logger.warn(`Success callback with non-VALID status: ${status} | trxId: ${tran_id}`);
      return `${ENV.FRONTEND_URL}/payment/fail?trxId=${tran_id}&reason=invalid_status`;
    }

    // ── Find the payment ──
    const payment = await prisma.payment.findUnique({ where: { trxId: tran_id } });
    if (!payment) {
      logger.error(`Success callback — payment not found | trxId: ${tran_id}`);
      return `${ENV.FRONTEND_URL}/payment/fail?reason=not_found`;
    }

    // ── Idempotency: if already past PENDING, redirect appropriately ──
    if (payment.status === PaymentStatus.PAID) {
      return `${ENV.FRONTEND_URL}/payment/success?trxId=${tran_id}`;
    }
    if (payment.status === PaymentStatus.PROCESSING) {
      // IPN is still pending — show a "processing" page
      return `${ENV.FRONTEND_URL}/payment/processing?trxId=${tran_id}`;
    }
    if (payment.status === PaymentStatus.FAILED || payment.status === PaymentStatus.CANCELLED) {
      return `${ENV.FRONTEND_URL}/payment/fail?trxId=${tran_id}`;
    }

    // ── Validate with SSLCommerz Validation API ──
    const sslcz = getSslczInstance();
    let validationResponse: any;

    try {
      if (!val_id) {
        return `${ENV.FRONTEND_URL}/payment/processing?trxId=${tran_id}`;
      }
      validationResponse = await sslcz.validate({ val_id });
    } catch (err) {
      logger.error(`SSLCommerz validation API error | trxId: ${tran_id}`, err);
      // Don't mark as failed yet — IPN will arrive and process
      return `${ENV.FRONTEND_URL}/payment/processing?trxId=${tran_id}`;
    }

    if (validationResponse?.status !== 'VALID') {
      logger.warn(`Validation API returned non-VALID | trxId: ${tran_id}`, validationResponse);
      await PaymentService._markFailed(tran_id, sslPayload);
      return `${ENV.FRONTEND_URL}/payment/fail?trxId=${tran_id}&reason=validation_failed`;
    }

    // ── Move to PROCESSING — wallet credit deferred to IPN ──
    await prisma.payment.update({
      where: { trxId: tran_id },
      data: {
        status: PaymentStatus.PROCESSING,
        validatedAt: new Date(),
        paymentGatewayData: sslPayload as any,
      },
    });

    logger.info(`Payment moved to PROCESSING | trxId: ${tran_id}`);

    // Redirect buyer to a "processing" page — the UI should poll or
    // listen via WebSocket for the PAID event triggered by IPN
    return `${ENV.FRONTEND_URL}/payment/processing?trxId=${tran_id}`;
  }

  // ═══════════════════════════════════════════════════════════
  // PHASE 2b — IPN (Instant Payment Notification)
  // POST /payments/ipn (SSLCommerz → your server, server-to-server)
  //
  // This is the authoritative confirmation.
  // ALL money movement happens here, not in the success callback.
  // ═══════════════════════════════════════════════════════════
  static async handleIPN(sslPayload: Record<string, string>): Promise<void> {
    const tran_id = sslPayload.tran_id;
    const status = sslPayload.status;
    const val_id = sslPayload.val_id;

    if (!tran_id) {
      logger.error('IPN received without tran_id');
      return;
    }

    logger.info(`IPN received | trxId: ${tran_id} | status: ${status}`);

    // ── Idempotency check (Redis) ──
    if (await isIpnAlreadyProcessed(tran_id)) {
      logger.info(`IPN already processed (Redis flag) | trxId: ${tran_id}`);
      return;
    }

    // ── Distributed lock — prevents duplicate concurrent IPN processing ──
    const locked = await acquireIpnLock(tran_id);
    if (!locked) {
      logger.warn(`IPN lock not acquired — another process is handling this | trxId: ${tran_id}`);
      return;
    }

    try {
      const payment = await prisma.payment.findUnique({ where: { trxId: tran_id } });

      if (!payment) {
        logger.error(`IPN — payment record not found | trxId: ${tran_id}`);
        return;
      }

      // ── Only process IPN for PENDING or PROCESSING payments ──
      if (payment.status === PaymentStatus.PAID) {
        logger.info(`IPN — payment already PAID, skipping | trxId: ${tran_id}`);
        await markIpnProcessed(tran_id);
        return;
      }

      if (payment.status === PaymentStatus.FAILED || payment.status === PaymentStatus.CANCELLED) {
        logger.info(`IPN — payment already terminal (${payment.status}) | trxId: ${tran_id}`);
        return;
      }

      // ── Handle non-successful IPN statuses ──
      if (status !== 'VALID' && status !== 'VALIDATED') {
        logger.warn(`IPN non-VALID status: ${status} | trxId: ${tran_id}`);
        await PaymentService._markFailed(tran_id, sslPayload);
        return;
      }

      // ── Re-validate with SSLCommerz Validation API ──
      // (IPN can be spoofed — always re-validate)
      const sslcz = getSslczInstance();
      let validationResponse: any;

      try {
        if (!val_id) return;
        validationResponse = await sslcz.validate({ val_id });
      } catch (err) {
        logger.error(`IPN — validation API error | trxId: ${tran_id}`, err);
        // Don't fail — SSLCommerz may retry the IPN
        return;
      }

      if (validationResponse?.status !== 'VALID') {
        logger.warn(`IPN — validation failed | trxId: ${tran_id}`, validationResponse);
        await PaymentService._markFailed(tran_id, sslPayload);
        return;
      }

      // ── PROCESS THE PAYMENT: move to PAID + all money movement ──
      await PaymentService._processPaidTransaction(tran_id, sslPayload);

    } finally {
      await releaseIpnLock(tran_id);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // PHASE 3 — SETTLE PAYMENT (PROCESSING → PAID)
  // Private — only called from IPN after successful validation.
  //
  // This is the single place all money movement happens.
  // ═══════════════════════════════════════════════════════════
  private static async _processPaidTransaction(
    trxId: string,
    ipnPayload: Record<string, string>
  ): Promise<void> {
    const payment = await fetchPaymentFull(trxId);

    if (!payment || !payment.auctionId || !payment.buyerId) {
      logger.error(`_processPaidTransaction — incomplete payment record | trxId: ${trxId}`);
      return;
    }

    const totalAmount = new Decimal(payment.amount.toString());
    const serviceFee = new Decimal(payment.serviceFee?.toString() ?? '0');
    const sellerProceeds = new Decimal(payment.sellerProceeds?.toString() ?? '0');
    const sellerId = payment.auction!.seller.id;
    const paidAt = new Date();

    // ── Generate invoice number ──
    const invoiceNumber = generateInvoiceNumber(payment.id);

    logger.info(
      `Settling payment | trxId: ${trxId} | total: ${totalAmount} | seller: ${sellerProceeds} | fee: ${serviceFee}`
    );

    // ── Atomic DB transaction — all or nothing ──
    await prisma.$transaction(async (tx) => {

      // 1. Mark payment PAID
      await tx.payment.update({
        where: { trxId },
        data: {
          status: PaymentStatus.PAID,
          paidAt,
          ipnData: ipnPayload as any,
          invoiceNumber,
        },
      });

      // 2. Update EndedAuction
      await tx.endedAuction.update({
        where: { originalAuctionId: payment.auctionId! },
        data: { paymentStatus: PaymentStatus.PAID },
      });

      // 3. Update Auction status → sold
      await tx.auction.update({
        where: { id: payment.auctionId! },
        data: { status: AuctionStatus.sold, paymentStatus: PaymentStatus.PAID },
      });

      // 4. Transaction #1 — AUCTION_PAYMENT (what the buyer paid, full amount)
      await tx.transaction.create({
        data: {
          userId: payment.buyerId!,
          type: TransactionType.auction_payment,
          amount: totalAmount,
          referenceType: 'payment',
          referenceId: payment.id,
          note: `Auction payment for "${payment.auction!.title}" | Invoice: ${invoiceNumber}`,
        },
      });

      // 5. Transaction #2 — SELLER_EARNING (80% credit to seller wallet)
      await tx.transaction.create({
        data: {
          userId: sellerId,
          type: TransactionType.seller_earning,
          amount: sellerProceeds,
          referenceType: 'payment',
          referenceId: payment.id,
          note: `Sale proceeds (${100 - ENV.PLATFORM_FEE_PERCENT}%) for "${payment.auction!.title}" | Invoice: ${invoiceNumber}`,
        },
      });

      // 6. Transaction #3 — PLATFORM_FEE (20% platform fee record)
      // Attributed to the seller (deducted from their gross) for accounting
      await tx.transaction.create({
        data: {
          userId: sellerId,
          type: TransactionType.platform_fee,
          amount: serviceFee.negated(), // negative = deducted
          referenceType: 'payment',
          referenceId: payment.id,
          note: `Platform fee (${ENV.PLATFORM_FEE_PERCENT}%) for "${payment.auction!.title}"`,
        },
      });

      // 7. Credit seller wallet
      await tx.userStats.update({
        where: { userId: sellerId },
        data: { accountBalance: { increment: sellerProceeds.toNumber() } },
      });

      // 8. Update buyer stats
      await tx.userStats.update({
        where: { userId: payment.buyerId! },
        data: { totalSpent: { increment: totalAmount.toNumber() } },
      });

      // 9. Buyer activity log
      await tx.userActivity.create({
        data: {
          userId: payment.buyerId!,
          activityType: 'payment_made',
          description: `Paid BDT ${totalAmount} for "${payment.auction!.title}"`,
          metadata: { trxId, invoiceNumber, auctionId: payment.auctionId },
        },
      });

      // 10. Notify seller
      await tx.notification.create({
        data: {
          recipientId: sellerId,
          title: 'Payment received — prepare for delivery',
          message: `${payment.buyer!.name} paid BDT ${totalAmount} for "${payment.auction!.title}". Your proceeds: BDT ${sellerProceeds}. Please proceed with delivery.`,
          type: 'payment_received',
          relatedAuctionId: payment.auctionId!,
          relatedUserId: payment.buyerId!,
        },
      });

      // 11. Notify buyer
      await tx.notification.create({
        data: {
          recipientId: payment.buyerId!,
          title: 'Payment confirmed',
          message: `Your payment of BDT ${totalAmount} for "${payment.auction!.title}" has been confirmed. The seller will begin delivery soon.`,
          type: 'payment_confirmed',
          relatedAuctionId: payment.auctionId!,
        },
      });
    });

    // ── Mark IPN processed in Redis (post-transaction) ──
    await markIpnProcessed(trxId);

    // ── Cleanup trx cache ──
    await redisConnection.del(TRX_CACHE_KEY(trxId));

    // ── Queue invoice emails (async, non-blocking) ──
    const invoiceData: InvoiceData = {
      invoiceNumber,
      trxId,
      issuedAt: paidAt,
      buyer: { name: payment.buyer!.name, email: payment.buyer!.email },
      seller: { name: payment.auction!.seller.name, email: payment.auction!.seller.email },
      auction: { id: payment.auctionId!, title: payment.auction!.title },
      amount: totalAmount.toString(),
      serviceFee: serviceFee.toString(),
      sellerProceeds: sellerProceeds.toString(),
    };

    await emailQueue.add(
      'payment-invoice-buyer',
      {
        to: payment.buyer!.email,
        toName: payment.buyer!.name,
        subject: `Payment Invoice ${invoiceNumber} — Rex Auction`,
        htmlContent: buildInvoiceEmailHtml(invoiceData),
      },
      { priority: 1 }
    );

    await emailQueue.add(
      'payment-proceeds-seller',
      {
        to: payment.auction!.seller.email,
        toName: payment.auction!.seller.name,
        subject: `You've been paid — Rex Auction`,
        htmlContent: buildSellerPaymentHtml({
          sellerName: payment.auction!.seller.name,
          buyerName: payment.buyer!.name,
          auctionTitle: payment.auction!.title,
          proceeds: sellerProceeds.toString(),
          totalAmount: totalAmount.toString(),
          invoiceNumber,
          trxId,
        }),
      },
      { priority: 1 }
    );

    logger.info(`Payment settled successfully | trxId: ${trxId} | invoice: ${invoiceNumber}`);
  }

  // ═══════════════════════════════════════════════════════════
  // FAIL CALLBACK
  // POST /payments/fail
  // ═══════════════════════════════════════════════════════════
  static async handleFail(sslPayload: Record<string, string>): Promise<string> {
    const tran_id = sslPayload.tran_id;
    logger.warn(`Fail callback received | trxId: ${tran_id}`);
    if (tran_id) {
      await PaymentService._markFailed(tran_id, sslPayload);
      return `${ENV.FRONTEND_URL}/payment/fail?trxId=${tran_id}`;
    }
    return `${ENV.FRONTEND_URL}/payment/fail`;
  }

  // ═══════════════════════════════════════════════════════════
  // CANCEL CALLBACK
  // POST /payments/cancel
  // ═══════════════════════════════════════════════════════════
  static async handleCancel(sslPayload: Record<string, string>): Promise<string> {
    const tran_id = sslPayload.tran_id;
    logger.warn(`Cancel callback received | trxId: ${tran_id}`);

    if (tran_id) {
      await prisma.payment.updateMany({
        where: { trxId: tran_id, status: { in: [PaymentStatus.PENDING, PaymentStatus.PROCESSING] } },
        data: { status: PaymentStatus.CANCELLED, paymentGatewayData: sslPayload as any },
      });
      return `${ENV.FRONTEND_URL}/payment/cancel?trxId=${tran_id}`;
    }

    return `${ENV.FRONTEND_URL}/payment/cancel`;
  }

  // ═══════════════════════════════════════════════════════════
  // INTERNAL: mark payment as FAILED
  // ═══════════════════════════════════════════════════════════
  private static async _markFailed(
    trxId: string,
    gatewayData: Record<string, string>
  ): Promise<void> {
    await prisma.payment.updateMany({
      where: { trxId, status: { in: [PaymentStatus.PENDING, PaymentStatus.PROCESSING] } },
      data: { status: PaymentStatus.FAILED, paymentGatewayData: gatewayData as any },
    });
    logger.warn(`Payment marked FAILED | trxId: ${trxId}`);
  }

  // ═══════════════════════════════════════════════════════════
  // GET PAYMENT STATUS (frontend polling for /payment/processing page)
  // ═══════════════════════════════════════════════════════════
  static async getPaymentStatus(trxId: string, requesterId: number) {
    const payment = await prisma.payment.findUnique({
      where: { trxId },
      select: {
        id: true,
        trxId: true,
        status: true,
        amount: true,
        serviceFee: true,
        sellerProceeds: true,
        invoiceNumber: true,
        validatedAt: true,
        paidAt: true,
        createdAt: true,
        auctionId: true,
        buyerId: true,
        auction: { select: { id: true, title: true, images: true, sellerId: true } },
        buyer: { select: { id: true, name: true, email: true } },
      },
    });

    if (!payment) throw new AppError(MESSAGES.PAYMENT.NOT_FOUND, HTTP_STATUS.NOT_FOUND);

    // Access control — buyer, seller, or admin
    const requester = await prisma.user.findUnique({
      where: { id: requesterId },
      select: { role: true },
    });

    const isBuyer = payment.buyerId === requesterId;
    const isSeller = payment.auction?.sellerId === requesterId;
    const isAdmin = requester?.role === 'ADMIN';

    if (!isBuyer && !isSeller && !isAdmin) {
      throw new AppError(MESSAGES.AUTH.FORBIDDEN, HTTP_STATUS.FORBIDDEN);
    }

    return payment;
  }

  // ═══════════════════════════════════════════════════════════
  // GET INVOICE (for download/display on payment success page)
  // ═══════════════════════════════════════════════════════════
  static async getInvoice(invoiceNumber: string, requesterId: number) {
    const payment = await prisma.payment.findUnique({
      where: { invoiceNumber },
      include: {
        auction: {
          include: { seller: { select: { id: true, name: true, email: true } } },
        },
        buyer: { select: { id: true, name: true, email: true } },
      },
    });

    if (!payment || payment.status !== PaymentStatus.PAID) {
      throw new AppError(MESSAGES.PAYMENT.INVOICE_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }

    const requester = await prisma.user.findUnique({
      where: { id: requesterId },
      select: { role: true },
    });

    const isBuyer = payment.buyerId === requesterId;
    const isSeller = payment.auction?.seller.id === requesterId;
    const isAdmin = requester?.role === 'ADMIN';

    if (!isBuyer && !isSeller && !isAdmin) {
      throw new AppError(MESSAGES.AUTH.FORBIDDEN, HTTP_STATUS.FORBIDDEN);
    }

    return buildInvoiceEmailHtml({
      invoiceNumber: payment.invoiceNumber!,
      trxId: payment.trxId,
      issuedAt: payment.paidAt!,
      buyer: payment.buyer!,
      seller: payment.auction!.seller,
      auction: { id: payment.auctionId!, title: payment.auction!.title },
      amount: payment.amount.toString(),
      serviceFee: payment.serviceFee?.toString() ?? '0',
      sellerProceeds: payment.sellerProceeds?.toString() ?? '0',
    });
  }

  // ═══════════════════════════════════════════════════════════
  // BUYER: payment history
  // ═══════════════════════════════════════════════════════════
  static async getBuyerPayments(buyerId: number, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where: { buyerId },
        include: { auction: { select: { id: true, title: true, images: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.payment.count({ where: { buyerId } }),
    ]);
    return { payments, total, page, limit };
  }

  // ═══════════════════════════════════════════════════════════
  // ADMIN: all payments with status filter
  // ═══════════════════════════════════════════════════════════
  static async adminGetPayments(page = 1, limit = 20, status?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (status) where.status = status;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          auction: { select: { id: true, title: true } },
          buyer: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ]);

    return { payments, total, page, limit };
  }

  // ═══════════════════════════════════════════════════════════
  // ADMIN: revenue summary (dashboard widget)
  // ═══════════════════════════════════════════════════════════
  static async adminRevenueSummary() {
    const [totals, byMonth] = await Promise.all([
      prisma.payment.aggregate({
        where: { status: PaymentStatus.PAID },
        _sum: { amount: true, serviceFee: true, sellerProceeds: true },
        _count: { id: true },
      }),
      prisma.$queryRaw<Array<{ month: string; revenue: string; fee: string }>>`
        SELECT
          TO_CHAR(DATE_TRUNC('month', "paidAt"), 'YYYY-MM') AS month,
          SUM(amount)::text AS revenue,
          SUM("serviceFee")::text AS fee
        FROM payments
        WHERE status = 'PAID' AND "paidAt" IS NOT NULL
        GROUP BY DATE_TRUNC('month', "paidAt")
        ORDER BY DATE_TRUNC('month', "paidAt") DESC
        LIMIT 12
      `,
    ]);

    return {
      totalRevenue: totals._sum?.amount ?? 0,
      totalPlatformFee: totals._sum?.serviceFee ?? 0,
      totalSellerProceeds: totals._sum?.sellerProceeds ?? 0,
      totalPaidCount: totals._count?.id ?? 0,
      byMonth,
    };
  }
}