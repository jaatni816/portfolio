const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT) || 3000;

try {
  require('dotenv').config({ path: path.join(root, '.env.local') });
} catch (e) {
}

async function handleApiRoute(req, res, urlPath) {
  const apiPath = path.join(root, urlPath + '.js');
  if (!fs.existsSync(apiPath)) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: 'API route not found' }));
    return;
  }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      req.body = body ? JSON.parse(body) : {};
      req.method = req.method;
      req.headers = req.headers;

      const apiModule = require(apiPath);
      const apiRes = {
        statusCode: 200,
        headers: {},
        body: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        setHeader(name, value) {
          this.headers[name] = value;
          return this;
        },
        json(data) {
          this.body = data;
          res.writeHead(this.statusCode, {
            "Content-Type": "application/json",
            ...this.headers
          });
          res.end(JSON.stringify(data));
        },
        end(data) {
          res.writeHead(this.statusCode, this.headers);
          res.end(data);
        }
      };

      await apiModule(req, apiRes);
    } catch (error) {
      console.error('API error:', error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  });
}

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

const config = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
  } catch {
    return {};
  }
})();

const rewrites = config.rewrites || [];
const redirects = (config.redirects || []).map((r) => ({
  pattern: new RegExp("^" + r.source.replace(/:[A-Za-z_]\w*\*?/g, (match) => {
    if (match.endsWith('*')) return '.*';
    return '[^/]+';
  }) + "/?$"),
  destination: r.destination,
  permanent: r.permanent !== false,
}));

const toRegExp = (source) =>
  new RegExp("^" + source.replace(/:[A-Za-z_]\w*\*?/g, (match) => {
    if (match.endsWith('*')) return '.*';
    return '[^/]+';
  }) + "/?$");

function send(res, status, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) return notFound(res);
    res.writeHead(status, {
      "Content-Type":
        types[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(data);
  });
}

function notFound(res) {
  fs.readFile(path.join(root, "404.html"), (err, data) => {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end(err ? "404 Not Found" : data);
  });
}

function resolve(urlPath) {
  const rewrite = rewrites.find((r) => toRegExp(r.source).test(urlPath));
  if (rewrite) return path.join(root, rewrite.destination);

  const target = path.join(root, urlPath);
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    return path.join(target, "index.html");
  }

  if (config.cleanUrls && !path.extname(urlPath)) {
    const html = target + ".html";
    if (fs.existsSync(html)) return html;
  }

  return target;
}

http
  .createServer(async (req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);

    if (urlPath.startsWith('/api/')) {
      await handleApiRoute(req, res, urlPath);
      return;
    }

    if (urlPath.includes("..")) {
      res.writeHead(403).end("Forbidden");
      return;
    }

    const redirect = redirects.find((r) => r.pattern.test(urlPath));
    if (redirect) {
      res.writeHead(redirect.permanent ? 308 : 307, { Location: redirect.destination });
      res.end();
      return;
    }

    let filePath = resolve(urlPath);
    if (!filePath.startsWith(root)) {
      res.writeHead(403).end("Forbidden");
      return;
    }

    if (fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
      send(res, 200, filePath);
      return;
    }

    notFound(res);
  })
  .listen(port, () => {
    console.log(`Portfolio running at http://localhost:${port}`);
  });
