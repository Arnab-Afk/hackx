package api

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/gorilla/websocket"
	"golang.org/x/crypto/ssh"
)

// sshControlMsg is a JSON text-frame sent by the client to resize the pty.
type sshControlMsg struct {
	Type string `json:"type"` // "resize" | "ping"
	Cols uint32 `json:"cols"`
	Rows uint32 `json:"rows"`
}

// wsWriter serialises concurrent writes to a WebSocket connection.
type wsWriter struct {
	mu   sync.Mutex
	conn *websocket.Conn
}

func (w *wsWriter) Write(p []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if err := w.conn.WriteMessage(websocket.BinaryMessage, p); err != nil {
		return 0, err
	}
	return len(p), nil
}

func (w *wsWriter) writeJSON(v any) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.conn.WriteJSON(v)
}

// GET /workspaces/{containerID}/ssh — WebSocket SSH terminal gateway.
//
// Protocol:
//   - Binary frames (client→server): raw bytes forwarded to SSH stdin.
//   - Binary frames (server→client): raw bytes from SSH stdout+stderr.
//   - Text frames  (client→server): JSON control messages, e.g.
//     {"type":"resize","cols":220,"rows":50}
//
// Compatible with xterm.js + AttachAddon (binary) or any custom client.
// For CLI access: `websocat -b ws://host/workspaces/ID/ssh`
func (s *Server) sshGateway(w http.ResponseWriter, r *http.Request) {
	containerID := chi.URLParam(r, "containerID")

	ws, ok := s.mgr.GetWorkspaceInfo(containerID)
	if !ok {
		http.Error(w, "workspace not found (restart backend after creating workspace or use /workspaces/{id}/status first)", http.StatusNotFound)
		return
	}

	// Wait until SSH is actually up (status == "ready") before dialling.
	if ws.Status == "provisioning" {
		deadline := time.Now().Add(5 * time.Minute)
		for ws.Status == "provisioning" && time.Now().Before(deadline) {
			time.Sleep(2 * time.Second)
		}
	}
	if ws.Status != "ready" {
		http.Error(w, fmt.Sprintf("workspace not ready (status=%s)", ws.Status), http.StatusServiceUnavailable)
		return
	}

	// Upgrade to WebSocket first (before SSH dial) so we can send errors back.
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	out := &wsWriter{conn: conn}

	// Dial SSH into the container.
	sshCfg := &ssh.ClientConfig{
		User:            ws.Username,
		Auth:            []ssh.AuthMethod{ssh.Password(ws.Password)},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(), // internal only — workspace containers are ephemeral
		Timeout:         10 * time.Second,
	}

	addr := fmt.Sprintf("%s:%d", ws.SSHHost, ws.SSHPort)
	sshClient, err := ssh.Dial("tcp", addr, sshCfg)
	if err != nil {
		out.writeJSON(map[string]string{"type": "error", "message": fmt.Sprintf("ssh dial: %v", err)})
		log.Printf("[ssh-gateway] dial %s failed: %v", addr, err)
		return
	}
	defer sshClient.Close()

	// Open an SSH session.
	session, err := sshClient.NewSession()
	if err != nil {
		out.writeJSON(map[string]string{"type": "error", "message": fmt.Sprintf("ssh session: %v", err)})
		return
	}
	defer session.Close()

	// Request a PTY (xterm-256color so colours work in editors/btop etc.).
	modes := ssh.TerminalModes{
		ssh.ECHO:          1,
		ssh.TTY_OP_ISPEED: 38400,
		ssh.TTY_OP_OSPEED: 38400,
	}
	if err := session.RequestPty("xterm-256color", 24, 80, modes); err != nil {
		out.writeJSON(map[string]string{"type": "error", "message": fmt.Sprintf("pty: %v", err)})
		return
	}

	stdinPipe, err := session.StdinPipe()
	if err != nil {
		out.writeJSON(map[string]string{"type": "error", "message": fmt.Sprintf("stdin pipe: %v", err)})
		return
	}

	stdoutPipe, err := session.StdoutPipe()
	if err != nil {
		out.writeJSON(map[string]string{"type": "error", "message": fmt.Sprintf("stdout pipe: %v", err)})
		return
	}

	stderrPipe, err := session.StderrPipe()
	if err != nil {
		out.writeJSON(map[string]string{"type": "error", "message": fmt.Sprintf("stderr pipe: %v", err)})
		return
	}

	if err := session.Shell(); err != nil {
		out.writeJSON(map[string]string{"type": "error", "message": fmt.Sprintf("shell: %v", err)})
		return
	}

	log.Printf("[ssh-gateway] session open: container=%s user=%s addr=%s", containerID, ws.Username, addr)

	// SSH stdout → WebSocket (binary frames).
	go func() {
		buf := make([]byte, 8192)
		for {
			n, err := stdoutPipe.Read(buf)
			if n > 0 {
				out.Write(buf[:n]) //nolint:errcheck
			}
			if err != nil {
				if err != io.EOF {
					log.Printf("[ssh-gateway] stdout closed: %v", err)
				}
				out.writeJSON(map[string]string{"type": "close"}) //nolint:errcheck
				conn.Close()
				return
			}
		}
	}()

	// SSH stderr → WebSocket (binary frames, same channel as stdout).
	go func() {
		buf := make([]byte, 8192)
		for {
			n, err := stderrPipe.Read(buf)
			if n > 0 {
				out.Write(buf[:n]) //nolint:errcheck
			}
			if err != nil {
				return
			}
		}
	}()

	// WebSocket → SSH stdin / PTY resize.
	for {
		msgType, data, err := conn.ReadMessage()
		if err != nil {
			break
		}

		switch msgType {
		case websocket.BinaryMessage:
			stdinPipe.Write(data) //nolint:errcheck

		case websocket.TextMessage:
			var msg sshControlMsg
			if json.Unmarshal(data, &msg) != nil {
				continue
			}
			switch msg.Type {
			case "resize":
				if msg.Cols > 0 && msg.Rows > 0 {
					session.WindowChange(int(msg.Rows), int(msg.Cols)) //nolint:errcheck
				}
			}
		}
	}

	log.Printf("[ssh-gateway] session closed: container=%s", containerID)
}
