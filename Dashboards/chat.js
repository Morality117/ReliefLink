// chat.js: the chat page.
//   USE_MOCK = true   -> a simple DEMO chat that stores messages in this browser (no backend needed)
//   USE_MOCK = false  -> the real Nexconn ChatUI (needs the backend running and a login)

import { attachNotificationListener } from "./notifications.js";

// ----- Who is using this page? Only residents and volunteers can chat. -----
const session = getSession(); // from js/api.js
if (!session || !session.user || (session.user.role !== "resident" && session.user.role !== "volunteer")) {
  window.location.href = LOGIN_PAGE;
  throw new Error("Not allowed");
}
const me = session.user;
document.querySelector("#user-name").textContent = me.name || me.email;
if (typeof renderTopbarAvatar === "function") renderTopbarAvatar(me);
document.querySelector("#back-link").href = homeFor(me.role);
document.querySelector("#logout").addEventListener("click", () => logout());

// ?with=<user id of the other person>&request=<request id>&withName=<optional name>
const params = new URLSearchParams(window.location.search);
const partnerId = params.get("with");
const requestId = params.get("request");
const toNexconnUserId = (id) =>
  id ? "rl" + String(id).replace(/-/g, "") : null;

const fromNexconnUserId = (ncId) => {
  const raw = String(ncId || "").trim();
  if (!/^rl[0-9a-f]{32}$/i.test(raw)) return null;
  const h = raw.slice(2).toLowerCase();
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

const nexconnMeId = toNexconnUserId(me.id);
const nexconnPartnerId = toNexconnUserId(partnerId);

const partnerLabel = me.role === "resident" ? "Volunteer" : "Citizen";
let partnerName = params.get("withName") || partnerLabel;

const statusBox = document.querySelector("#chat-status");
const pausedBanner = document.querySelector("#chat-paused-banner");
const partnerBanner = document.querySelector("#chat-partner-banner");

function updatePartnerBanner(name, avatarUrl) {
  if (!partnerBanner) return;
  if (name && (partnerId || avatarUrl)) {
    partnerBanner.innerHTML = "";
    if (avatarUrl) {
      const img = document.createElement("img");
      img.src = avatarUrl;
      img.alt = name;
      partnerBanner.appendChild(img);
    }
    const span = document.createElement("span");
    span.textContent = "Chatting with " + name;
    partnerBanner.appendChild(span);
    partnerBanner.hidden = false;
  } else {
    partnerBanner.hidden = true;
  }
}

function showStatus(text, bad) {
  statusBox.textContent = text;
  statusBox.className = bad ? "bad" : "";
  statusBox.style.display = text ? "block" : "none";
}

// Track active vs resolved requests/tasks so resolved conversations become read-only
let myItemsCache = [];
async function loadMyItems() {
  try {
    myItemsCache = me.role === "resident" ? await api.getMyRequests() : await api.getMyTasks();
  } catch (e) {
    myItemsCache = [];
  }
}

function isConversationPaused(targetNexconnOrUuid) {
  if (!targetNexconnOrUuid || !myItemsCache.length) return false;
  const targetUuid = fromNexconnUserId(targetNexconnOrUuid) || targetNexconnOrUuid;
  const related = myItemsCache.filter((item) =>
    me.role === "resident" ? item.volunteerId === targetUuid : item.residentId === targetUuid
  );
  if (!related.length) return false;
  const hasActive = related.some((item) =>
    item.status === "Assigned" || item.status === "In Progress"
  );
  return !hasActive;
}

function updatePausedUI(targetId) {
  const paused = isConversationPaused(targetId);
  if (paused) {
    pausedBanner.textContent =
      "This task is resolved. Chat history remains available, and sending new messages is paused.";
    pausedBanner.style.display = "block";
  } else {
    pausedBanner.style.display = "none";
  }
  return paused;
}

/* =====================================================================
   DEMO CHAT (mock mode)
   ===================================================================== */
const MOCK_CHAT_KEY = "relieflink_mock_chat_v2";

function loadMockChat() {
  try { return JSON.parse(localStorage.getItem(MOCK_CHAT_KEY)) || {}; } catch (e) { return {}; }
}
function saveMockChat(all) { localStorage.setItem(MOCK_CHAT_KEY, JSON.stringify(all)); }

function bubbleText(text) {
  const holder = el("div");
  text.split(/(https?:\/\/\S+)/).forEach((part) => {
    if (/^https?:\/\//.test(part)) {
      const a = el("a", null, part);
      a.href = part;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      holder.append(a);
    } else if (part) {
      holder.append(part);
    }
  });
  return holder;
}

async function startMockChat() {
  showStatus("Demo chat (mock mode). Messages are saved in this browser only. Set USE_MOCK = false in js/api.js for the real Nexconn chat.");
  updatePartnerBanner(partnerName);
  await loadMyItems();
  const paused = updatePausedUI(partnerId);

  const root = document.querySelector("#chatui-root");
  root.innerHTML = "";
  const box = el("div", "mock-chat");
  const header = el("div", "mock-header", "Chat with " + partnerName);
  const list = el("div", "mock-messages");
  const form = el("form", "mock-form");
  const input = el("input");
  input.type = "text";
  input.placeholder = paused ? "Task resolved — chat is read-only" : "Type a message...";
  input.disabled = paused;
  input.autocomplete = "off";
  const send = el("button", "btn primary", "Send");
  send.type = "submit";
  send.disabled = paused;
  const loc = el("button", "btn outline", "📍 Send my location");
  loc.type = "button";
  loc.disabled = paused;
  const sim = el("button", "btn outline", "Simulate a reply");
  sim.type = "button";
  sim.disabled = paused;
  form.append(input, send, loc, sim);
  box.append(header, list, form);
  root.append(box);

  const convKey = requestId || partnerId || "general";

  function render() {
    const messages = loadMockChat()[convKey] || [];
    list.innerHTML = "";
    if (messages.length === 0) list.append(el("p", "empty", "No messages yet. Say hello!"));
    messages.forEach((m) => {
      const mine = m.fromId === me.id;
      const bubble = el("div", "bubble " + (mine ? "me" : "them"));
      bubble.append(bubbleText(m.text));
      bubble.append(el("small", null, (mine ? "You" : m.name) + " · " + timeAgo(m.at)));
      list.append(bubble);
    });
    list.scrollTop = list.scrollHeight;
  }

  function add(fromId, name, text) {
    const all = loadMockChat();
    all[convKey] = all[convKey] || [];
    all[convKey].push({ fromId, name, text, at: Date.now() });
    saveMockChat(all);
    render();
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (paused) return;
    const text = input.value.trim();
    if (!text) return;
    add(me.id, me.name, text);
    input.value = "";
  });

  loc.addEventListener("click", () => {
    if (paused) return;
    if (!navigator.geolocation) { showStatus("Your browser can't share a location.", true); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        showStatus("Demo chat (mock mode). Messages are saved in this browser only.");
        add(me.id, me.name, "📍 My location: https://www.google.com/maps?q=" + pos.coords.latitude + "," + pos.coords.longitude);
      },
      () => showStatus("Couldn't get your location. Allow location access and try again.", true)
    );
  });

  sim.addEventListener("click", () => {
    if (!paused) add(partnerId || "partner", partnerName, "On my way! Stay where you are.");
  });

  window.addEventListener("storage", (e) => { if (e.key === MOCK_CHAT_KEY) render(); });
  render();
}

