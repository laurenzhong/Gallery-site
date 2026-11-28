import {
  createListenLogic,
  createNode,
  createNodeMachine,
  DOMAIN,
  MSG_DISCONNECT,
  MSG_HANDSHAKE_ACK,
  MSG_HANDSHAKE_SYN,
  MSG_HANDSHAKE_SYN_ACK,
  MSG_HEARTBEAT,
  MSG_RESPONSE,
  type ProtocolMessage,
} from "@sanity/comlink";
import { createCompatibilityActors, type LoaderControllerMsg, type LoaderNodeMsg } from "@sanity/presentation-comlink";

type QuerySubscription = Pick<
  Extract<LoaderNodeMsg, { type: "loader/query-listen" }>["data"],
  "projectId" | "dataset" | "query" | "params"
>;

const heartbeat = 15_000;

const legacyMessageTypes = new Map<string, string>([
  ["handshake/syn", MSG_HANDSHAKE_SYN],
  ["handshake/syn-ack", MSG_HANDSHAKE_SYN_ACK],
  ["handshake/ack", MSG_HANDSHAKE_ACK],
  ["channel/disconnect", MSG_DISCONNECT],
  ["channel/heartbeat", MSG_HEARTBEAT],
  ["channel/response", MSG_RESPONSE],
]);

const listenForLoaderMessages = createListenLogic((event) => {
  const data = event.data as (ProtocolMessage & { connectionId?: string }) | null;
  if (data?.domain !== "sanity/channels" || data.to !== "loaders" || !data.connectionId) return event;

  // The visual editing bridge also listens on window. Leave its legacy
  // messages intact and give the loader its own normalized event.
  return new MessageEvent(event.type, {
    data: {
      ...data,
      domain: DOMAIN,
      channelId: data.connectionId,
      type: legacyMessageTypes.get(data.type) ?? data.type,
    },
    origin: event.origin,
    source: event.source,
  });
});

export function connectStudioPreview<T>(subscription: QuerySubscription, onResult: (result: T) => void) {
  const node = createNode<LoaderNodeMsg, LoaderControllerMsg>(
    { name: "loaders", connectTo: "presentation" },
    createNodeMachine<LoaderNodeMsg, LoaderControllerMsg>().provide({
      actors: { ...createCompatibilityActors(), listen: listenForLoaderMessages },
    }),
  );
  let perspective: Extract<LoaderControllerMsg, { type: "loader/perspective" }>["data"]["perspective"] = "drafts";
  let connected = false;
  const results = new Map<string, T>();

  const listen = () => {
    if (connected) node.post("loader/query-listen", { ...subscription, perspective, heartbeat });
  };

  const offStatus = node.onStatus((status) => {
    connected = status === "connected";
    listen();
  });
  const offPerspective = node.on("loader/perspective", (message) => {
    if (message.projectId !== subscription.projectId || message.dataset !== subscription.dataset) return;
    perspective = message.perspective;
    const cached = results.get(JSON.stringify(perspective));
    if (cached !== undefined) onResult(cached);
    listen();
  });
  const offQuery = node.on("loader/query-change", (message) => {
    if (
      message.projectId === subscription.projectId &&
      message.dataset === subscription.dataset &&
      message.query === subscription.query &&
      JSON.stringify(message.params) === JSON.stringify(subscription.params) &&
      message.result != null
    ) {
      const key = JSON.stringify(message.perspective);
      const result = message.result as T;
      results.set(key, result);
      if (key === JSON.stringify(perspective)) onResult(result);
    }
  });
  const stop = node.start();
  const interval = window.setInterval(listen, heartbeat / 3);

  return () => {
    window.clearInterval(interval);
    offStatus();
    offPerspective();
    offQuery();
    stop();
  };
}
