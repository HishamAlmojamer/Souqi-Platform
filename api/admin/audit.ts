import {
  handleMemoryRequest,
  type ApiRequest,
  type ApiResponse,
} from '../../server/memory-api';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  await handleMemoryRequest('admin/audit', req, res);
}
