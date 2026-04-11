package container

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"net"
	"strings"
	"time"

	"github.com/moby/moby/api/types/container"
	dockerclient "github.com/moby/moby/client"
)

const workspaceImage = "ubuntu:22.04"

// WorkspaceConfig defines the resource spec for a user workspace.
type WorkspaceConfig struct {
	TeamID   string
	RAMMb    int64   // e.g. 2048
	CPUCores float64 // e.g. 2.0
}

// WorkspaceInfo is returned after the workspace is ready.
type WorkspaceInfo struct {
	ContainerID string    `json:"container_id"`
	TeamID      string    `json:"team_id"`
	SSHHost     string    `json:"ssh_host"`
	SSHPort     int       `json:"ssh_port"`
	Username    string    `json:"username"`
	Password    string    `json:"password"`
	RAMMb       int64     `json:"ram_mb"`
	CPUCores    float64   `json:"cpu_cores"`
	Status      string    `json:"status"` // "provisioning" | "ready" | "failed"
	CreatedAt   time.Time `json:"created_at"`
}

// AllocateWorkspace creates an Ubuntu container with host networking (for
// internet access), SSH + sudo, resource limits, and waits until SSH is ready.
func (m *Manager) AllocateWorkspace(ctx context.Context, cfg WorkspaceConfig) (*WorkspaceInfo, error) {
	password := randomHex(16)
	username := "hackx"

	// Pick a free port on the host for sshd to bind to.
	// With network_mode: host, port bindings are ignored — sshd must listen on
	// a specific port we choose here.
	sshPort, err := freePort()
	if err != nil {
		return nil, fmt.Errorf("find free port: %w", err)
	}

	// Inline setup script. Runs as PID 1; sshd takes over at the end.
	setup := fmt.Sprintf(`
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq openssh-server sudo curl wget git vim nano unzip build-essential
useradd -m -s /bin/bash %s
echo '%s:%s' | chpasswd
usermod -aG sudo %s
echo '%s ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers
mkdir -p /run/sshd
echo 'PasswordAuthentication yes' >> /etc/ssh/sshd_config
echo 'PermitRootLogin no' >> /etc/ssh/sshd_config
echo 'Port %d' >> /etc/ssh/sshd_config
ssh-keygen -A -q
cat > /etc/motd << 'EOF'

  zkLOUD Workspace
  ----------------
  RAM:  %d MB (enforced via cgroups)
  CPUs: %.1f cores (enforced via cgroups)

  Note: system tools (btop/free/nproc) show host totals.
  Your actual limits are enforced by the kernel.

EOF
exec /usr/sbin/sshd -D
`, username, username, password, username, username, sshPort, cfg.RAMMb, cfg.CPUCores)

	// Pull image (no-op if already cached).
	pull, err := m.client.ImagePull(ctx, workspaceImage, dockerclient.ImagePullOptions{})
	if err != nil {
		return nil, fmt.Errorf("pull %s: %w", workspaceImage, err)
	}
	io.Copy(io.Discard, pull)
	pull.Close()

	resp, err := m.client.ContainerCreate(ctx, dockerclient.ContainerCreateOptions{
		Name: fmt.Sprintf("zkloud-ws-%s-%d", cfg.TeamID, time.Now().UnixNano()),
		Config: &container.Config{
			Image: workspaceImage,
			Cmd:   []string{"/bin/bash", "-c", setup},
			Labels: map[string]string{
				"zkloud.team": cfg.TeamID,
				"zkloud.type": "workspace",
			},
		},
		HostConfig: &container.HostConfig{
			// Host networking gives the container full internet access and
			// lets sshd bind directly to the chosen host port.
			NetworkMode: "host",
			Resources: container.Resources{
				Memory:   cfg.RAMMb * 1024 * 1024,
				NanoCPUs: int64(cfg.CPUCores * 1e9),
			},
			// Expose Docker socket so the agent can build/run containers inside.
			Binds: []string{"/var/run/docker.sock:/var/run/docker.sock"},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("create workspace container: %w", err)
	}

	if _, err := m.client.ContainerStart(ctx, resp.ID, dockerclient.ContainerStartOptions{}); err != nil {
		return nil, fmt.Errorf("start workspace: %w", err)
	}

	ws := &WorkspaceInfo{
		ContainerID: resp.ID[:12],
		TeamID:      cfg.TeamID,
		SSHHost:     "localhost",
		SSHPort:     sshPort,
		Username:    username,
		Password:    password,
		RAMMb:       cfg.RAMMb,
		CPUCores:    cfg.CPUCores,
		Status:      "provisioning",
		CreatedAt:   time.Now().UTC(),
	}

	// Poll for SSH readiness in the background — client can check status via GET /workspaces/:id/status
	go func() {
		if waitForSSH(fmt.Sprintf("localhost:%d", sshPort), 5*time.Minute) {
			ws.Status = "ready"
		} else {
			ws.Status = "failed"
		}
	}()

	return ws, nil
}

// freePort asks the OS for an available TCP port.
func freePort() (int, error) {
	l, err := net.Listen("tcp", "localhost:0")
	if err != nil {
		return 0, err
	}
	port := l.Addr().(*net.TCPAddr).Port
	l.Close()
	return port, nil
}

// waitForSSH polls addr until the SSH banner (SSH-2.0-...) is received,
// meaning sshd is actually ready to accept logins.
func waitForSSH(addr string, timeout time.Duration) bool {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		conn, err := net.DialTimeout("tcp", addr, 2*time.Second)
		if err == nil {
			buf := make([]byte, 32)
			conn.SetReadDeadline(time.Now().Add(2 * time.Second))
			n, _ := conn.Read(buf)
			conn.Close()
			if n > 0 && strings.HasPrefix(string(buf[:n]), "SSH-") {
				return true
			}
		}
		time.Sleep(3 * time.Second)
	}
	return false
}

func randomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
