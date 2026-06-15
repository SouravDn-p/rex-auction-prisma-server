declare module 'sslcommerz-lts' {
  export default class SSLCommerzPayment {
    constructor(storeId: string, storePassword: string, isLive: boolean);
    init(data: Record<string, unknown>): Promise<{ GatewayPageURL?: string; [key: string]: unknown }>;
    validate(data: { val_id: string }): Promise<{ status?: string; [key: string]: unknown }>;
  }
}
