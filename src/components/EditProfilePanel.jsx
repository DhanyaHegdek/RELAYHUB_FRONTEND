import { useState, useEffect } from "react";
import api from "../api/axios";
import { useAuth } from "../context/useAuth";

function Avatar({ name, size = 64 }) {
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
      }}
    >
      {initials}
    </div>
  );
}

export default function EditProfilePanel({ onClose }) {
  const { login } = useAuth();

  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    bio: "",
    password: "",
    password_confirmation: "",
  });

  useEffect(() => {
    api.get("/api/profile").then(({ data }) => {
      setProfile(data);
      setForm({
        name: data.name || "",
        email: data.email || "",
        bio: data.bio || "",
        password: "",
        password_confirmation: "",
      });
    });
  }, []);

  const handleSave = async () => {
    setError("");
    setSuccess(false);
    setSaving(true);
    try {
      const payload = { name: form.name, email: form.email, bio: form.bio };
      if (form.password) {
        payload.password = form.password;
        payload.password_confirmation = form.password_confirmation;
      }
      const { data } = await api.put("/api/profile", payload);
      setProfile(data);
      setSuccess(true);
      setEditing(false);
      const token = localStorage.getItem("token");
      login(token, data);
    } catch (err) {
      const msgs = err.response?.data?.errors;
      setError(
        msgs
          ? Object.values(msgs).flat().join(" ")
          : err.response?.data?.message || "Failed to save.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setError("");
    if (profile)
      setForm({
        name: profile.name || "",
        email: profile.email || "",
        bio: profile.bio || "",
        password: "",
        password_confirmation: "",
      });
  };

  return (
    <div className="ep-panel">
      <div className="ep-header">
        <span className="ep-title">My Profile</span>
        <button className="ep-close" onClick={onClose}>
          ✕
        </button>
      </div>

      {!profile ? (
        <div className="ep-loading">Loading…</div>
      ) : (
        <div className="ep-body">
          <div className="ep-avatar-section">
            <Avatar name={form.name || profile.name} size={72} />
            <div className={`ep-role-badge ep-role-${profile.role}`}>
              {profile.role}
            </div>
          </div>

          {success && <div className="ep-success">✅ Profile updated!</div>}
          {error && <div className="ep-error">{error}</div>}

          <div className="ep-fields">
            <div className="ep-field">
              <label>Name</label>
              {editing ? (
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="ep-input"
                />
              ) : (
                <div className="ep-value">{profile.name}</div>
              )}
            </div>

            <div className="ep-field">
              <label>Email</label>
              {editing ? (
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="ep-input"
                />
              ) : (
                <div className="ep-value">{profile.email}</div>
              )}
            </div>

            <div className="ep-field">
              <label>Bio</label>
              {editing ? (
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  className="ep-input ep-textarea"
                  placeholder="Tell something about yourself…"
                  rows={3}
                  maxLength={500}
                />
              ) : (
                <div className="ep-value ep-bio">
                  {profile.bio || (
                    <span className="ep-empty-bio">No bio yet</span>
                  )}
                </div>
              )}
            </div>

            {editing && (
              <>
                <div className="ep-field">
                  <label>
                    New Password{" "}
                    <span className="ep-optional">
                      (leave blank to keep current)
                    </span>
                  </label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                    className="ep-input"
                    placeholder="Min. 6 characters"
                  />
                </div>
                <div className="ep-field">
                  <label>Confirm Password</label>
                  <input
                    type="password"
                    value={form.password_confirmation}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        password_confirmation: e.target.value,
                      })
                    }
                    className="ep-input"
                    placeholder="Repeat new password"
                  />
                </div>
              </>
            )}
          </div>

          <div className="ep-actions">
            {editing ? (
              <>
                <button className="ep-btn-cancel" onClick={handleCancel}>
                  Cancel
                </button>
                <button
                  className="ep-btn-save"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </>
            ) : (
              <button
                className="ep-btn-edit"
                onClick={() => {
                  setEditing(true);
                  setSuccess(false);
                }}
              >
                ✏️ Edit Profile
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
