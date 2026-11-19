// notifications.js: Real-time incoming message toast notifications & unread badge
// Works on Citizen Dashboard, Volunteer Dashboard, Request page, and Chat page.

const TOAST_CONTAINER_ID = "rl-toast-container";
const SEEN_MSG_KEY = "relieflink_notified_msgs_v1";

function getSeenMessageIds() {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(SEEN_MSG_KEY) || "[]"));
  } catch (e) {
    return new Set();
  }
}

function markMessageSeen(id) {
  if (!id) return false;
  const seen = getSeenMessageIds();
  if (seen.has(id)) return true;
  seen.add(id);
  const arr = [...seen].slice(-100);
  try {
    sessionStorage.setItem(SEEN_MSG_KEY, JSON.stringify(arr));
  } catch (e) {}
  return false;
}

function ensureToastContainer() {
  let box = document.getElementById(TOAST_CONTAINER_ID);
  if (!box) {
    box = document.createElement("div");
    box.id = TOAST_CONTAINER_ID;
    box.className = "rl-toast-container";
    box.setAttribute("aria-live", "polite");
    document.body.appendChild(box);
  }
  return box;
}

function formatMessagePreview(msg) {
  if (!msg) return "New message";
  const content = msg.content || {};
  if (typeof content.text === "string" && content.text.trim()) {
    const txt = content.text.trim();
    return txt.length > 90 ? txt.slice(0, 87) + "..." : txt;
  }
  if (typeof content.content === "string" && content.content.trim()) {
    const txt = content.content.trim();
    return txt.length > 90 ? txt.slice(0, 87) + "..." : txt;
  }
  const type = String(msg.messageType || "").toLowerCase();
  if (type.includes("img") || type.includes("image")) return "Sent a photo";
  if (type.includes("lbs") || type.includes("location")) return "Shared a location";
  if (type.includes("file")) return "Sent a file";
  if (type.includes("vc") || type.includes("voice")) return "Sent a voice message";
  return "Sent you a new message";
}

function fromNexconnId(nexconnId) {
  const raw = String(nexconnId || "").trim();
  if (!/^rl[0-9a-f]{32}$/i.test(raw)) return null;
  const h = raw.slice(2).toLowerCase();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function showMessageToast({ senderName, senderAvatar, preview, href, onClick }) {
  const container = ensureToastContainer();
  const toast = document.createElement("div");
  toast.className = "rl-toast";
  toast.setAttribute("role", "status");

  const initial = (senderName || "U").trim().charAt(0).toUpperCase();

  const avatar = document.createElement("div");
  avatar.className = "rl-toast-avatar";
  if (senderAvatar) {
    const img = document.createElement("img");
    img.src = senderAvatar;
    img.alt = senderName || "Avatar";
    avatar.appendChild(img);
  } else {
    avatar.textContent = initial;
  }

  const body = document.createElement("div");
  body.className = "rl-toast-body";

  const title = document.createElement("div");
  title.className = "rl-toast-title";
  title.textContent = senderName || "New message";

  const text = document.createElement("div");
  text.className = "rl-toast-text";
  text.textContent = preview || "Sent you a message";

  const action = document.createElement("div");
  action.className = "rl-toast-action";
  action.textContent = "Click to open conversation →";

  body.append(title, text, action);

  const closeBtn = document.createElement("button");
  closeBtn.className = "rl-toast-close";
  closeBtn.type = "button";
  closeBtn.setAttribute("aria-label", "Dismiss notification");
  closeBtn.textContent = "×";
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toast.remove();
  });

  toast.append(avatar, body, closeBtn);

  toast.addEventListener("click", () => {
    toast.remove();
    if (typeof onClick === "function") {
      onClick();
    } else if (href) {
      window.location.href = href;
    }
  });

  container.appendChild(toast);

  // Keep max 4 toasts visible
  while (container.children.length > 4) {
    container.firstElementChild.remove();
  }

  setTimeout(() => {
    if (toast.isConnected) {
      toast.classList.add("rl-toast-hide");
      setTimeout(() => toast.remove(), 250);
    }
  }, 7000);
}

export function updateUnreadBadge(count) {
  const badge = document.querySelector("#chat-unread-badge");
  if (!badge) return;
  const num = Number(count) || 0;
  if (num > 0) {
    badge.textContent = num > 99 ? "99+" : String(num);
    badge.hidden = false;
  } else {
    badge.textContent = "0";
    badge.hidden = true;
  }
}

const profileCache = new Map();

async function resolveSenderProfile(nexconnId) {
  if (!nexconnId) return { name: "ReliefLink User", supabaseId: null };
  if (profileCache.has(nexconnId)) return profileCache.get(nexconnId);

  try {
    const profiles = await api.getChatProfiles([nexconnId]);
    if (Array.isArray(profiles) && profiles.length) {
      const p = profiles[0];
      profileCache.set(nexconnId, p);
      return p;
    }
  } catch (e) {}

  const fallback = {
    userId: nexconnId,
    supabaseId: fromNexconnId(nexconnId),
    name: "New Message",
  };
  return fallback;
}

