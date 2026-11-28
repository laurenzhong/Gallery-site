import { useEffect, useState } from "react";
import { Button, Card, Container, Heading, Stack, Text } from "@sanity/ui";
import { createAuthStore, useClient, useSource } from "sanity";
import { useRouterState } from "sanity/router";

type Device = { device: string; _createdAt: string };
type Reply = { devices?: Device[]; error?: string };

async function manage(token: string, action: string, device?: string, signal?: AbortSignal) {
  const response = await fetch("/api/iphone-device", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action, device }),
    redirect: "error",
    cache: "no-store",
    signal,
  });
  const reply: Reply = await response.json();
  if (!response.ok) throw new Error(reply.error || "操作失败，请重试。");
  return reply;
}

function code(device: string) {
  return device.slice(0, 8).toUpperCase();
}

export function IPhoneDevices() {
  const source = useSource();
  const token = useClient({ apiVersion: "2025-02-19" }).config().token;
  const device = useRouterState(() => window.location.pathname.match(/\/iphone\/([0-9a-f]{64})\/?$/)?.[1]);
  const admin = source.currentUser?.roles.some(role => role.name === "administrator");
  const Login = !token && admin ? createAuthStore({
    projectId: source.projectId, dataset: source.dataset, loginMethod: "token",
  }).LoginComponent : undefined;
  const [devices, setDevices] = useState<Device[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!token || !admin) return;
    const controller = new AbortController();
    manage(token, "list", undefined, controller.signal)
      .then(reply => { if (!controller.signal.aborted) setDevices(reply.devices || []); })
      .catch(error => { if (!controller.signal.aborted) setMessage(error.message); });
    return () => controller.abort();
  }, [token, admin, reload]);

  async function change(action: "approve" | "revoke", fingerprint: string) {
    if (!token || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await manage(token, action, fingerprint);
      setMessage(action === "approve" ? "这台 iPhone 已授权。请返回 Gallery 上传 App 选择实况照片。" : "已撤销这台 iPhone 的上传权限。");
      setReload(value => value + 1);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法连接 Gallery，请重试。");
    } finally {
      setBusy(false);
    }
  }

  return <Container width={1} padding={4} style={{ overflowY: "auto" }}>
    <Stack space={5}>
      <Heading as="h1">iPhone 上传授权</Heading>
      {!admin ? <Text>请使用 Gallery 的 CMS 管理员账号登录。</Text> :
        !token ? <Stack space={4}>
          <Text>请再次登录 CMS 以管理设备。</Text>
          {Login && <Login projectId={source.projectId} redirectPath={window.location.pathname} />}
        </Stack> : <>
          {device && <Card padding={4} radius={2} border><Stack space={4}>
            <Text>请核对 Gallery 上传 App 显示的本机识别码。</Text>
            <Heading>{code(device)}</Heading>
            <Text size={1}>授权后，这台 iPhone 选中的实况照片会直接发布到网站。</Text>
            <Button text="授权这台 iPhone" tone="primary" disabled={busy} onClick={() => change("approve", device)} />
          </Stack></Card>}
          {message && <div role="status"><Text>{message}</Text></div>}
          <Heading as="h2" size={1}>已授权设备</Heading>
          {devices.length === 0 && <Text muted>暂无已授权设备。首次授权请从 iPhone 的 Gallery 上传 App 打开。</Text>}
          {devices.map(item => <Card key={item.device} padding={3} border radius={2}><Stack space={4}>
            <Text>iPhone · {code(item.device)}</Text>
            <Text size={1} muted>授权于 {new Date(item._createdAt).toLocaleDateString("zh-CN")}</Text>
            <Button text="撤销授权" mode="ghost" tone="critical" disabled={busy} onClick={() => change("revoke", item.device)} />
          </Stack></Card>)}
        </>}
    </Stack>
  </Container>;
}
