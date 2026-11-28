import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'github-apk-proxy',
      configureServer(server) {
        server.middlewares.use('/api/download-github-apk', async (req, res) => {
          try {
            const urlObj = new URL(req.url, 'http://localhost:5173');
            const targetUrl = urlObj.searchParams.get('url');
            const pat = req.headers['x-github-token'] || '';
            if (!targetUrl) {
              res.statusCode = 400;
              res.end('Missing url parameter');
              return;
            }

            const fetchHeaders = {};
            if (pat) fetchHeaders['Authorization'] = `Bearer ${pat}`;

            const upstream = await fetch(targetUrl, { headers: fetchHeaders });
            res.writeHead(upstream.status, {
              'Content-Type': upstream.headers.get('content-type') || 'application/vnd.android.package-archive',
              'Content-Length': upstream.headers.get('content-length') || '',
              'Access-Control-Allow-Origin': '*'
            });

            const arrayBuffer = await upstream.arrayBuffer();
            res.end(Buffer.from(arrayBuffer));
          } catch (err) {
            res.statusCode = 500;
            res.end(err.message);
          }
        });
      }
    }
  ],
  build: {
    target: 'es2015'
  }
})
