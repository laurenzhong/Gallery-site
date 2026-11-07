const ALLOWED_HOST = "cdn.sanity.io";
const ALLOWED_PATH = /^\/files\/zj2ik922\/production\//;

export default async function handler(request, response) {
  try {
    const rawUrl = new URL(request.url, `https://${request.headers.host}`).searchParams.get("url");
    if (!rawUrl) {
      response.status(400).send("Missing GPX URL");
      return;
    }

    const target = new URL(rawUrl);
    if (target.protocol !== "https:" || target.hostname !== ALLOWED_HOST || !ALLOWED_PATH.test(target.pathname)) {
      response.status(403).send("GPX source is not allowed");
      return;
    }

    const upstream = await fetch(target);
    const body = await upstream.text();
    response
      .status(upstream.status)
      .setHeader("Content-Type", "application/gpx+xml; charset=utf-8")
      .setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400")
      .send(body);
  } catch {
    response.status(502).send("Unable to load GPX track");
  }
}
