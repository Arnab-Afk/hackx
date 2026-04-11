"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Sidebar } from "@/components/Sidebar";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8081";
const WS_API = API.replace(/^http/, "ws");

type WorkspaceStatus = {
  container_id: string;
  running: boolean;
  status: string;
};

export default function WorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<import("@xterm/xterm").Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitRef = useRef<import("@xterm/addon-fit").FitAddon | null>(null);

  const [status, setStatus] = useState<WorkspaceStatus | null>(null);
  const [connected, setConnected] = useState(false);
  const [appPort, setAppPort] = useState<number | null>(null);

  // Fetch workspace status
  useEffect(() => {
    fetch(`${API}/workspaces/${id}/status`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setStatus(d))
      .catch(() => null);
  }, [id]);

  // Init xterm + connect WebSocket
  useEffect(() => {
    let term: import("@xterm/xterm").Terminal;
    let fit: import("@xterm/addon-fit").FitAddon;

    async function init() {
      const { Terminal } = await import("@xterm/xterm");
      const { FitAddon } = await import("@xterm/addon-fit");
      await import("@xterm/xterm/css/xterm.css");

      term = new Terminal({
        theme: {
          background: "#0A0A0A",
          foreground: "#E5E7EB",
          cursor: "#7c45ff",
          selectionBackground: "rgba(124,69,255,0.3)",
        },
        fontFamily: "'Space Mono', 'Courier New', monospace",
        fontSize: 13,
        lineHeight: 1.4,
        cursorBlink: true,
        scrollback: 5000,
      });

      fit = new FitAddon();
      term.loadAddon(fit);
      xtermRef.current = term;
      fitRef.current = fit;

      if (termRef.current) {
        term.open(termRef.current);
        fit.fit();
      }

      term.writeln("\x1b[1;35m  zkLOUD Workspace Terminal\x1b[0m");
      term.writeln("\x1b[90m  Connecting to " + id + "…\x1b[0m");
      term.writeln("");

      connectSSH(term, fit);
    }

    init();

    const handleResize = () => fitRef.current?.fit();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      wsRef.current?.close();
      xtermRef.current?.dispose();
    };
  }, [id]);

  function connectSSH(term: import("@xterm/xterm").Terminal, fit: import("@xterm/addon-fit").FitAddon) {
    const wsURL = `${WS_API}/workspaces/${id}/ssh`;
    const ws = new WebSocket(wsURL);
    wsRef.current = ws;
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      setConnected(true);
      term.writeln("\x1b[32m  Connected ✓\x1b[0m");
      term.writeln("");

      // Send initial resize
      const { cols, rows } = term;
      ws.send(JSON.stringify({ type: "resize", cols, rows }));

      // Forward terminal input as binary frames
      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(new TextEncoder().encode(data));
        }
      });

      // Forward resize events
      term.onResize(({ cols, rows }) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "resize", cols, rows }));
        }
        fit.fit();
      });
    };

    ws.onmessage = (e) => {
      if (typeof e.data === "string") {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "close") {
            setConnected(false);
            term.writeln("\r\n\x1b[31m  Connection closed\x1b[0m");
          }
        } catch {
          term.write(e.data);
        }
      } else {
        // Binary frame = raw terminal output
        term.write(new Uint8Array(e.data));
      }
    };

    ws.onerror = () => {
      setConnected(false);
      term.writeln("\r\n\x1b[31m  WebSocket error — is the workspace running?\x1b[0m");
    };

    ws.onclose = () => {
      setConnected(false);
    };
  }

  function reconnect() {
    wsRef.current?.close();
    const term = xtermRef.current;
    const fit = fitRef.current;
    if (term && fit) {
      term.writeln("\r\n\x1b[90m  Reconnecting…\x1b[0m");
      connectSSH(term, fit);
    }
  }

  const appHost = typeof window !== "undefined" ? window.location.hostname : "server";

  return (
    <div style={{ display: "flex", height: "100vh", background: "#0A0A0A", fontFamily: "Inter, sans-serif", color: "#E5E7EB" }}>
      <Sidebar mode="user" />

      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #2C2C2E", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Link href="/deploy" style={{ fontSize: 13, color: "#6B7280", textDecoration: "none" }}>← Deploy</Link>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#F9FAFB" }}>Workspace Terminal</p>
              <p style={{ fontSize: 11, fontFamily: "monospace", color: "#6B7280" }}>{id}</p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* App URL */}
            {appPort && (
              <a
                href={`http://${appHost}:${appPort}`}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 12, padding: "6px 12px", borderRadius: 8, background: "rgba(124,69,255,0.1)", border: "1px solid rgba(124,69,255,0.3)", color: "#7c45ff", textDecoration: "none", fontWeight: 600 }}
              >
                Open App ↗
              </a>
            )}

            {/* Status badge */}
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: connected ? "rgba(40,167,69,0.1)" : "rgba(107,114,128,0.1)", border: `1px solid ${connected ? "rgba(40,167,69,0.3)" : "#2C2C2E"}` }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: connected ? "#28A745" : "#6B7280" }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: connected ? "#28A745" : "#6B7280" }}>
                {connected ? "Connected" : "Disconnected"}
              </span>
            </div>

            <button
              onClick={reconnect}
              style={{ padding: "6px 12px", borderRadius: 8, background: "#2A2A2D", color: "#E5E7EB", fontSize: 12, fontWeight: 600, border: "1px solid #2C2C2E", cursor: "pointer" }}
            >
              Reconnect
            </button>
          </div>
        </div>

        {/* Info bar */}
        {status && (
          <div style={{ padding: "8px 24px", borderBottom: "1px solid #1C1C1E", display: "flex", gap: 24, background: "#111113", flexShrink: 0 }}>
            {[
              { label: "Container", value: id.slice(0, 12) },
              { label: "Status", value: status.running ? "Running" : "Stopped" },
              { label: "Encryption", value: "LUKS2 AES-256" },
              { label: "Network", value: "Bridge (isolated)" },
            ].map((i) => (
              <div key={i.label} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "#4B5563" }}>{i.label}:</span>
                <span style={{ fontSize: 11, fontFamily: "monospace", color: "#9CA3AF" }}>{i.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Terminal */}
        <div
          ref={termRef}
          style={{ flex: 1, overflow: "hidden", padding: "8px" }}
        />
      </main>
    </div>
  );
}
