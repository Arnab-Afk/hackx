package container

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"net"
	"net/netip"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/moby/moby/api/types/container"
	"github.com/moby/moby/api/types/network"
	dockerclient "github.com/moby/moby/client"
)

const workspaceImage = "ubuntu:22.04"

// hostPorts lists the backend services on the host that workspace containers
// must NOT be able to reach (backend API, proxy, postgres).
var hostServicePorts = []string{"8081", "8082", "5432", "5433"}

// firewallOnce ensures iptables rules are installed exactly once per process.
var firewallOnce sync.Once

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

// AllocateWorkspace creates an Ubuntu container with bridge networking (for
// internet access via NAT), SSH + sudo, resource limits, and waits until SSH
// is ready. The container is isolated from host services via iptables.
func (m *Manager) AllocateWorkspace(ctx context.Context, cfg WorkspaceConfig) (*WorkspaceInfo, error) {
	// Block docker bridge from reaching host backend services (runs once).
	installFirewallRules()

	password := randomHex(16)
	username := "hackx"

	// Pick a free host port; Docker will map it to container port 22.
	sshPort, err := freePort()
	if err != nil {
		return nil, fmt.Errorf("find free port: %w", err)
	}

	// Inline setup script. sshd listens on port 22 (default) — Docker handles
	// the host:sshPort → container:22 mapping via PortBindings.
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
`, username, username, password, username, username, cfg.RAMMb, cfg.CPUCores)

	// Pull image (no-op if already cached).
	pull, err := m.client.ImagePull(ctx, workspaceImage, dockerclient.ImagePullOptions{})
	if err != nil {
		return nil, fmt.Errorf("pull %s: %w", workspaceImage, err)
	}
	io.Copy(io.Discard, pull)
	pull.Close()

	// Bind host:sshPort → container:22.
	sshTCP, _ := network.ParsePort("22/tcp")

	resp, err := m.client.ContainerCreate(ctx, dockerclient.ContainerCreateOptions{
		Name: fmt.Sprintf("zkloud-ws-%s-%d", cfg.TeamID, time.Now().UnixNano()),
		Config: &container.Config{
			Image: workspaceImage,
			Cmd:   []string{"/bin/bash", "-c", setup},
			ExposedPorts: network.PortSet{
				sshTCP: struct{}{},
			},
			Labels: map[string]string{
				"zkloud.team": cfg.TeamID,
				"zkloud.type": "workspace",
			},
		},
		HostConfig: &container.HostConfig{
			// Bridge networking: container gets its own network namespace.
			// localhost inside the container is the container — not the host.
			// Internet access works via Docker NAT (no need for host networking).
			NetworkMode: "bridge",
			DNS: []netip.Addr{
				netip.MustParseAddr("8.8.8.8"),
				netip.MustParseAddr("1.1.1.1"),
			},
			PortBindings: network.PortMap{
				sshTCP: []network.PortBinding{
					{HostIP: netip.MustParseAddr("0.0.0.0"), HostPort: fmt.Sprintf("%d", sshPort)},
				},
			},
			Resources: container.Resources{
				Memory:   cfg.RAMMb * 1024 * 1024,
				NanoCPUs: int64(cfg.CPUCores * 1e9),
			},
			// Drop capabilities that could be used to break out of the container
			// or affect the host kernel/network. Keep what's needed for SSH + sudo.
			CapDrop: []string{
				"NET_ADMIN",   // cannot modify host iptables/routing from inside
				"SYS_ADMIN",   // cannot mount filesystems, change namespaces, etc.
				"SYS_PTRACE",  // cannot trace/inspect other processes
				"SYS_MODULE",  // cannot load/unload kernel modules
				"SYS_RAWIO",   // cannot perform raw I/O (disk access)
				"SYS_BOOT",    // cannot reboot/kexec the host
				"NET_RAW",     // cannot craft raw packets (prevents some network attacks)
				"SYS_PACCT",   // process accounting
			},
			// No docker.sock mount — prevents container from controlling the Docker
			// daemon and escaping to the host.
			Binds: []string{},
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

// installFirewallRules inserts iptables rules in the DOCKER-USER chain to
// block workspace containers (on docker0) from reaching host backend services.
// Runs at most once per process lifetime.
func installFirewallRules() {
	firewallOnce.Do(func() {
		for _, port := range hostServicePorts {
			// Block traffic coming in on docker0 (bridge) destined for these host ports.
			// -C checks if the rule already exists before inserting to avoid duplicates.
			checkArgs := []string{"-C", "DOCKER-USER", "-i", "docker0", "-p", "tcp", "--dport", port, "-j", "DROP"}
			if err := exec.Command("iptables", checkArgs...).Run(); err != nil {
				// Rule doesn't exist yet — insert it.
				insertArgs := []string{"-I", "DOCKER-USER", "-i", "docker0", "-p", "tcp", "--dport", port, "-j", "DROP"}
				if out, err := exec.Command("iptables", insertArgs...).CombinedOutput(); err != nil {
					log.Printf("[firewall] WARNING: failed to insert iptables rule for port %s: %v — %s", port, err, out)
				} else {
					log.Printf("[firewall] blocked docker0 → host port %s", port)
				}
			}
		}
	})
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
