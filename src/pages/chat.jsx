import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/useAuth";
import Echo from "laravel-echo";
import Pusher from "pusher-js";
import Toast from "../components/Toast";
import { useNotifications } from "../hooks/useNotifications";
import EditProfilePanel from "../components/EditProfilePanel";

window.Pusher = Pusher;
// const echo = new Echo({
//   broadcaster: "reverb",
//   key: import.meta.env.VITE_REVERB_APP_KEY,
//   wsHost: import.meta.env.VITE_REVERB_HOST,
//   wsPort: import.meta.env.VITE_REVERB_PORT,
//   forceTLS: false,
//   enabledTransports: ["ws"],
//   authEndpoint: "http://relayhub.test/api/broadcasting/auth",
//   auth: {
//     headers: {
//       Authorization: `Bearer ${localStorage.getItem("token")}`,
//       Accept: "application/json",
//     },
//   },
// });

// ─── Avatar
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

// ─── New Chat Modal
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

function MessageBubble({ msg, isOwn, onReply }) {
  const isImage = msg.file_type ? msg.file_type.indexOf("image/") === 0 : false;
  const hasFile = msg.file_path ? true : false;
  const fileUrl = hasFile
    ? "http://relayhub.test/storage/" + msg.file_path
    : null;

  const formatSize = (bytes) => {
    if (!bytes) return "";
    if (bytes < 1048576) return Math.round(bytes / 1024) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  };

  return (
    <div className={"msg-row " + (isOwn ? "own" : "other")}>
      {!isOwn && <Avatar name={msg.sender ? msg.sender.name : ""} size={30} />}
      <div className="msg-wrap">
        {msg.reply_to && (
          <div className="msg-reply-quote">
            <span className="msg-reply-name">
              {msg.reply_to.sender ? msg.reply_to.sender.name : ""}
            </span>
            <span className="msg-reply-body">{msg.reply_to.body}</span>
          </div>
        )}
        <div className="bubble">
          {hasFile && isImage && (
            <a href={fileUrl} target="_blank" rel="noreferrer">
              <img src={fileUrl} alt={msg.file_name} className="msg-image" />
            </a>
          )}

          {hasFile && !isImage && (
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className="msg-file"
            >
              <span className="msg-file-icon">📄</span>
              <div className="msg-file-info">
                <div className="msg-file-name">{msg.file_name}</div>
                <div className="msg-file-size">{formatSize(msg.file_size)}</div>
              </div>
              <span className="msg-file-download">↓</span>
            </a>
          )}

          {msg.body && msg.body}

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
            hour12: true,
          })}
        </div>
      </div>
      {isOwn && <Avatar name={msg.sender ? msg.sender.name : ""} size={30} />}
    </div>
  );
}

