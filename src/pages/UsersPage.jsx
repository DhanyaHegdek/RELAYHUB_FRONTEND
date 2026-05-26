import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/useAuth";

//  Avatar
function Avatar({ name, size = 36 }) {
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
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `hsl(${hue},50%,55%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        color: "#fff",
        fontSize: size * 0.37,
        flexShrink: 0,
        fontFamily: "inherit",
      }}
    >
      {initials}
    </div>
  );
}

// Create User Modal
function CreateUserModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "user",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/api/admin/users", form);
      onCreated();
      onClose();
    } catch (err) {
      const msgs = err.response?.data?.errors;
      setError(
        msgs
          ? Object.values(msgs).flat().join(" ")
          : err.response?.data?.message || "Failed to create user.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Create New User</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          {error && <div className="form-error">{error}</div>}
          <form onSubmit={handleSubmit} className="create-user-form">
            <div className="field">
              <label>Name</label>
              <input
                type="text"
                placeholder="Full name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                placeholder="email@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label>Password</label>
              <input
                type="password"
                placeholder="Min. 6 characters"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={6}
              />
            </div>
            <div className="field">
              <label>Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="role-select"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? "Creating…" : "Create User"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Create Profile Modal
function ProfileModal({ userId, onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/api/admin/users/${userId}`)
      .then(({ data }) => setProfile(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>User Profile</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">
          {loading ? (
            <p className="modal-empty">Loading…</p>
          ) : profile ? (
            <div className="profile-view">
              <Avatar name={profile.name} size={64} />
              <div className="profile-view-name">{profile.name}</div>
              <div className="profile-view-email">{profile.email}</div>
              <span className={`role-badge role-${profile.role}`}>
                {profile.role}
              </span>
              <div className="profile-view-meta">
                Joined{" "}
                {new Date(profile.created_at).toLocaleDateString([], {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </div>
            </div>
          ) : (
            <p className="modal-empty">User not found.</p>
          )}
        </div>
      </div>
    </div>
  );
}

//  Main
export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [viewProfileId, setViewProfileId] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [search, setSearch] = useState("");

  const fetchUsers = async () => {
    try {
      const { data } = await api.get("/api/admin/users");
      setUsers(data);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);

        const res = await api.get("/api/admin/users");

        setUsers(res.data);
      } catch (err) {
        console.log(err);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const handleChangeRole = async (userId, currentRole) => {
    const newRole = currentRole === "admin" ? "user" : "admin";
    setActionLoading(userId);
    try {
      await api.put(`/api/admin/users/${userId}/role`, { role: newRole });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)),
      );
    } catch (err) {
      console.log(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (userId) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    setActionLoading(userId);
    try {
      await api.delete(`/api/admin/users/${userId}`);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err) {
      alert(err.response?.data?.error || "Failed to delete user.");
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="up-page">
      {/* ── Top bar ── */}
      <div className="up-topbar">
        <div className="up-topbar-left">
          <button className="up-back-btn" onClick={() => navigate("/")}>
            ← Back to Chat
          </button>
          <div>
            <h1 className="up-title">Manage Users</h1>
            <p className="up-subtitle">{users.length} total users</p>
          </div>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          + Create User
        </button>
      </div>

      {/* ── Search ── */}
      <div className="up-search-row">
        <input
          className="up-search"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* ── Table ── */}
      <div className="up-card">
        {loading ? (
          <div className="up-empty">Loading users…</div>
        ) : filtered.length === 0 ? (
          <div className="up-empty">No users found.</div>
        ) : (
          <table className="up-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id}>
                  {/* User cell — avatar + name inline */}
                  <td>
                    <div className="up-user-cell">
                      <Avatar name={u.name} size={34} />
                      <span className="up-user-name">
                        {u.name}
                        {u.id === currentUser?.id && (
                          <span className="up-you">You</span>
                        )}
                      </span>
                    </div>
                  </td>

                  <td className="up-email">{u.email}</td>

                  <td>
                    <span className={`up-role up-role-${u.role}`}>
                      {u.role}
                    </span>
                  </td>

                  <td className="up-date">
                    {new Date(u.created_at).toLocaleDateString([], {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>

                  <td>
                    <div className="up-actions">
                      {/* View profile */}
                      <button
                        className="up-btn"
                        title="View Profile"
                        onClick={() => setViewProfileId(u.id)}
                      >
                        👤 Profile
                      </button>

                      {/* Change role */}
                      {u.id !== currentUser?.id && (
                        <button
                          className={`up-btn ${u.role === "admin" ? "up-btn-demote" : "up-btn-promote"}`}
                          onClick={() => handleChangeRole(u.id, u.role)}
                          disabled={actionLoading === u.id}
                        >
                          {actionLoading === u.id
                            ? "…"
                            : u.role === "admin"
                              ? "Make User"
                              : "Make Admin"}
                        </button>
                      )}

                      {/* Delete */}
                      {u.id !== currentUser?.id && (
                        <button
                          className="up-btn up-btn-delete"
                          onClick={() => handleDelete(u.id)}
                          disabled={actionLoading === u.id}
                        >
                          🗑 Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={fetchUsers}
        />
      )}
      {viewProfileId && (
        <ProfileModal
          userId={viewProfileId}
          onClose={() => setViewProfileId(null)}
        />
      )}
    </div>
  );
}
