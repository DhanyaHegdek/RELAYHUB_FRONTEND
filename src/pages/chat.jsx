import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/useAuth";
import Echo from "laravel-echo";
import Pusher from "pusher-js";
import EditProfilePanel from "../components/EditProfilePanel";

window.Pusher = Pusher;
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
  const [showProfile, setShowProfile] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const bottomRef = useRef(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

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

  const refreshConversations = useCallback(async () => {
    try {
      const { data } = await api.get("/api/conversations");
      setConversations(data);
    } catch (err) {
      console.log(err);
    }
  }, []);

  useEffect(() => {
    if (!activeConv) return;

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

    echo.private(`conversation.${activeConv.id}`).listen("MessageSent", (e) => {
      setMessages((prev) => {
        const alreadyExists = prev.some((m) => m.id === e.message.id);
        return alreadyExists ? prev : [...prev, e.message];
      });
      refreshConversations();
    });

    return () => {
      echo.leave(`conversation.${activeConv.id}`);
    };
  }, [activeConv, refreshConversations]);

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
      setShowProfile(false);
    } catch (err) {
      console.log(err);
    }
  };

  const handleSearch = async (q) => {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const { data } = await api.get(
        `/api/conversations/${activeConv.id}/messages/search`,
        { params: { q } },
      );
      setSearchResults(data);
    } catch (err) {
      console.log(err);
    } finally {
      setSearching(false);
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

        <button
          className="sidebar-me sidebar-me-btn"
          onClick={() => setShowEditProfile((v) => !v)}
          title="Edit profile"
        >
          <Avatar name={user?.name} size={34} />
          <span className="sidebar-me-name">{user?.name}</span>
          <span className="online-dot" />
        </button>

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
                onClick={() => {
                  setActiveConv(conv);
                  setShowProfile(false);
                }}
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

        {user?.role === "admin" && (
          <div className="sidebar-admin-section">
            <button
              className="manage-users-btn"
              onClick={() => navigate("/users")}
            >
              <span className="manage-users-icon">👥</span>
              Manage Users
            </button>
          </div>
        )}
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
            {/* Click avatar/name to toggle profile panel */}
            <div className="msg-header">
              <button
                className="msg-header-profile-btn"
                onClick={() => setShowProfile((v) => !v)}
                title="View profile"
              >
                <Avatar name={other?.name} size={38} />
                <div className="msg-header-info">
                  <div className="msg-header-name">{other?.name}</div>
                  <div className="msg-header-status">
                    <span className="online-dot" /> Online
                  </div>
                </div>
              </button>
              <div className="msg-header-actions">
                <button
                  className="icon-btn-light"
                  onClick={() => {
                    setShowSearch(!showSearch);
                    setSearchQuery("");
                    setSearchResults([]);
                  }}
                >
                  🔍
                </button>
                <button className="icon-btn-light">⋯</button>
              </div>
            </div>

            {showSearch && (
              <div className="search-panel">
                <div className="search-input-wrap">
                  <input
                    className="search-input"
                    placeholder="Search messages…"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    autoFocus
                  />
                  {searching && <span className="search-spinner">⏳</span>}
                </div>

                {searchQuery && (
                  <div className="search-results">
                    {searchResults.length === 0 && !searching && (
                      <p className="search-empty">
                        No messages found for "{searchQuery}"
                      </p>
                    )}
                    {searchResults.map((msg) => (
                      <button
                        key={msg.id}
                        className="search-result-item"
                        onClick={() => {
                          // Scroll to message and highlight it
                          const el = document.getElementById(`msg-${msg.id}`);
                          if (el) {
                            el.scrollIntoView({
                              behavior: "smooth",
                              block: "center",
                            });
                            el.classList.add("highlight");
                            setTimeout(
                              () => el.classList.remove("highlight"),
                              2000,
                            );
                          }
                          setShowSearch(false);
                          setSearchQuery("");
                          setSearchResults([]);
                        }}
                      >
                        <div className="search-result-sender">
                          {msg.sender?.name}
                        </div>
                        <div className="search-result-body">
                          {msg.body
                            .replace(
                              new RegExp(`(${searchQuery})`, "gi"),
                              "**$1**",
                            )
                            .split("**")
                            .map((part, i) =>
                              part.toLowerCase() ===
                              searchQuery.toLowerCase() ? (
                                <mark key={i}>{part}</mark>
                              ) : (
                                part
                              ),
                            )}
                        </div>
                        <div className="search-result-time">
                          {new Date(msg.created_at).toLocaleString([], {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="messages-scroll">
              {loadingMsgs && <p className="msgs-loading">Loading…</p>}
              {messages.map((msg) => (
                <div id={`msg-${msg.id}`} key={msg.id}>
                  <MessageBubble
                    msg={msg}
                    isOwn={msg.sender_id === user?.id}
                    onReply={setReplyTo}
                  />
                </div>
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

      {/* ── Col 3: Profile Panel — only renders when showProfile = true ── */}
      {showProfile && activeConv && (
        <div className="col-profile">
          <div className="profile-content">
            <button
              className="profile-close-btn"
              onClick={() => setShowProfile(false)}
              title="Close"
            >
              ✕
            </button>
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
                      {
                        day: "numeric",
                        month: "short",
                      },
                    )
                  : "Never"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Profile Panel ── */}
      {showEditProfile && (
        <EditProfilePanel onClose={() => setShowEditProfile(false)} />
      )}

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
