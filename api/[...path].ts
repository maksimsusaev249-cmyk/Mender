import type { IncomingMessage, ServerResponse } from 'node:http';
import { Buffer } from 'node:buffer';
import { handleApiRequest } from '../server/apiRouter';
import type { ServerEnv } from '../server/firebaseAdminRest';

type VercelRequest = IncomingMessage & {
  body?: unknown;
  query?: Record<string, string | string[]>;
};

export default async function handler(req: VercelRequest, res: ServerResponse): Promise<void> {
  try {
    const protoHeader = req.headers['x-forwarded-proto'];
    const proto = typeof protoHeader === 'string' ? protoHeader.split(',')[0].trim() : 'https';
    const hostHeader = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
    const host = typeof hostHeader === 'string' ? hostHeader.split(',')[0].trim() : 'localhost';
    const rawUrl = req.url || '/api/health';
    const fullUrl = new URL(rawUrl, `${proto}://${host}`);

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
        } else if (Buffer.isBuffer(req.body)) {
          body = new Uint8Array(req.body);
        } else {
          body = JSON.stringify(req.body);
        }
      } else {
        const chunks: Buffer[] = [];
        await new Promise<void>((resolve, reject) => {
          req.on('data', (chunk: Buffer | Uint8Array | string) => chunks.push(Buffer.from(chunk)));
          req.on('end', resolve);
          req.on('error', reject);
        });
        if (chunks.length > 0) {
          body = new Uint8Array(Buffer.concat(chunks));
        }
      }
    }

    const webReq = new Request(fullUrl.toString(), { method, headers, body });
    const webRes = await handleApiRequest(webReq, process.env as unknown as ServerEnv);

    res.statusCode = webRes.status;
    webRes.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    const buf = Buffer.from(await webRes.arrayBuffer());
    res.end(buf);
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: err?.message || 'Vercel API error' }));
  }
}
