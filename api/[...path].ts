import type { ApiRequest, ApiResponse } from "../server/memory-api";
import { app } from "../server/index";

export const config = { api: { bodyParser: false } };

export default function handler(req: ApiRequest, res: ApiResponse) {
  return app(req as never, res as never);
}
