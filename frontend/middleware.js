// Vercel Edge Middleware — runs on EVERY request before any static file is
// served, so it gates the HTML, the JS bundle, AND the raw /data/*.json files.
// Free on the Hobby plan (unlike Vercel's dashboard "Password Protection",
// which is Pro-only). Password is "bird"; any username is accepted.
//
// Note: HTTP Basic Auth pops a browser dialog asking for username + password.
// Username can be anything (e.g. "bird"); the password must be "bird".

export const config = {
  // Match all paths. Static assets and data files all flow through here.
  matcher: "/:path*",
};

const PASSWORD = "bird";

export default function middleware(request) {
  const auth = request.headers.get("authorization") || "";
  if (auth.startsWith("Basic ")) {
    try {
      const decoded = atob(auth.slice(6)); // "username:password"
      const pass = decoded.slice(decoded.indexOf(":") + 1);
      if (pass === PASSWORD) return; // correct password → let request through
    } catch {
      // fall through to 401
    }
  }
  return new Response("需要密码 / Password required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="BirdTrace", charset="UTF-8"',
    },
  });
}
