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
    }
  }
}

export function integrationRequestLogger(req: Request, res: Response, next: NextFunction) {
  const startedAt = Date.now();
  req.integrationRequestId = randomUUID();
  res.setHeader("X-Request-Id", req.integrationRequestId);

  res.on("finish", () => {
    const statusCode = res.statusCode;
    void db.insert(integrationRequestLogs).values({
      requestId: req.integrationRequestId!,
      apiKeyId: req.integrationApiKeyId ?? null,
      method: req.method,
      path: req.path,
      statusCode,
      durationMs: Date.now() - startedAt,
      itemCount: req.integrationItemCount ?? null,
      errorCode: statusCode >= 400 ? `http_${statusCode}` : null,
    }).catch((error) => {
      console.error("[1C integration] Failed to write request log:", error?.message ?? error);
    });
  });

  next();
}
