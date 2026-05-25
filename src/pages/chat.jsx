import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/useAuth";
import Echo from "laravel-echo";
import Pusher from "pusher-js";

// ─── Echo singleton (module level is fine, just the instance) ─────────────────
window.Pusher = Pusher;
console.log(import.meta.env);
console.log(import.meta.env.VITE_REVERB_APP_KEY);
const echo = new Echo({
  broadcaster: "reverb",
  key: import.meta.env.VITE_REVERB_APP_KEY,
  wsHost: import.meta.env.VITE_REVERB_HOST,
  wsPort: import.meta.env.VITE_REVERB_PORT,
  forceTLS: false,
  enabledTransports: ["ws"],
  authEndpoint: "http://relayhub.test/api/broadcasting/auth",
  auth: {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      Accept: "application/json",
    },
  },
});

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, size = 40 }) {
  const initials =
    name
      ?.split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";
  const hue =
    [...(name || "")].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.37,
        background: `hsl(${hue},50%,55%)`,
      }}
    >
      {initials}
    </div>
  );
}

// ─── New Chat Modal ────────────────────────────────────────────────────────────
function NewChatModal({ onClose, onStart, currentUserId }) {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/api/users")
      .then(({ data }) => setUsers(data.filter((u) => u.id !== currentUserId)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [currentUserId]);

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>New Conversation</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <input
          className="modal-search"
          placeholder="Search users…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        <div className="modal-list">
          {loading && <p className="modal-empty">Loading…</p>}
          {!loading && filtered.length === 0 && (
            <p className="modal-empty">No users found</p>
          )}
          {filtered.map((u) => (
            <button
              key={u.id}
              className="modal-user"
              onClick={() => onStart(u)}
            >
              <Avatar name={u.name} size={38} />
              <div>
                <div className="modal-user-name">{u.name}</div>
                <div className="modal-user-email">{u.email}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Message Bubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg, isOwn, onReply }) {
  return (
    <div className={`msg-row ${isOwn ? "own" : "other"}`}>
      {!isOwn && <Avatar name={msg.sender?.name} size={30} />}
      <div className="msg-wrap">
        {msg.reply_to && (
          <div className="msg-reply-quote">
            <span className="msg-reply-name">{msg.reply_to.sender?.name}</span>
            <span className="msg-reply-body">{msg.reply_to.body}</span>
          </div>
        )}
        <div className="bubble">
          {msg.body}
          <button
            className="msg-reply-btn"
            title="Reply"
            onClick={() => onReply(msg)}
          >
            ↩
          </button>
        </div>
        <div className="msg-time">
          {new Date(msg.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>
      {isOwn && <Avatar name={msg.sender?.name} size={30} />}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Chat() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  // ── Load conversations on mount ─────────────────────────────────────────────
  useEffect(() => {
    const loadConversations = async () => {
      try {
        const { data } = await api.get("/api/conversations");
        setConversations(data);
      } catch (err) {
        console.log(err);
      }
    };
    loadConversations();
  }, []);

  // ── refreshConversations — declared before the useEffects that call it ───────
  const refreshConversations = useCallback(async () => {
    try {
      const { data } = await api.get("/api/conversations");
      setConversations(data);
    } catch (err) {
      console.log(err);
    }
  }, []);

  // ── Load messages + subscribe to Reverb when activeConv changes ─────────────
  useEffect(() => {
    if (!activeConv) return;

    // Load existing messages via REST
    const loadMessages = async () => {
      setLoadingMsgs(true);
      try {
        const { data } = await api.get(
          `/api/conversations/${activeConv.id}/messages`,
        );
        setMessages(data);
      } catch (err) {
        console.log(err);
      } finally {
        setLoadingMsgs(false);
      }
    };
    loadMessages();

    // Subscribe to the private channel for this conversation
    echo.private(`conversation.${activeConv.id}`).listen("MessageSent", (e) => {
      // Only add incoming messages (not our own — we already add those optimistically)
      setMessages((prev) => {
        const alreadyExists = prev.some((m) => m.id === e.message.id);
        return alreadyExists ? prev : [...prev, e.message];
      });
      // Refresh sidebar preview
      refreshConversations();
    });

    // Cleanup: leave channel when switching conversations or unmounting
    return () => {
      echo.leave(`conversation.${activeConv.id}`);
    };
  }, [activeConv, refreshConversations]);

  // ── Auto-scroll to bottom ───────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const otherUser = (conv) => {
    if (!conv) return null;
    return conv.user_one?.id === user?.id ? conv.user_two : conv.user_one;
  };

  const handleSend = async () => {
    if (!text.trim() || !activeConv || sending) return;
    setSending(true);
    try {
      const payload = { body: text.trim() };
      if (replyTo) payload.reply_to_id = replyTo.id;
      const { data } = await api.post(
        `/api/conversations/${activeConv.id}/messages`,
        payload,
      );
      // Optimistically add our own message immediately
      setMessages((prev) => [...prev, data]);
      setText("");
      setReplyTo(null);
      await refreshConversations();
    } catch (err) {
      console.log(err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStartConversation = async (targetUser) => {
    try {
      const { data } = await api.post("/api/conversations", {
        user_id: targetUser.id,
      });
      setShowNewChat(false);
      await refreshConversations();
      setActiveConv(data);
    } catch (err) {
      console.log(err);
    }
  };

  const handleLogout = async () => {
    try {
      await api.post("/api/logout");
    } catch (err) {
      console.log(err);
    }
    logout();
    navigate("/login");
  };

  const other = otherUser(activeConv);

  return (
    <div className="chat-layout">
      {/* ── Col 1: Sidebar ── */}
      <div className="col-sidebar">
        <div className="sidebar-topbar">
          <div className="sidebar-brand">
            <span className="brand-hex">⬡</span>
            <span className="brand-name">Relayhub</span>
          </div>
          <div className="sidebar-actions">
            <button
              className="icon-btn"
              title="New chat"
              onClick={() => setShowNewChat(true)}
            >
              ✎
            </button>
            <button
              className="icon-btn danger"
              title="Logout"
              onClick={handleLogout}
            >
              ⏻
            </button>
          </div>
        </div>

        <div className="sidebar-me">
          <Avatar name={user?.name} size={34} />
          <span className="sidebar-me-name">{user?.name}</span>
          <span className="online-dot" />
        </div>

        <div className="sidebar-search-wrap">
          <input
            className="sidebar-search"
            placeholder="Search conversations…"
          />
        </div>

        <div className="conv-scroll">
          {conversations.length === 0 && (
            <p className="conv-empty">
              No conversations yet.
              <br />
              Start one with ✎
            </p>
          )}
          {conversations.map((conv) => {
            const o = otherUser(conv);
            const isActive = activeConv?.id === conv.id;
            return (
              <button
                key={conv.id}
                className={`conv-item ${isActive ? "active" : ""}`}
                onClick={() => setActiveConv(conv)}
              >
                <div className="conv-avatar-wrap">
                  <Avatar name={o?.name} size={44} />
                  <span className="conv-dot" />
                </div>
                <div className="conv-info">
                  <div className="conv-name">{o?.name}</div>
                  <div className="conv-preview">
                    {conv.latest_message?.body || "No messages yet"}
                  </div>
                </div>
                {conv.latest_message && (
                  <div className="conv-time">
                    {new Date(conv.last_message_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Col 2: Messages ── */}
      <div className="col-messages">
        {!activeConv ? (
          <div className="no-conv">
            <div className="no-conv-icon">⬡</div>
            <p>Pick a conversation or start a new one</p>
            <button
              className="btn-primary"
              onClick={() => setShowNewChat(true)}
            >
              New Conversation
            </button>
          </div>
        ) : (
          <>
            <div className="msg-header">
              <Avatar name={other?.name} size={38} />
              <div className="msg-header-info">
                <div className="msg-header-name">{other?.name}</div>
                <div className="msg-header-status">
                  <span className="online-dot" /> Online
                </div>
              </div>
              <div className="msg-header-actions">
                <button className="icon-btn-light">🔍</button>
                <button className="icon-btn-light">⋯</button>
              </div>
            </div>

            <div className="messages-scroll">
              {loadingMsgs && <p className="msgs-loading">Loading…</p>}
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  isOwn={msg.sender_id === user?.id}
                  onReply={setReplyTo}
                />
              ))}
              <div ref={bottomRef} />
            </div>

            {replyTo && (
              <div className="reply-banner">
                <div>
                  <div className="reply-banner-label">
                    ↩ Replying to {replyTo.sender?.name}
                  </div>
                  <div className="reply-banner-preview">{replyTo.body}</div>
                </div>
                <button
                  className="reply-cancel"
                  onClick={() => setReplyTo(null)}
                >
                  ✕
                </button>
              </div>
            )}

            <div className="input-row">
              <textarea
                className="msg-input"
                placeholder="Type your message here…"
                rows={1}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button
                className="send-btn"
                onClick={handleSend}
                disabled={!text.trim() || sending}
              >
                {sending ? "…" : "↑"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Col 3: Profile Panel ── */}
      <div className="col-profile">
        {!activeConv ? (
          <div className="profile-empty">Select a chat to see details</div>
        ) : (
          <div className="profile-content">
            <div className="profile-avatar-wrap">
              <Avatar name={other?.name} size={80} />
            </div>
            <div className="profile-name">{other?.name}</div>
            <div className="profile-email">{other?.email}</div>
            <div className="profile-badge">Active</div>

            <div className="profile-divider" />

            <div className="profile-section-title">Conversation Info</div>
            <div className="profile-stat">
              <span className="profile-stat-label">Messages</span>
              <span className="profile-stat-val">{messages.length}</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat-label">Started</span>
              <span className="profile-stat-val">
                {activeConv?.created_at
                  ? new Date(activeConv.created_at).toLocaleDateString([], {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "—"}
              </span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat-label">Last message</span>
              <span className="profile-stat-val">
                {activeConv?.last_message_at
                  ? new Date(activeConv.last_message_at).toLocaleDateString(
                      [],
                      { day: "numeric", month: "short" },
                    )
                  : "Never"}
              </span>
            </div>

            <div className="profile-divider" />

            <button
              className="profile-action-btn danger"
              onClick={handleLogout}
            >
              Sign Out
            </button>
          </div>
        )}
      </div>

      {showNewChat && (
        <NewChatModal
          onClose={() => setShowNewChat(false)}
          onStart={handleStartConversation}
          currentUserId={user?.id}
        />
      )}
    </div>
  );
}
