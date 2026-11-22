import {
  handleMemoryRequest,
  type ApiRequest,
  type ApiResponse,
} from '../../server/memory-api';

export default async function handler(req: ApiRequest, res: ApiResponse) {
  await handleMemoryRequest('auth/register', req, res);
}
