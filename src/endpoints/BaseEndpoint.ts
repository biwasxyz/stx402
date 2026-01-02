import { OpenAPIRoute } from "chanfana";
import { Address } from "@stacks/transactions";
import { validateTokenType } from "../utils/pricing";
import type { AppContext } from "../types";
import { ContentfulStatusCode } from "hono/utils/http-status";
import type { SettlePaymentResult } from "../middleware/x402-stacks";

export class BaseEndpoint extends OpenAPIRoute {
  protected getTokenType(c: AppContext): string {
    const rawTokenType = c.req.query("tokenType") || "STX";
    return validateTokenType(rawTokenType);
  }

  protected validateAddress(c: AppContext): string | null {
    const address = c.req.param("address");
    try {
      const addressObj = Address.parse(address);
      return Address.stringify(addressObj);
    } catch (e) {
      console.error(String(e));
      return null;
    }
  }

  /**
   * Get the payer's address from the payment settlement result
   * This is set by the x402 middleware after successful payment verification
   */
  protected getPayerAddress(c: AppContext): string | null {
    const settleResult = c.get("settleResult") as SettlePaymentResult | undefined;
    return settleResult?.sender ?? null;
  }

  protected errorResponse(
    c: AppContext,
    error: string,
    status: ContentfulStatusCode,
    extra: Record<string, unknown> = {}
  ): Response {
    const tokenType = this.getTokenType(c);
    return c.json({ tokenType, error, ...extra }, status);
  }
}
