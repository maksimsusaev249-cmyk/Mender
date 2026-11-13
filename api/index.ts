import { handleApiRequest } from '../server/apiRouter.js';
import type { ServerEnv } from '../server/firebaseAdminRest.js';

interface VercelNodeRequest {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  on: (event: string, listener: (...args: any[]) => void) => void;
}

interface VercelNodeResponse {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (chunk?: any) => void;
}

export default async function handler(
  req: VercelNodeRequest,
  res: VercelNodeResponse
): Promise<void> {
  try {
    const protoHeader = req.headers['x-forwarded-proto'];
    const proto = typeof protoHeader === 'string' ? protoHeader.split(',')[0].trim() : 'https';
    const hostHeader = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
    const host = typeof hostHeader === 'string' ? hostHeader.split(',')[0].trim() : 'localhost';
    const rawUrl = req.url || '/api/health';
    const fullUrl = new URL(rawUrl, `${proto}://${host}`);

    const pathParam = fullUrl.searchParams.get('__path');
    if (pathParam !== null) {
      fullUrl.searchParams.delete('__path');
      const normalized = pathParam.replace(/^\/+/, '');
      fullUrl.pathname = normalized ? `/api/${normalized}` : '/api';
    }

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      const lower = key.toLowerCase();
      if (lower === 'host' || lower === 'content-length') continue;
      if (typeof value === 'string') headers.set(key, value);
      else if (Array.isArray(value)) headers.set(key, value.join(', '));
    }

    const method = (req.method || 'GET').toUpperCase();
    let body: BodyInit | undefined;

    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      if (req.body !== undefined) {
        if (typeof req.body === 'string') {
          body = req.body;
        } else if (req.body instanceof Uint8Array) {
          body = new Uint8Array(req.body);
        } else {
          body = JSON.stringify(req.body);
        }
      } else {
        const chunks: Uint8Array[] = [];
        await new Promise<void>((resolve, reject) => {
          req.on('data', (chunk: Uint8Array | string) => {
            chunks.push(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk);
          });
          req.on('end', resolve);
          req.on('error', reject);
        });
        if (chunks.length > 0) {
          const totalLen = chunks.reduce((acc, c) => acc + c.byteLength, 0);
          const merged = new Uint8Array(totalLen);
          let offset = 0;
          for (const chunk of chunks) {
            merged.set(chunk, offset);
            offset += chunk.byteLength;
          }
          body = merged;
        }
      }
    }

    const envSource =
      typeof globalThis !== 'undefined' && (globalThis as any).process?.env
        ? ((globalThis as any).process.env as ServerEnv)
        : {};

    const webReq = new Request(fullUrl.toString(), { method, headers, body });
    const webRes = await handleApiRequest(webReq, envSource);

    res.statusCode = webRes.status;
    webRes.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    const buf = new Uint8Array(await webRes.arrayBuffer());
    res.end(buf);
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: err?.message || 'Vercel API error' }));
  }
}
