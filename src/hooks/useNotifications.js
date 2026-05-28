import { useState, useCallback, useEffect } from "react";

let toastId = 0;

export function useNotifications() {
  const [toasts, setToasts] = useState([]);
  const [unread, setUnread] = useState({}); // { convId: count }

  // Request browser notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    ({ sender, message, convId, onConvClick }) => {
      const id = ++toastId;

      // ── In-app toast ──────────────────────────────────────────────────────────
      setToasts((prev) => [
        ...prev,
        {
          id,
          sender,
          message: message.length > 60 ? message.slice(0, 60) + "…" : message,
          onClick: onConvClick,
        },
      ]);

      // Auto-dismiss after 4 seconds
      setTimeout(() => dismiss(id), 4000);

      // ── Unread badge ──────────────────────────────────────────────────────────
      setUnread((prev) => ({
        ...prev,
        [convId]: (prev[convId] || 0) + 1,
      }));

      // ── Browser notification ──────────────────────────────────────────────────
      if (
        "Notification" in window &&
        Notification.permission === "granted" &&
        document.hidden
      ) {
        const n = new Notification(`Relayhub — ${sender}`, {
          body: message,
          icon: "/favicon.ico",
          tag: `conv-${convId}`,
        });
        n.onclick = () => {
          window.focus();
          onConvClick?.();
          n.close();
        };
      }
    },
    [dismiss],
  );

  const clearUnread = useCallback((convId) => {
    setUnread((prev) => {
      const next = { ...prev };
      delete next[convId];
      return next;
    });
  }, []);

  return { toasts, unread, notify, dismiss, clearUnread };
}
