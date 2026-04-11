package container

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"net"
	"net/netip"
	"time"

	"github.com/moby/moby/api/types/container"
	"github.com/moby/moby/api/types/network"
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
	CreatedAt   time.Time `json:"created_at"`
}

// AllocateWorkspace creates an Ubuntu container with SSH + sudo, waits until
// SSH is accepting connections, then returns credentials.
func (m *Manager) AllocateWorkspace(ctx context.Context, cfg WorkspaceConfig) (*WorkspaceInfo, error) {
	password := randomHex(16)
	username := "hackx"

	// Inline setup script: installs SSH, creates user, starts sshd in foreground.
	// This runs as PID 1 so the container stays alive as long as sshd is running.
	setup := fmt.Sprintf(`
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq openssh-server sudo curl wget git vim nano unzip build-essential docker.io 2>/dev/null
useradd -m -s /bin/bash %s
echo '%s:%s' | chpasswd
usermod -aG sudo %s
usermod -aG docker %s
echo '%s ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers
mkdir -p /run/sshd
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config
echo 'PasswordAuthentication yes' >> /etc/ssh/sshd_config
echo 'PermitRootLogin no' >> /etc/ssh/sshd_config
ssh-keygen -A -q
exec /usr/sbin/sshd -D
`, username, username, password, username, username, username)

	// Pull image (no-op if already present).
	pull, err := m.client.ImagePull(ctx, workspaceImage, dockerclient.ImagePullOptions{})
	if err != nil {
		return nil, fmt.Errorf("pull %s: %w", workspaceImage, err)
	}
	io.Copy(io.Discard, pull)
	pull.Close()

	sshPort, _ := network.ParsePort("22/tcp")
	anyAddr := netip.MustParseAddr("0.0.0.0")

	resp, err := m.client.ContainerCreate(ctx, dockerclient.ContainerCreateOptions{
		Name: fmt.Sprintf("zkloud-ws-%s-%d", cfg.TeamID, time.Now().UnixNano()),
		Config: &container.Config{
			Image: workspaceImage,
			// Run the setup script as PID 1; sshd takes over at the end.
			Cmd: []string{"/bin/bash", "-c", setup},
			ExposedPorts: network.PortSet{
				sshPort: struct{}{},
			},
			Labels: map[string]string{
				"zkloud.team": cfg.TeamID,
				"zkloud.type": "workspace",
			},
		},
		HostConfig: &container.HostConfig{
			Resources: container.Resources{
				Memory:   cfg.RAMMb * 1024 * 1024,
				NanoCPUs: int64(cfg.CPUCores * 1e9),
			},
			// Random host port for SSH.
			PortBindings: network.PortMap{
				sshPort: []network.PortBinding{
					{HostIP: anyAddr, HostPort: ""},
				},
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

	// Inspect to discover the dynamically assigned SSH host port.
	info, err := m.client.ContainerInspect(ctx, resp.ID, dockerclient.ContainerInspectOptions{})
	if err != nil {
		return nil, fmt.Errorf("inspect workspace: %w", err)
	}

	hostPort := 0
	if bindings, ok := info.Container.NetworkSettings.Ports[sshPort]; ok && len(bindings) > 0 {
		fmt.Sscanf(string(bindings[0].HostPort), "%d", &hostPort)
	}
	if hostPort == 0 {
		return nil, fmt.Errorf("could not determine SSH host port")
	}

	sshAddr := fmt.Sprintf("localhost:%d", hostPort)

	// Wait up to 3 minutes for SSH to come up (apt-get takes ~30-60s).
	if !waitForPort(sshAddr, 3*time.Minute) {
		return nil, fmt.Errorf("SSH did not become ready within 3 minutes (container %s)", resp.ID[:12])
	}

	return &WorkspaceInfo{
		ContainerID: resp.ID[:12],
		TeamID:      cfg.TeamID,
		SSHHost:     "localhost",
		SSHPort:     hostPort,
		Username:    username,
		Password:    password,
		RAMMb:       cfg.RAMMb,
		CPUCores:    cfg.CPUCores,
		CreatedAt:   time.Now().UTC(),
	}, nil
}

// waitForPort polls addr (host:port) until it accepts a TCP connection or the
// deadline passes. Returns true if SSH became reachable.
func waitForPort(addr string, timeout time.Duration) bool {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		conn, err := net.DialTimeout("tcp", addr, 2*time.Second)
		if err == nil {
			conn.Close()
			return true
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
