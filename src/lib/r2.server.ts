// R2 Object Storage: presigned upload URLs + auto-cleanup
// S3-compatible API via Cloudflare R2

import { createHmac, createHash } from "node:crypto";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "";
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY || "";
const R2_SECRET_KEY = process.env.R2_SECRET_KEY || "";
const R2_BUCKET = process.env.R2_BUCKET || "hexarly-uploads";
const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

function sha256Hex(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

/** Generate AWS Signature V4 for R2 */
function signV4(
  method: string,
  path: string,
  queryParams: Record<string, string>,
  headers: Record<string, string>,
  payloadHash: string,
  timestamp: string
): { authorization: string; signedHeaders: string } {
  const region = "auto";
  const service = "s3";
  const date = timestamp.slice(0, 8);

  const sortedQuery = Object.keys(queryParams).sort().map(k =>
    `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`).join("&");

  const sortedHeaders = Object.keys(headers).sort();
  const canonicalHeaders = sortedHeaders.map(k => `${k.toLowerCase()}:${headers[k].trim()}\n`).join("");
  const signedHeaders = sortedHeaders.map(k => k.toLowerCase()).join(";");

  const canonicalRequest = [method, path, sortedQuery, canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const credentialScope = `${date}/${region}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", timestamp, credentialScope, sha256Hex(canonicalRequest)].join("\n");

  const kDate = hmacSha256("AWS4" + R2_SECRET_KEY, date);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, "aws4_request");
  const signature = hmacSha256(kSigning, stringToSign).toString("hex");

  const authorization = `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return { authorization, signedHeaders };
}

/** Generate a presigned PUT URL for direct browser → R2 upload */
export function getPresignedUploadUrl(key: string, contentType: string, expiresIn = 3600): string {
  const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = timestamp.slice(0, 8);

  const queryParams: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${R2_ACCESS_KEY}/${date}/auto/s3/aws4_request`,
    "X-Amz-Date": timestamp,
    "X-Amz-Expires": String(expiresIn),
    "X-Amz-SignedHeaders": "host",
  };

  const path = `/${R2_BUCKET}/${key}`;
  const headers = { host: `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` };

  // For presigned URL, we sign with UNSIGNED-PAYLOAD
  const { authorization: _, signedHeaders } = signV4("PUT", path, queryParams, headers, "UNSIGNED-PAYLOAD", timestamp);

  // Rebuild with signature in query
  const region = "auto", service = "s3";
  const sortedQuery = Object.keys(queryParams).sort().map(k =>
    `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`).join("&");
  const canonicalRequest = ["PUT", path, sortedQuery, `host:${headers.host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const credentialScope = `${date}/${region}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", timestamp, credentialScope, sha256Hex(canonicalRequest)].join("\n");

  const kDate = hmacSha256("AWS4" + R2_SECRET_KEY, date);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, "aws4_request");
  const signature = hmacSha256(kSigning, stringToSign).toString("hex");

  return `${R2_ENDPOINT}${path}?${sortedQuery}&X-Amz-Signature=${signature}`;
}

/** Delete an object from R2 (auto-cleanup after processing) */
export async function deleteFromR2(key: string): Promise<boolean> {
  try {
    const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
    const path = `/${R2_BUCKET}/${key}`;
    const headers = {
      host: `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      "x-amz-date": timestamp,
      "x-amz-content-sha256": sha256Hex(""),
    };
    const { authorization } = signV4("DELETE", path, {}, headers, sha256Hex(""), timestamp);

    const res = await fetch(`${R2_ENDPOINT}${path}`, {
      method: "DELETE",
      headers: { ...headers, Authorization: authorization },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Get public URL for an R2 object (if bucket is public) or generate download */
export function getR2PublicUrl(key: string): string {
  // Using R2 dev URL or custom domain - configure as needed
  return `${R2_ENDPOINT}/${R2_BUCKET}/${key}`;
}

/** Check if R2 is configured */
export function isR2Configured(): boolean {
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY && R2_SECRET_KEY);
}
