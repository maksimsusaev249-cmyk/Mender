import { handleApiRequest } from '../../server/apiRouter';
import type { ServerEnv } from '../../server/firebaseAdminRest';

interface PagesFunctionContext {
  request: Request;
  env: ServerEnv;
}

export async function onRequest(context: PagesFunctionContext): Promise<Response> {
  return handleApiRequest(context.request, context.env || {});
}
