import Decimal from 'decimal.js';
import { ENV } from '../../../../config/env.config.ts';

export interface InvoiceData {
  invoiceNumber: string;
  trxId: string;
  issuedAt: Date;
  buyer: { name: string; email: string };
  seller: { name: string; email: string };
  auction: { id: number; title: string };
  amount: string;
  serviceFee: string;
  sellerProceeds: string;
}

export const generateInvoiceNumber = (paymentId: number): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `REX-INV-${year}${month}-${String(paymentId).padStart(6, '0')}`;
};

export const buildInvoiceEmailHtml = (d: InvoiceData): string => `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Invoice ${d.invoiceNumber}</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f5;padding:24px;margin:0;">
  <div style="max-width:580px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;">

    <!-- Header -->
    <div style="background:#1a1a2e;padding:28px 32px;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <h1 style="color:#ffffff;margin:0;font-size:22px;">Rex Auction</h1>
        <p style="color:#aaa;margin:4px 0 0;font-size:13px;">Payment Invoice</p>
      </div>
      <div style="text-align:right;">
        <p style="color:#fff;margin:0;font-size:14px;font-weight:bold;">${d.invoiceNumber}</p>
        <p style="color:#aaa;margin:4px 0 0;font-size:12px;">${d.issuedAt.toDateString()}</p>
      </div>
    </div>

    <!-- Body -->
    <div style="padding:32px;">

      <!-- Parties -->
      <div style="display:flex;justify-content:space-between;margin-bottom:24px;gap:16px;">
        <div style="flex:1;">
          <p style="color:#888;font-size:12px;margin:0 0 4px;text-transform:uppercase;letter-spacing:1px;">Bill To</p>
          <p style="color:#1a1a1a;font-weight:bold;margin:0;">${d.buyer.name}</p>
          <p style="color:#555;font-size:13px;margin:4px 0 0;">${d.buyer.email}</p>
        </div>
        <div style="flex:1;text-align:right;">
          <p style="color:#888;font-size:12px;margin:0 0 4px;text-transform:uppercase;letter-spacing:1px;">Seller</p>
          <p style="color:#1a1a1a;font-weight:bold;margin:0;">${d.seller.name}</p>
          <p style="color:#555;font-size:13px;margin:4px 0 0;">${d.seller.email}</p>
        </div>
      </div>

      <!-- Item -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <thead>
          <tr style="background:#f8f8f8;">
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#888;border-bottom:1px solid #eee;">Description</th>
            <th style="padding:10px 12px;text-align:right;font-size:12px;color:#888;border-bottom:1px solid #eee;">Amount (BDT)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:12px;color:#333;font-size:14px;border-bottom:1px solid #eee;">
              Auction Item — ${d.auction.title}
              <br><span style="color:#888;font-size:12px;">Auction #${d.auction.id}</span>
            </td>
            <td style="padding:12px;text-align:right;color:#333;font-size:14px;border-bottom:1px solid #eee;">${d.amount}</td>
          </tr>
          <tr>
            <td style="padding:12px;color:#888;font-size:13px;">Platform Service Fee (${ENV.PLATFORM_FEE_PERCENT}%)</td>
            <td style="padding:12px;text-align:right;color:#888;font-size:13px;">− ${d.serviceFee}</td>
          </tr>
          <tr>
            <td style="padding:12px;color:#333;font-size:14px;font-weight:bold;">Seller Proceeds</td>
            <td style="padding:12px;text-align:right;color:#333;font-size:14px;font-weight:bold;">${d.sellerProceeds}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr style="background:#1a1a2e;">
            <td style="padding:14px 12px;color:#fff;font-weight:bold;font-size:15px;">Total Paid</td>
            <td style="padding:14px 12px;text-align:right;color:#fff;font-weight:bold;font-size:15px;">${d.amount}</td>
          </tr>
        </tfoot>
      </table>

      <!-- Transaction ref -->
      <div style="background:#f8f8f8;border-radius:6px;padding:14px 16px;margin-bottom:24px;">
        <p style="color:#888;font-size:12px;margin:0 0 4px;text-transform:uppercase;letter-spacing:1px;">Transaction Reference</p>
        <p style="color:#1a1a1a;font-size:13px;font-family:monospace;margin:0;">${d.trxId}</p>
      </div>

      <p style="color:#888;font-size:12px;margin:0;">
        This is an automatically generated invoice. For disputes, contact support@rexauction.com.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f0f0f0;padding:16px 32px;text-align:center;">
      <p style="color:#aaa;font-size:11px;margin:0;">Rex Auction &nbsp;·&nbsp; ${ENV.FRONTEND_URL}</p>
    </div>

  </div>
</body>
</html>`;

export const buildSellerPaymentHtml = (d: {
  sellerName: string;
  buyerName: string;
  auctionTitle: string;
  proceeds: string;
  totalAmount: string;
  invoiceNumber: string;
  trxId: string;
}): string => `
<!DOCTYPE html>
<html><body style="font-family:Arial,sans-serif;background:#f4f4f5;padding:24px;">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;">
  <h2 style="color:#1a1a1a;margin-top:0;">You've been paid 🎉</h2>
  <p style="color:#444;">Hi ${d.sellerName}, <strong>${d.buyerName}</strong> completed payment for your auction.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;">
    <tr><td style="padding:8px;color:#888;">Auction</td><td style="padding:8px;font-weight:bold;">${d.auctionTitle}</td></tr>
    <tr><td style="padding:8px;color:#888;">Buyer Paid</td><td style="padding:8px;">BDT ${d.totalAmount}</td></tr>
    <tr><td style="padding:8px;color:#888;">Your Proceeds (80%)</td><td style="padding:8px;font-weight:bold;color:#16a34a;">BDT ${d.proceeds}</td></tr>
    <tr><td style="padding:8px;color:#888;">Invoice</td><td style="padding:8px;font-size:12px;font-family:monospace;">${d.invoiceNumber}</td></tr>
    <tr><td style="padding:8px;color:#888;">Transaction ID</td><td style="padding:8px;font-size:12px;font-family:monospace;">${d.trxId}</td></tr>
  </table>
  <p style="color:#888;font-size:13px;">Proceeds have been credited to your Rex Auction wallet. Please proceed with delivery as soon as possible.</p>
</div></body></html>`;