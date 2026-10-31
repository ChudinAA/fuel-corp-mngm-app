import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { db } from "../../../db";
import { integrationRequestLogs } from "../entities/integration";

declare global {
  namespace Express {
    interface Request {
      integrationRequestId?: string;
      integrationApiKeyId?: string;
      integrationItemCount?: number;
      integrationResponseSummary?: Record<string, unknown> | null;
    }
  }
}

function safeResponseSummary(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const data = body as Record<string, unknown>;
  const summary: Record<string, unknown> = {};
  for (const key of ["code", "message", "integration", "api_version", "status", "request_id"] as const) {
    const value = data[key];
    if (typeof value === "string") summary[key] = value.slice(0, key === "message" ? 1000 : 200);
  }
  for (const key of ["count"] as const) {
    const value = data[key];
    if (typeof value === "number" && Number.isFinite(value)) summary[key] = value;
  }
  if (data.counts && typeof data.counts === "object" && !Array.isArray(data.counts)) {
    const counts = Object.fromEntries(
      Object.entries(data.counts as Record<string, unknown>)
        .filter(([, value]) => typeof value === "number" && Number.isFinite(value))
        .slice(0, 20),
    );
    summary.counts = counts;
  }
  if (Array.isArray(data.results)) {
    summary.results = data.results.slice(0, 500).map((value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return null;
      const result = value as Record<string, unknown>;
      return Object.fromEntries(
        ["type", "id_1c", "outcome", "code", "entity_id"]
          .filter((key) => typeof result[key] === "string")
          .map((key) => [key, String(result[key]).slice(0, 200)]),
      );
    });
  }
  return Object.keys(summary).length ? summary : null;
}

function numericHeader(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function integrationRequestLogger(req: Request, res: Response, next: NextFunction) {
  const startedAt = Date.now();
  req.integrationRequestId = randomUUID();
  res.setHeader("X-Request-Id", req.integrationRequestId);
  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    req.integrationResponseSummary = safeResponseSummary(body);
    return originalJson(body);
  }) as Response["json"];

  res.on("finish", () => {
    const statusCode = res.statusCode;
    const summary = req.integrationResponseSummary;
    const itemErrors = summary?.counts && typeof summary.counts === "object"
      ? Object.entries(summary.counts as Record<string, unknown>)
        .some(([key, value]) => ["error", "conflict"].includes(key) && typeof value === "number" && value > 0)
      : false;
    const results = Array.isArray(summary?.results) ? summary.results : [];
    const hasItemErrors = results.some((result) =>
      !!result && typeof result === "object" &&
      ["error", "conflict"].includes(String((result as Record<string, unknown>).outcome)),
    );
    const errorCode = statusCode >= 400
      ? (typeof summary?.code === "string" ? summary.code : `http_${statusCode}`)
      : hasItemErrors ? "item_errors" : null;
    const errorMessage = statusCode >= 400
      ? (typeof summary?.message === "string" ? summary.message : null)
      : hasItemErrors || itemErrors ? "Есть ошибки по элементам; см. сводку ответа." : null;
    void db.insert(integrationRequestLogs).values({
      requestId: req.integrationRequestId!,
      apiKeyId: req.integrationApiKeyId ?? null,
      method: req.method,
      path: req.originalUrl.split("?", 1)[0].slice(0, 500),
      statusCode,
      durationMs: Date.now() - startedAt,
      itemCount: req.integrationItemCount ?? null,
      errorCode,
      errorMessage,
      clientIp: (req.ip || req.socket.remoteAddress || "").slice(0, 128) || null,
      userAgent: req.get("user-agent")?.slice(0, 500) ?? null,
      requestContentType: req.get("content-type")?.slice(0, 200) ?? null,
      requestContentLength: numericHeader(req.get("content-length")),
      responseContentType: String(res.getHeader("content-type") ?? "").slice(0, 200) || null,
      responseContentLength: numericHeader(String(res.getHeader("content-length") ?? "")),
      responseSummary: summary,
    }).catch((error) => {
      console.error("[1C integration] Failed to write request log:", error?.message ?? error);
    });
  });

  next();
}
