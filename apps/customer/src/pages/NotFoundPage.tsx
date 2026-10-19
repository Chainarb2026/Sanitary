import React from "react";
import { Link } from "react-router-dom";
import { AlertCircle } from "lucide-react";

export const NotFoundPage: React.FC = () => {
  return (
    <div
      className="glass-card"
      style={{ textAlign: "center", padding: "48px 16px", marginTop: "24px" }}
    >
      <AlertCircle size={40} color="var(--color-rose)" style={{ margin: "0 auto 12px" }} />
      <h2>Page Not Found</h2>
      <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "6px" }}>
        The page you are looking for does not exist or has been moved.
      </p>
      <Link to="/" className="btn btn-primary" style={{ marginTop: "20px" }}>
        Back to Home
      </Link>
    </div>
  );
};
