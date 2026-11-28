import { approveDevice, deviceAuthorized, devicePattern, revokeDevice, send, serviceClient } from "../server/iphone-devices.mjs";

export default async function handler(request, response) {
  if (!["GET", "POST"].includes(request.method)) {
    response.setHeader("Allow", "GET, POST");
    return send(response, 405, { error: "不支持该请求。" });
  }
  const client = serviceClient();
  if (!client) return send(response, 503, { error: "CMS 尚未配置。" });
  const header = request.headers.authorization ?? "";
  try {
    if (request.method === "GET") {
      const authorized = await deviceAuthorized(client, header);
      return send(response, authorized ? 200 : 401, { authorized });
    }
    const token = /^Bearer (\S{1,8192})$/.exec(header)?.[1];
    if (!token || token.startsWith("gd1_")) return send(response, 401, { error: "请先登录 CMS。" });
    const user = await client.withConfig({ token }).request({ uri: "/users/me" });
    if (!user?.id || !user.roles?.some(role => role.name === "administrator")) {
      return send(response, 403, { error: "请用此 Gallery 项目的 CMS 管理员账号授权。" });
    }
    const { action, device } = request.body ?? {};
    if (action === "list") {
      const devices = await client.fetch('*[_type == "iphoneDevice" && _id in path("iphoneDevice.*")] | order(_createdAt desc){device, _createdAt}');
      return send(response, 200, { devices });
    }
    if (!["approve", "revoke"].includes(action) || typeof device !== "string" || !devicePattern.test(device)) {
      return send(response, 400, { error: "设备授权请求无效，请从 App 重新打开。" });
    }
    if (action === "approve") await approveDevice(client, device);
    else await revokeDevice(client, device);
    return send(response, 200, { ok: true });
  } catch (error) {
    if (error?.statusCode === 401 || error?.statusCode === 403) {
      return send(response, error.statusCode, { error: "CMS 拒绝了请求，请重新登录并检查权限。" });
    }
    console.error("Gallery device authorization unavailable", { status: error?.statusCode, name: error?.name });
    return send(response, 502, { error: "暂时无法连接 CMS，请稍后重试。" });
  }
}
