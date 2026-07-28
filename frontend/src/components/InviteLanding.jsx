import React, { useState, useEffect } from "react";
import { EnvelopeIcon, ExclamationTriangleIcon, UserGroupIcon, CheckCircleIcon, LockClosedIcon, GlobeAltIcon, ChatBubbleOvalLeftEllipsisIcon } from "@heroicons/react/24/solid";



import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import LoginForm from "./LoginForm";
import "../styles/wishlist.css";
import "../styles/nav-auth.css";

export default function InviteLanding({ onOpenLoginModal }) {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [inviteInfo, setInviteInfo] = useState(null);
  const [error, setError] = useState(null);
  const [joining, setJoining] = useState(false);
  const [showInlineLogin, setShowInlineLogin] = useState(false);

  useEffect(() => {
    if (token) {
      localStorage.setItem("pending_invite_token", token);
    }

    const fetchInvite = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/playgroups/invites/${token}`);
        if (res.ok) {
          const data = await res.json();
          setInviteInfo(data);
        } else {
          const data = await res.json();
          setError(data.error || "Invite link is invalid or expired.");
        }
      } catch (err) {
        console.error("Failed to load invite:", err);
        setError("Failed to connect to server. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchInvite();
  }, [token]);

  const handleAcceptInvite = async () => {
    if (!token) return;
    try {
      setJoining(true);
      const authToken = localStorage.getItem("token");
      const res = await fetch("/api/playgroups/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ invite_token: token })
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.removeItem("pending_invite_token");
        showToast(` Success! You joined "${data.name}"`, "success");
        navigate("/wishlist");
      } else {
        const data = await res.json();
        showToast(`Failed to join: ${data.error}`, "error");
      }
    } catch (err) {
      console.error("Error joining playgroup:", err);
      showToast("Failed to join playgroup. Please try again.", "error");
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        maxWidth: "500px",
        margin: "4rem auto",
        padding: "2rem",
        textAlign: "center",
        color: "#94a3b8",
        background: "#0f172a",
        borderRadius: "12px",
        border: "1px solid rgba(255,255,255,0.08)"
      }}>
        <h2 style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}><EnvelopeIcon style={{ width: "1.5em", height: "1.5em" }} /> Checking Invite Link...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        maxWidth: "500px",
        margin: "4rem auto",
        padding: "2.5rem",
        textAlign: "center",
        background: "#0f172a",
        borderRadius: "16px",
        border: "1px solid #ef4444",
        boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
        color: "#f87171"
      }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "1rem" }}><ExclamationTriangleIcon style={{ width: "3rem", height: "3rem" }} /></div>
        <h2 style={{ color: "#f87171", margin: "0 0 0.5rem 0" }}>Invalid Invite Link</h2>
        <p style={{ color: "#94a3b8", marginBottom: "1.5rem" }}>{error}</p>
        <button
          onClick={() => navigate("/wishlist")}
          style={{
            background: "#3b82f6",
            color: "white",
            border: "none",
            padding: "0.75rem 1.5rem",
            borderRadius: "8px",
            fontWeight: "bold",
            cursor: "pointer"
          }}
        >
          Return to Hub
        </button>
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: "540px",
      margin: "4rem auto",
      padding: "2.5rem",
      background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
      borderRadius: "16px",
      border: "1px solid rgba(255,255,255,0.1)",
      boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
      color: "#f8fafc",
      textAlign: "center"
    }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "0.5rem" }}><UserGroupIcon style={{ width: "3.5rem", height: "3.5rem" }} /></div>
      <span style={{
        background: "rgba(59, 130, 246, 0.2)",
        color: "#60a5fa",
        padding: "0.25rem 0.75rem",
        borderRadius: "12px",
        fontSize: "0.85rem",
        fontWeight: "bold",
        textTransform: "uppercase",
        letterSpacing: "0.05em"
      }}>
        Private Playgroup Invite
      </span>

      <h1 style={{ fontSize: "1.8rem", margin: "1rem 0 0.5rem 0" }}>
        Join {inviteInfo?.playgroup_name}
      </h1>
      
      <p style={{ color: "#94a3b8", fontSize: "0.95rem", margin: "0 0 2rem 0" }}>
        Invited by <strong style={{ color: "#38bdf8" }}>{inviteInfo?.inviter_username}</strong>
      </p>

      {user ? (
        <div>
          <p style={{ color: "#cbd5e1", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
            Logged in as <strong>{user.username || user.email}</strong>. Click below to accept the invitation and gain access to shared wishlists and proxy orders.
          </p>
          <button
            onClick={handleAcceptInvite}
            disabled={joining}
            style={{
              width: "100%",
              padding: "0.85rem 1.5rem",
              background: joining ? "#475569" : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              color: "white",
              fontSize: "1rem",
              fontWeight: "bold",
              border: "none",
              borderRadius: "10px",
              cursor: joining ? "not-allowed" : "pointer",
              boxShadow: "0 4px 14px rgba(16, 185, 129, 0.4)",
              transition: "all 0.2s ease"
            }}
          >
            {joining ? "Joining Playgroup..." : <><CheckCircleIcon style={{ width: "1.2em", height: "1.2em", verticalAlign: "middle", marginRight: "6px" }} /> Accept & Join Playgroup</>}
          </button>
        </div>
      ) : (
        <div>
          <p style={{ color: "#cbd5e1", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
            To join this private playgroup, please log in or create an account. You will automatically be added upon signing in.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <button
              onClick={() => setShowInlineLogin(!showInlineLogin)}
              style={{
                width: "100%",
                padding: "0.85rem 1.5rem",
                background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                color: "white",
                fontSize: "1rem",
                fontWeight: "bold",
                border: "none",
                borderRadius: "10px",
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(59, 130, 246, 0.4)"
              }}
            >
              {showInlineLogin ? "Hide Login Form" : <><LockClosedIcon style={{ width: "1.2em", height: "1.2em", verticalAlign: "middle", marginRight: "6px" }} /> Log In / Create Account</>}
            </button>

            <a
              href="/api/auth/google"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                width: "100%",
                padding: "0.75rem 1.5rem",
                background: "rgba(255,255,255,0.08)",
                color: "#f8fafc",
                fontSize: "0.95rem",
                fontWeight: "600",
                textDecoration: "none",
                borderRadius: "10px",
                border: "1px solid rgba(255,255,255,0.15)",
                boxSizing: "border-box"
              }}
            >
              <GlobeAltIcon style={{ width: "1.2em", height: "1.2em", verticalAlign: "middle", marginRight: "6px" }} /> Sign in with Google
            </a>

            <a
              href="/api/auth/discord"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                width: "100%",
                padding: "0.75rem 1.5rem",
                background: "rgba(88, 101, 242, 0.2)",
                color: "#818cf8",
                fontSize: "0.95rem",
                fontWeight: "600",
                textDecoration: "none",
                borderRadius: "10px",
                border: "1px solid rgba(88, 101, 242, 0.4)",
                boxSizing: "border-box"
              }}
            >
              <ChatBubbleOvalLeftEllipsisIcon style={{ width: "1.2em", height: "1.2em", verticalAlign: "middle", marginRight: "6px" }} /> Sign in with Discord
            </a>
          </div>

          {showInlineLogin && (
            <div style={{ marginTop: "1.5rem", textAlign: "left" }}>
              <LoginForm onSuccess={() => navigate("/wishlist")} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