/* =====================================================================
   REAL CHAT (Nexconn ChatUI)
   ===================================================================== */

const PIN_ICON = "data:image/svg+xml;utf8," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#5a6784" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/>' +
  '<circle cx="12" cy="10" r="2.5"/></svg>'
);

const userProfileCache = new Map();

async function startRealChat() {
  showStatus("Connecting to chat...");

  const [
    { NCEngine, DirectChannelIdentifier, SendTextMessageParams, MessageHandler, BaseChannel },
    { NCChatUIApplication, ChatUIEvents },
    info,
  ] = await Promise.all([
    import("@nexconn/chat"),
    import("@nexconn/chatui"),
    api.getChatToken(requestId, partnerId),
    loadMyItems(),
  ]);

  const token = info && ((info.result && (info.result.accessToken || info.result.token)) || info.accessToken || info.token);
  const appKey = info && info.appKey;

  if (!appKey) {
    throw new Error("Backend did not return the Nexconn App Key.");
  }
  if (!token) {
    throw new Error("The backend did not send a chat token. Check the reply of POST /api/token.");
  }

  const effectiveMeName = (info.user && info.user.name) || me.name || me.email;
  const effectiveMeId = info.userId || nexconnMeId;
  document.querySelector("#user-name").textContent = effectiveMeName;

  const effectiveMeAvatar = (info.user && info.user.avatarUrl) || me.avatarUrl || "";
  if (typeof renderTopbarAvatar === "function") {
    renderTopbarAvatar({ ...me, name: effectiveMeName, avatarUrl: effectiveMeAvatar });
  }

  userProfileCache.set(effectiveMeId, {
    userId: effectiveMeId,
    name: effectiveMeName,
    avatarUrl: effectiveMeAvatar,
  });

  let partnerAvatar = "";
  if (info.partner && info.partner.nexconnId) {
    partnerName = info.partner.name || partnerName;
    partnerAvatar = info.partner.avatarUrl || "";
    userProfileCache.set(info.partner.nexconnId, {
      userId: info.partner.nexconnId,
      name: partnerName,
      avatarUrl: partnerAvatar,
    });
  } else if (nexconnPartnerId && partnerName && partnerName !== partnerLabel) {
    userProfileCache.set(nexconnPartnerId, {
      userId: nexconnPartnerId,
      name: partnerName,
      avatarUrl: "",
    });
  }

  updatePartnerBanner(partnerName, partnerAvatar);

  NCEngine.initialize({ appKey });

  const hooks = {
    reqUserProfiles: async (userIds) => {
      const missing = (userIds || []).filter((id) => !userProfileCache.has(id));
      if (missing.length) {
        try {
          const fetched = await api.getChatProfiles(missing);
          fetched.forEach((p) => {
            if (p && p.userId) {
              userProfileCache.set(p.userId, {
                userId: p.userId,
                name: p.name,
                avatarUrl: p.avatarUrl || "",
              });
            }
          });
        } catch (err) {
          console.warn("Could not fetch chat user profiles:", err.message);
        }
      }

      return (userIds || []).map((id) => {
        if (userProfileCache.has(id)) return userProfileCache.get(id);
        return {
          userId: id,
          name: id === effectiveMeId
            ? effectiveMeName
            : id === nexconnPartnerId
              ? partnerName
              : partnerLabel,
          avatarUrl: "",
        };
      });
    },
    reqGroupProfiles: async () => [],
    reqSystemProfiles: async () => [],
    reqGroupMembers: async () => [],
  };

  const app = NCChatUIApplication.initialize({ hooks, language: "en_US" });
  if (!app) throw new Error("ChatUI could not start in this browser.");

  let activeChannelId = nexconnPartnerId || null;

  // Add "Send my location" button to message input
  const menu = app.cloneInputMenu();
  menu.items.push({ id: "custom:location", order: 10, icon: PIN_ICON });
  app.setInputMenu(menu);

  const englishTexts = app.cloneLanguageEntries("en_US") || {};
  app.registerLanguagePack("en_US", { ...englishTexts, "custom:location": "Send my location" });

  app.addEventListener(ChatUIEvents.INPUT_MENU_ITEM_CLICK, (event) => {
    if (event.data.id !== "custom:location") return;
    const channelIdentifier = event.data.channelModel.channelIdentifier;
    if (isConversationPaused(channelIdentifier?.channelId || activeChannelId)) {
      showStatus("This task is resolved. Sending new messages is paused.", true);
      return;
    }

    if (!navigator.geolocation) { showStatus("Your browser can't share a location.", true); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const link = "https://www.google.com/maps?q=" + pos.coords.latitude + "," + pos.coords.longitude;
        app.sendMessage(channelIdentifier, new SendTextMessageParams({ text: "📍 My location: " + link }));
      },
      () => showStatus("Couldn't get your location. Allow location access and try again.", true)
    );
  });

  // Hide status banner when any conversation is selected and check if task is resolved
  app.addEventListener(ChatUIEvents.CHANNEL_SELECTED, (event) => {
    showStatus("");
    const chId =
      event?.data?.channelModel?.channelIdentifier?.channelId ||
      event?.data?.channelIdentifier?.channelId ||
      null;
    if (chId) {
      activeChannelId = chId;
      const cached = userProfileCache.get(chId);
      if (cached && cached.name) updatePartnerBanner(cached.name, cached.avatarUrl);
      updatePausedUI(chId);
    }
  });

  // Block sending new messages if the task with this partner is already resolved
  app.addEventListener(ChatUIEvents.MESSAGE_WILL_SEND, (event) => {
    const chId = event?.data?.channelIdentifier?.channelId || activeChannelId;
    if (isConversationPaused(chId)) {
      if (typeof event.preventDefault === "function") event.preventDefault();
      updatePausedUI(chId);
      showStatus("This task is resolved. Chat history is read-only.", true);
    }
  });

  app.ready();

  const result = await NCEngine.connect({ token });
  if (!result || result.code !== 0) {
    throw new Error(
      "Could not connect to Nexconn. Code: " + (result?.code ?? "unknown")
    );
  }

  document.querySelector("#chatui-root").append(document.createElement("nc-chat-ui-app-provider"));
  showStatus("");

  attachNotificationListener({
    NCEngine,
    MessageHandler,
    BaseChannel,
    nexconnMeId: effectiveMeId,
    meRole: me.role,
    getActiveChannelId: () => activeChannelId,
    onOpenChannel: (senderNexconnId, senderName) => {
      activeChannelId = senderNexconnId;
      showStatus("");
      const c = userProfileCache.get(senderNexconnId);
      updatePartnerBanner(senderName, c?.avatarUrl || "");
      updatePausedUI(senderNexconnId);
      app.openChannel(new DirectChannelIdentifier(senderNexconnId), true);
    },
  });

  if (partnerId && nexconnPartnerId) {
    const channelIdentifier = new DirectChannelIdentifier(nexconnPartnerId);
    activeChannelId = nexconnPartnerId;
    updatePausedUI(nexconnPartnerId);

    try {
      let openResult = null;
      for (let attempt = 1; attempt <= 25; attempt++) {
        openResult = await app.openChannel(channelIdentifier, true);
        if (openResult.code !== 39005) break;
        showStatus("Loading your conversations...");
        await new Promise((resolve) => setTimeout(resolve, 600));
      }

      if (openResult && openResult.isOk) {
        showStatus("");
      } else {
        showStatus(
          "Could not open the conversation. Code: " + (openResult?.code ?? "") + " " + (openResult?.msg || ""),
          true
        );
      }
    } catch (error) {
      console.error("Open channel failed:", error);
      showStatus(error.message, true);
    }
  } else {
    activeChannelId = null;
    showStatus("Pick a conversation from the list.");
  }
}

/* ===================================================================== */
if (USE_MOCK) {
  startMockChat();
} else {
  startRealChat().catch((err) => showStatus(err.message, true));
}
