import type {
  ErrorRequestHandler,
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from "express";
import { ZodError } from "zod";
import { isKnownPrismaError } from "./db";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string = "API_ERROR",
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown> | unknown;

export function asyncRoute(handler: AsyncHandler): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function routeParam(value: string | string[] | undefined): string {
  const param = Array.isArray(value) ? value[0] : value;
  if (!param) {
    throw new ApiError(400, "معرّف الطلب غير صالح", "INVALID_PARAM");
  }
  return param;
}

export function getPagination(req: Request): { skip: number; take: number } {
  const page = Math.max(1, Number(req.query.page ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize ?? 20) || 20));
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ApiError) {
    res.status(error.status).json({
      code: error.code,
      error: error.message,
      message: error.message,
      ...(error.details === undefined ? {} : { details: error.details }),
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      code: "VALIDATION_ERROR",
      error: "بيانات الطلب غير صالحة",
      message: "بيانات الطلب غير صالحة",
      details: error.flatten().fieldErrors,
    });
    return;
  }

  if (error instanceof SyntaxError) {
    res.status(400).json({
      code: "INVALID_JSON",
      error: "صيغة JSON غير صالحة",
      message: "صيغة JSON غير صالحة",
    });
    return;
  }

  if (isKnownPrismaError(error)) {
    switch (error.code) {
      case "P2002":
        res.status(409).json({
          code: "CONFLICT",
          error: "القيمة مستخدمة بالفعل",
          message: "القيمة مستخدمة بالفعل",
        });
        return;
      case "P2003":
        res.status(409).json({
          code: "CONFLICT",
          error: "هذا السجل مرتبط بسجلات أخرى",
          message: "هذا السجل مرتبط بسجلات أخرى",
        });
        return;
      case "P2025":
        res.status(404).json({
          code: "NOT_FOUND",
          error: "السجل غير موجود",
          message: "السجل غير موجود",
        });
        return;
      case "P1001":
      case "P1002":
      case "P2021":
      case "P2022":
        res.status(503).json({
          code: "DATABASE_UNAVAILABLE",
          error: "قاعدة البيانات غير متاحة",
          message: "قاعدة البيانات غير متاحة",
        });
        return;
      default:
        break;
    }
  }

  console.error("Unhandled API error", error);
  res.status(500).json({
    code: "INTERNAL_ERROR",
    error: "حدث خطأ غير متوقع",
    message: "حدث خطأ غير متوقع",
  });
};