function ProfileTabs({ activeConv, messages }) {
  const [tab, setTab] = useState("info");
  const [files, setFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  useEffect(() => {
    if (tab !== "media" || !activeConv) return;

    let cancelled = false;

    const fetchFiles = async () => {
      if (cancelled) return;
      setLoadingFiles(true); // still technically in effect, but now inside async fn
      try {
        const res = await api.get(`/api/conversations/${activeConv.id}/files`);
        if (!cancelled) setFiles(res.data);
      } catch {
        // handle error
      } finally {
        if (!cancelled) setLoadingFiles(false);
      }
    };

    fetchFiles();

    return () => {
      cancelled = true;
    }; // cleanup to avoid state updates on unmounted component
  }, [tab, activeConv]);

  const images = files.filter(function (f) {
    return f.file_type && f.file_type.indexOf("image/") === 0;
  });
  const docs = files.filter(function (f) {
    return !f.file_type || f.file_type.indexOf("image/") !== 0;
  });

  function formatSize(bytes) {
    if (!bytes) return "";
    if (bytes < 1048576) return Math.round(bytes / 1024) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  return (
    <div style={{ width: "100%" }}>
      <div className="profile-tabs">
        <button
          className={tab === "info" ? "profile-tab active" : "profile-tab"}
          onClick={function () {
            setTab("info");
          }}
        >
          Info
        </button>
        <button
          className={tab === "media" ? "profile-tab active" : "profile-tab"}
          onClick={function () {
            setTab("media");
          }}
        >
          Media
        </button>
      </div>

      {tab === "info" && (
        <div className="profile-tab-content">
          <div className="profile-section-title">Conversation Info</div>
          <div className="profile-stat">
            <span className="profile-stat-label">Messages</span>
            <span className="profile-stat-val">{messages.length}</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat-label">Started</span>
            <span className="profile-stat-val">
              {activeConv && activeConv.created_at
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
              {activeConv && activeConv.last_message_at
                ? new Date(activeConv.last_message_at).toLocaleDateString([], {
                    day: "numeric",
                    month: "short",
                  })
                : "Never"}
            </span>
          </div>
        </div>
      )}

      {tab === "media" && (
        <div className="profile-tab-content">
          {loadingFiles && <p className="media-empty">Loading...</p>}

          {!loadingFiles && files.length === 0 && (
            <p className="media-empty">No files shared yet</p>
          )}

          {images.length > 0 && (
            <div>
              <div className="profile-section-title">
                Photos ({images.length})
              </div>
              <div className="media-grid">
                {images.map(function (f) {
                  return (
                    <a
                      key={f.id}
                      href={"http://relayhub.test/storage/" + f.file_path}
                      target="_blank"
                      rel="noreferrer"
                      className="media-thumb"
                    >
                      <img
                        src={"http://relayhub.test/storage/" + f.file_path}
                        alt={f.file_name}
                      />
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {docs.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="profile-section-title">Files ({docs.length})</div>
              <div className="media-files-list">
                {docs.map(function (f) {
                  return (
                    <a
                      key={f.id}
                      href={"http://relayhub.test/storage/" + f.file_path}
                      target="_blank"
                      rel="noreferrer"
                      className="media-file-row"
                    >
                      <span className="media-file-icon">Doc</span>
                      <div className="media-file-info">
                        <div className="media-file-name">{f.file_name}</div>
                        <div className="media-file-meta">
                          {f.sender ? f.sender.name : ""} &bull;{" "}
                          {new Date(f.created_at).toLocaleDateString([], {
                            day: "numeric",
                            month: "short",
                          })}
                        </div>
                      </div>
                      <span className="media-file-size">
                        {formatSize(f.file_size)}
                      </span>
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main
export default function Chat() {
  const [fileUploading, setFileUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [storageInfo, setStorageInfo] = useState(null);

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { toasts, unread, notify, dismiss, clearUnread } = useNotifications();

  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());
  const [replyTo, setReplyTo] = useState(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const bottomRef = useRef(null);
  const activeConvRef = useRef(null); // ref to access activeConv inside echo callback
  const subscribedConvsRef = useRef(new Set());

  const echoRef = useRef(null);

  useEffect(() => {
    if (!echoRef.current) {
      echoRef.current = new Echo({
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
    }

    return () => {
      if (echoRef.current) {
        echoRef.current.disconnect();
        echoRef.current = null;
      }
    };
  }, []);

  // keep ref in sync with state
  useEffect(() => {
    activeConvRef.current = activeConv;
  }, [activeConv]);

  // ── Load conversations on mount ─────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get("/api/conversations");
        setConversations(data);
      } catch (err) {
        console.log(err);
      }
    };
    load();
  }, []);

  useEffect(() => {
    api
      .get("/api/storage-info")
      .then(function (res) {
        setStorageInfo(res.data);
      })
      .catch(function () {});
  }, []);

  const refreshConversations = useCallback(async () => {
    try {
      const { data } = await api.get("/api/conversations");
      setConversations(data);
    } catch (err) {
      console.log(err);
    }
  }, []);

  // ── Subscribe to ALL conversations for notifications
  // useEffect(() => {
  //   if (conversations.length === 0) return;

  //   conversations.map((conv) => {
  //     return echo
  //       .private(`conversation.${conv.id}`)
  //       .listen("MessageSent", (e) => {
  //         const msg = e.message;
  //         const currentConv = activeConvRef.current;

  //         // If message is in the ACTIVE conversation — just add it
  //         if (currentConv?.id === conv.id) {
  //           setMessages((prev) => {
  //             const exists = prev.some((m) => m.id === msg.id);
  //             return exists ? prev : [...prev, msg];
  //           });
  //           refreshConversations();
  //           return;
  //         }

  //         // If message is from another conversation — notify
  //         if (msg.sender_id !== user?.id) {
  //           notify({
  //             sender: msg.sender?.name || "Someone",
  //             message: msg.body,
  //             convId: conv.id,
  //             onConvClick: () => {
  //               setActiveConv(conv);
  //               setShowProfile(false);
  //             },
  //           });
  //           refreshConversations();
  //         }
  //       });
  //   });

  //   return () => {
  //     conversations.forEach((conv) => {
  //       echo.leave(`conversation.${conv.id}`);
  //     });
  //   };
  // }, [conversations, notify, refreshConversations, user?.id]);

  // Effect 1 — only subscribes to NEW conversations
  useEffect(() => {
    console.log("SUBSCRIBING TO CONVERSATIONS", conversations);
    conversations.forEach((conv) => {
      if (subscribedConvsRef.current.has(conv.id)) return;

      subscribedConvsRef.current.add(conv.id);

      echoRef.current
        .join(`conversation.${conv.id}`)

        .here((users) => {
          setOnlineUserIds((prev) => {
            const next = new Set(prev);
            users.forEach((u) => next.add(Number(u.id)));
            return next;
          });
        })
        .joining((u) => {
          setOnlineUserIds((prev) => new Set([...prev, Number(u.id)]));
        })
        .leaving((u) => {
          setOnlineUserIds((prev) => {
            const next = new Set(prev);
            next.delete(Number(u.id));
            return next;
          });
        })

        .listen("MessageSent", (e) => {
          const msg = e.message;
          const currentConv = activeConvRef.current;

          if (currentConv?.id === conv.id) {
            setMessages((prev) => {
              const exists = prev.some((m) => m.id === msg.id);
              return exists ? prev : [...prev, msg];
            });

            setConversations((prev) =>
              prev.map((c) =>
                c.id === conv.id
                  ? {
                      ...c,
                      latest_message: msg,
                      last_message_at: msg.created_at,
                    }
                  : c,
              ),
            );

            return;
          }

          if (msg.sender_id !== user?.id) {
            notify({
              sender: msg.sender?.name || "Someone",
              message: msg.file_name ? "📎 " + msg.file_name : msg.body,
              convId: conv.id,
              onConvClick: () => {
                setActiveConv(conv);
                setShowProfile(false);
              },
            });

            setConversations((prev) => {
              const updated = prev.map((c) =>
                c.id === conv.id
                  ? {
                      ...c,
                      latest_message: msg,
                      last_message_at: msg.created_at,
                    }
                  : c,
              );

              return [...updated].sort(
                (a, b) =>
                  new Date(b.last_message_at || 0) -
                  new Date(a.last_message_at || 0),
              );
            });
          }
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations]);

  // Effect 2 — cleanup ONLY on unmount
  useEffect(() => {
    const subscribedIds = subscribedConvsRef.current; // capture ref value
    return () => {
      subscribedIds.forEach((convId) => {
        echoRef.current.leave(`conversation.${convId}`);
      });
      subscribedIds.clear();
    };
  }, []);

  // ── Clear unread separately to avoid setState in effect body
  useEffect(() => {
    if (activeConv) clearUnread(activeConv.id);
  }, [activeConv, clearUnread]);

  // ── Load messages when switching conversation
  useEffect(() => {
    if (!activeConv) return;
    const load = async () => {
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
    load();
  }, [activeConv]);

  // ── Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const otherUser = (conv) => {
    if (!conv) return null;
    return conv.user_one?.id === user?.id ? conv.user_two : conv.user_one;
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
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConv.id
            ? { ...c, latest_message: data, last_message_at: data.created_at }
            : c,
        ),
      );
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

  const handleLogout = async () => {
    echoRef.current?.disconnect();
    subscribedConvsRef.current.clear();
    logout(); // clears localStorage + setUser(null) → triggers redirect
    // no navigate() needed — PrivateRoute handles it automatically
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeConv) return;

    // 10MB check on client side too
    if (file.size > 10 * 1024 * 1024) {
      alert("File too large. Maximum size is 10MB.");
      return;
    }

    setFileUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const { data } = await api.post(
        `/api/conversations/${activeConv.id}/upload`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );

      setMessages((prev) => [...prev, data]);
      await refreshConversations();
    } catch (err) {
      const msg = err.response?.data?.error;
      if (msg === "Storage quota exceeded") {
        const data = err.response.data;
        alert(
          "Storage full! Used: " +
            data.used +
            " of " +
            data.quota +
            ". Please contact admin.",
        );
      } else {
        alert("Upload failed. Please try again.");
      }
    } finally {
      setFileUploading(false);
      e.target.value = ""; // reset input
    }
  };

  const other = otherUser(activeConv);
  const isOtherOnline = onlineUserIds.has(Number(other?.id));

  return (
    <div className="chat-layout">
      {/* ── Toast notifications ── */}
      <Toast toasts={toasts} onDismiss={dismiss} />

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
            const unreadCount = unread[conv.id] || 0;
            return (
              <button
                key={conv.id}
                className={`conv-item ${isActive ? "active" : ""}`}
                onClick={() => {
                  setActiveConv(conv);
                  setShowProfile(false);
                  clearUnread(conv.id);
                }}
              >
                <div className="conv-avatar-wrap">
                  <Avatar name={o?.name} size={44} />
                  <span
                    className={
                      onlineUserIds.has(Number(o?.id))
                        ? "conv-dot online"
                        : "conv-dot"
                    }
                  />
                </div>
                <div className="conv-info">
                  <div className="conv-name">{o?.name}</div>
                  <div className="conv-preview">
                    {conv.latest_message?.file_name
                      ? "📎 " + conv.latest_message.file_name
                      : conv.latest_message?.body || "No messages yet"}
                  </div>
                </div>
                <div className="conv-right">
                  {conv.latest_message && (
                    <div className="conv-time">
                      {new Date(conv.last_message_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  )}
                  {unreadCount > 0 && (
                    <div className="unread-badge">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* {user?.email === "admin123@gmail.com" && ( */}
        {(user?.role === "admin" || user?.role === "super_admin") && (
          <div className="sidebar-admin-section">
            <button
              className="manage-users-btn"
              onClick={() => {
                echoRef.current?.disconnect();
                subscribedConvsRef.current.clear();
                navigate("/users");
              }}
            >
              <span className="manage-users-icon">👥</span>
              Manage Users
            </button>
          </div>
        )}

        {storageInfo && (
          <div className="storage-bar-wrap">
            <div className="storage-bar-label">
              <span>Storage</span>
              <span>
                {storageInfo.used_fmt} / {storageInfo.quota_fmt}
              </span>
            </div>
            <div className="storage-bar-track">
              <div
                className={
                  "storage-bar-fill" +
                  (storageInfo.percentage > 90
                    ? " danger"
                    : storageInfo.percentage > 70
                      ? " warning"
                      : "")
                }
                style={{ width: storageInfo.percentage + "%" }}
              />
            </div>
            <div className="storage-bar-pct">
              {storageInfo.percentage}% used
            </div>
          </div>
        )}
      </div>

      {/* ── Edit Profile Panel ── */}
      {showEditProfile && (
        <EditProfilePanel onClose={() => setShowEditProfile(false)} />
      )}

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
              <button
                className="msg-header-profile-btn"
                onClick={() => setShowProfile((v) => !v)}
                title="View profile"
              >
                <Avatar name={other?.name} size={38} />
                <div className="msg-header-info">
                  <div className="msg-header-name">{other?.name}</div>
                  <div className="msg-header-status">
                    <span
                      className={isOtherOnline ? "online-dot" : "offline-dot"}
                    />
                    {isOtherOnline ? "Online" : "Offline"}
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
                  <div className="reply-banner-preview">
                    {replyTo.file_name
                      ? "📎 " + replyTo.file_name
                      : replyTo.body}
                  </div>
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
              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                style={{ display: "none" }}
                accept="image/*,.pdf,.doc,.docx,.txt,.zip"
              />

              {/* File attach button */}
              <button
                className="attach-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={fileUploading || !activeConv}
                title="Attach file"
              >
                {fileUploading ? "⏳" : "📎"}
              </button>

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
      {showProfile && activeConv && (
        <div className="col-profile">
          <div className="profile-content">
            <button
              className="profile-close-btn"
              onClick={() => setShowProfile(false)}
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

            <ProfileTabs activeConv={activeConv} messages={messages} />
          </div>
        </div>
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
