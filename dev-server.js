const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT) || 3000;

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
  pattern: new RegExp("^" + r.source.replace(/:[A-Za-z_]\w*/g, "[^/]+") + "/?$"),
  destination: r.destination,
  permanent: r.permanent !== false,
}));

const toRegExp = (source) =>
  new RegExp("^" + source.replace(/:[A-Za-z_]\w*/g, "[^/]+") + "/?$");

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
  .createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);

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
