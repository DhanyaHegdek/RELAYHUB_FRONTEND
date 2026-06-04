export default function Toast({ toasts, onDismiss }) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="toast"
          onClick={() => {
            t.onClick?.();
            onDismiss(t.id);
          }}
        >
          <div
            className="toast-avatar"
            style={{
              background: `hsl(${[...(t.sender || "")].reduce((a, c) => a + c.charCodeAt(0), 0) % 360},50%,55%)`,
            }}
          >
            {t.sender
              ?.split(" ")
              .map((w) => w[0])
              .join("")
              .toUpperCase()
              .slice(0, 2) || "?"}
          </div>
          <div className="toast-body">
            <div className="toast-sender">{t.sender}</div>
            <div className="toast-msg">{t.message}</div>
          </div>
          <button
            className="toast-close"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(t.id);
            }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