async function findMatchingRequestId(senderSupabaseId, role) {
  if (!senderSupabaseId) return null;
  try {
    if (role === "resident") {
      const list = await api.getMyRequests();
      const match = list.find(
        (r) => r.volunteerId === senderSupabaseId && (r.status === "Assigned" || r.status === "In Progress")
      ) || list.find((r) => r.volunteerId === senderSupabaseId);
      return match ? match.id : null;
    }
    if (role === "volunteer") {
      const list = await api.getMyTasks();
      const match = list.find(
        (t) => t.residentId === senderSupabaseId && (t.status === "Assigned" || t.status === "In Progress")
      ) || list.find((t) => t.residentId === senderSupabaseId);
      return match ? match.id : null;
    }
  } catch (e) {}
  return null;
}

export function attachNotificationListener({
  NCEngine,
  MessageHandler,
  BaseChannel,
  nexconnMeId,
  meRole,
  getActiveChannelId,
  onOpenChannel,
}) {
  const refreshUnread = async () => {
    try {
      if (BaseChannel && typeof BaseChannel.getTotalUnreadCount === "function") {
        const res = await BaseChannel.getTotalUnreadCount();
        if (res && res.isOk) {
          updateUnreadBadge(res.data || 0);
        }
      }
    } catch (e) {}
  };

  refreshUnread();

  NCEngine.addMessageHandler(
    "relieflink-global-notify",
    new MessageHandler({
      async onMessageReceived({ messages }) {
        if (!Array.isArray(messages)) return;
        refreshUnread();

        for (const msg of messages) {
          if (!msg || msg.senderUserId === nexconnMeId) continue;

          const activeId = typeof getActiveChannelId === "function" ? getActiveChannelId() : null;
          if (activeId && msg.channelId === activeId) continue;

          const dedupId = msg.messageUId || `${msg.channelId}-${msg.sentTime}-${msg.senderUserId}`;
          if (markMessageSeen(dedupId)) continue;

          const sender = await resolveSenderProfile(msg.senderUserId);
          const senderSupabaseId = sender.supabaseId || fromNexconnId(msg.senderUserId);
          const preview = formatMessagePreview(msg);

          if (typeof onOpenChannel === "function") {
            showMessageToast({
              senderName: sender.name,
              senderAvatar: sender.avatarUrl || "",
              preview,
              onClick: () => onOpenChannel(msg.senderUserId, sender.name),
            });
          } else {
            const reqId = await findMatchingRequestId(senderSupabaseId, meRole);
            const params = new URLSearchParams();
            if (senderSupabaseId) params.set("with", senderSupabaseId);
            if (reqId) params.set("request", reqId);
            if (sender.name) params.set("withName", sender.name);

            showMessageToast({
              senderName: sender.name,
              senderAvatar: sender.avatarUrl || "",
              preview,
              href: "chat.html?" + params.toString(),
            });
          }
        }
      },
    })
  );
}

export async function initDashboardNotifications() {
  const session = typeof getSession === "function" ? getSession() : null;
  if (!session || !session.user) return;
  const me = session.user;
  if (me.role !== "resident" && me.role !== "volunteer") return;

  if (typeof USE_MOCK !== "undefined" && USE_MOCK) {
    window.addEventListener("storage", (e) => {
      if (e.key !== "relieflink_mock_chat_v2") return;
      try {
        const all = JSON.parse(e.newValue || "{}");
        Object.entries(all).forEach(([reqId, msgs]) => {
          const last = Array.isArray(msgs) ? msgs[msgs.length - 1] : null;
          if (!last || last.fromId === me.id) return;
          const dedupId = `mock-${reqId}-${last.at}-${last.fromId}`;
          if (markMessageSeen(dedupId)) return;
          showMessageToast({
            senderName: last.name || "New message",
            preview: last.text,
            href: `chat.html?with=${encodeURIComponent(last.fromId)}&request=${encodeURIComponent(reqId)}&withName=${encodeURIComponent(last.name || "")}`,
          });
        });
      } catch (err) {}
    });
    return;
  }

  try {
    const [{ NCEngine, MessageHandler, BaseChannel }, info] = await Promise.all([
      import("@nexconn/chat"),
      api.getChatToken(),
    ]);

    const token = info && ((info.result && (info.result.accessToken || info.result.token)) || info.accessToken || info.token);
    const appKey = info && info.appKey;
    if (!appKey || !token) return;

    NCEngine.initialize({ appKey });
    const conn = await NCEngine.connect({ token });
    if (!conn || conn.code !== 0) return;

    const nexconnMeId = info.userId || "rl" + String(me.id).replace(/-/g, "");
    attachNotificationListener({
      NCEngine,
      MessageHandler,
      BaseChannel,
      nexconnMeId,
      meRole: me.role,
      getActiveChannelId: () => null,
    });
  } catch (e) {
    // Fail silently so dashboard usability is never disrupted if chat is temporarily unreachable
    console.warn("Background chat notifications unavailable:", e.message);
  }
}
