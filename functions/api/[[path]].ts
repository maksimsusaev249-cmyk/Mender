import { handleApiRequest } from '../../server/apiRouter.js';
import type { ServerEnv } from '../../server/firebaseAdminRest.js';

interface PagesFunctionContext {
  request: Request;
  env: ServerEnv;
}

export async function onRequest(context: PagesFunctionContext): Promise<Response> {
  return handleApiRequest(context.request, context.env || {});
}
