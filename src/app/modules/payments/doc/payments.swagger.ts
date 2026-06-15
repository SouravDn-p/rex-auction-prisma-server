import { adminPaymentsPath } from "./paths/admin-payments.path.ts";
import { adminRevenuePath } from "./paths/admin-revenue.path.ts";
import { initiatePaymentPath } from "./paths/initiate-payment.path.ts";
import { myPaymentsPath } from "./paths/my-payments.path.ts";
import { paymentCallbacksPath } from "./paths/payment-callbacks.path.ts";
import { paymentInvoicePath } from "./paths/payment-invoice.path.ts";
import { paymentStatusPath } from "./paths/payment-status.path.ts";

export const paymentsPaths = {
  "/payments/initiate/{auctionId}": initiatePaymentPath,
  "/payments/status/{trxId}": paymentStatusPath,
  "/payments/invoice/{invoiceNumber}": paymentInvoicePath,
  "/payments/my-payments": myPaymentsPath,
  "/payments/admin/all": adminPaymentsPath,
  "/payments/admin/revenue": adminRevenuePath,
  "/payments/success": paymentCallbacksPath,
  "/payments/fail": paymentCallbacksPath,
  "/payments/cancel": paymentCallbacksPath,
  "/payments/ipn": paymentCallbacksPath,
};
