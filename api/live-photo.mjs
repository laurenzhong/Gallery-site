import { createHash, timingSafeEqual } from "node:crypto";
import { deviceAuthorized, send, serviceClient } from "../server/iphone-devices.mjs";

const maxBodyBytes = 4_400_000;

function hash(value) {
  return createHash("sha256").update(value).digest();
}

async function readForm(request, contentType) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > maxBodyBytes) {
      // Let the response finish even if the client sent too much data.
      request.resume();
      return null;
    }
    chunks.push(chunk);
  }
  return new Response(Buffer.concat(chunks), { headers: { "Content-Type": contentType } }).formData();
}

function readDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().startsWith(value) ? value : undefined;
}

function photoPath(document) {
  return `/photos/${encodeURIComponent(document.slug.current)}`;
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return send(response, 405, { error: "请使用 Gallery iPhone 上传端。" });
  }

  const uploadKey = process.env.GALLERY_LIVE_UPLOAD_KEY?.trim();
  const client = serviceClient();
  if (!client) return send(response, 503, { error: "网站尚未开启实况照片上传。" });
  const header = request.headers.authorization ?? "";
  const legacyAuthorized = uploadKey && timingSafeEqual(hash(header), hash(`Bearer ${uploadKey}`));
  try {
    if (!legacyAuthorized && !await deviceAuthorized(client, header)) {
      return send(response, 401, { error: "请在 Gallery CMS 授权这台 iPhone。" });
    }
  } catch {
    return send(response, 502, { error: "暂时无法检查设备授权，请稍后重试。" });
  }
  const contentType = request.headers["content-type"] ?? "";
  if (!contentType.startsWith("multipart/form-data;")) {
    return send(response, 415, { error: "需要同时发送实况照片封面和视频。" });
  }
  if (Number(request.headers["content-length"]) > maxBodyBytes) {
    return send(response, 413, { error: "实况照片文件过大。" });
  }

  const form = await readForm(request, contentType).catch(() => undefined);
  if (form === null) return send(response, 413, { error: "实况照片文件过大。" });
  if (!form) return send(response, 400, { error: "无法读取上传文件。" });

  const importId = form.get("importId");
  const image = form.get("image");
  const video = form.get("video");
  if (typeof importId !== "string" || !/^[0-9a-f]{64}$/.test(importId) ||
      !(image instanceof File) || image.type !== "image/jpeg" ||
      !(video instanceof File) || video.type !== "video/mp4") {
    return send(response, 400, { error: "上传文件必须包含 JPG 封面和 MP4 视频。" });
  }

  const imageBytes = Buffer.from(await image.arrayBuffer());
  const videoBytes = Buffer.from(await video.arrayBuffer());
  if (imageBytes.subarray(0, 3).toString("hex") !== "ffd8ff" ||
      videoBytes.toString("ascii", 4, 8) !== "ftyp") {
    return send(response, 400, { error: "无法识别实况照片的封面或视频。" });
  }

  const documentId = `photo-live-${importId}`;
  const date = readDate(form.get("date"));
  const originalName = form.get("sourceFilename");
  const sourceFilename = (typeof originalName === "string" ? originalName.split(/[/\\]/).pop().trim().slice(0, 120) : "") || "Live Photo.jpg";
  const title = date ? `实况照片 · ${date}` : sourceFilename.replace(/\.[^.]+$/, "") || "实况照片";

  try {
    const existing = await client.getDocument(documentId);
    if (existing?.slug?.current) return send(response, 200, { path: photoPath(existing) });

    const [imageAsset, videoAsset, lastSortOrder] = await Promise.all([
      client.assets.upload("image", imageBytes, { filename: image.name, contentType: image.type }),
      client.assets.upload("file", videoBytes, { filename: `${documentId}.mp4`, contentType: video.type }),
      client.fetch('coalesce(*[_type == "photo" && defined(sortOrder)] | order(sortOrder desc)[0].sortOrder, 0)'),
    ]);

    const document = await client.createIfNotExists({
      _id: documentId,
      _type: "photo",
      title,
      slug: { _type: "slug", current: `live-${importId.slice(0, 24)}` },
      sourceFilename,
      image: { _type: "image", asset: { _type: "reference", _ref: imageAsset._id } },
      liveVideo: { _type: "file", asset: { _type: "reference", _ref: videoAsset._id } },
      isHidden: false,
      sortOrder: lastSortOrder + 1,
      ...(date ? { date } : {}),
    });
    return send(response, 200, { path: photoPath(document) });
  } catch (error) {
    console.error("Live Photo upload failed", { status: error?.statusCode, name: error?.name });
    return send(response, 502, { error: "CMS 暂时无法保存实况照片，请重试。" });
  }
}
