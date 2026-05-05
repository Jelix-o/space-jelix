import { Router, Request, Response } from 'express';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const targetUrl = String(req.query.url || '');
  if (!targetUrl) {
    res.status(400).json({ error: 'url parameter is required' });
    return;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      res.status(400).json({ error: 'Only http/https URLs are allowed' });
      return;
    }
  } catch {
    res.status(400).json({ error: 'Invalid URL' });
    return;
  }

  try {
    const upstream = await fetch(targetUrl, {
      headers: {
        'User-Agent': String(req.headers['user-agent'] || 'Mozilla/5.0'),
        'Accept': String(req.headers['accept'] || '*/*'),
      },
      redirect: 'follow',
    });

    const contentType = upstream.headers.get('content-type') || '';

    // Pass through status and safe headers, strip CSP/hop-by-hop/problematic headers
    const skipHeaders = new Set([
      'content-security-policy',
      'content-security-policy-report-only',
      'x-frame-options',
      'content-type',
      // hop-by-hop headers
      'connection',
      'keep-alive',
      'transfer-encoding',
      'te',
      'trailer',
      'upgrade',
      // may conflict when we modify the body
      'content-encoding',
      'content-length',
    ]);

    res.status(upstream.status);
    upstream.headers.forEach((value, key) => {
      if (skipHeaders.has(key.toLowerCase())) return;
      res.setHeader(key, value);
    });

    res.setHeader('Content-Type', contentType);

    // For HTML, inject <base> so relative URLs resolve to the original origin
    if (contentType.includes('text/html')) {
      let body = await upstream.text();
      const origin = `${parsedUrl.protocol}//${parsedUrl.host}`;
      const baseTag = `<base href="${origin}/" target="_self">`;
      if (body.includes('<head>')) {
        body = body.replace('<head>', `<head>${baseTag}`);
      } else if (body.includes('<HEAD>')) {
        body = body.replace('<HEAD>', `<HEAD>${baseTag}`);
      } else {
        body = `${baseTag}${body}`;
      }
      res.send(body);
    } else {
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.send(buf);
    }
  } catch (err: any) {
    res.status(502).json({ error: `Proxy error: ${err.message}` });
  }
});

export default router;
