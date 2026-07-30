import https from "https";
import { getPaystackPublic, getPaystackSecret } from "./env";

export const PAYSTACK_SECRET = getPaystackSecret();
export const PAYSTACK_PUBLIC = getPaystackPublic();

// ─── Paystack HTTP helper ─────────────────────────────────────────────────────
export function paystackRequest(method: string, path: string, body?: object): Promise<any> {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const opts = {
      hostname: "api.paystack.co",
      port: 443,
      path,
      method,
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        "Content-Type": "application/json",
        ...(data && { "Content-Length": Buffer.byteLength(data) }),
      },
    };
    const req = https.request(opts, res => {
      let raw = "";
      res.on("data", c => { raw += c; });
      res.on("end", () => {
        try { resolve(JSON.parse(raw)); } catch { reject(new Error("Invalid Paystack response")); }
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}
