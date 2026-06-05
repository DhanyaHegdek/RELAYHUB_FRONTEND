import { useState, useEffect } from "react";
import { AuthContext } from "./AuthContext";
import api from "../api/axios";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // ← add loading state

  // On mount — re-fetch user from server to get fresh role
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      Promise.resolve().then(() => setLoading(false));
      return;
    }

    api
      .get("/api/me")
      .then(({ data }) => {
        localStorage.setItem("user", JSON.stringify(data));
        setUser(data);
      })
      .catch(() => {
        // Token expired or invalid — clear everything
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = (token, userData) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  const hasRole = (role) => {
    if (!user || !user.role) return false;
    return user.role === role;
  };

  // Don't render the app until we know who the user is
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "#0f0f1a",
          color: "rgba(255,255,255,0.4)",
          fontSize: 14,
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}
