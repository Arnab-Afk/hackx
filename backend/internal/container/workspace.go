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
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/moby/moby/api/types/container"
	"github.com/moby/moby/api/types/network"
	dockerclient "github.com/moby/moby/client"
)

const workspaceImage = "ubuntu:22.04"

// hostServicePorts lists the backend services that workspace containers must
// not be able to reach (backend API, proxy, postgres).
var hostServicePorts = []string{"8081", "8082", "5432", "5433"}

// firewallOnce ensures iptables rules are installed exactly once per process.
var firewallOnce sync.Once

// WorkspaceConfig defines the resource spec for a user workspace.
type WorkspaceConfig struct {
	TeamID    string
	RAMMb     int64   // e.g. 2048
	CPUCores  float64 // e.g. 2.0
	VaultKey  string  // hex vault key for LUKS home encryption; random if empty
}

// WorkspaceInfo is returned after the workspace is ready.
type WorkspaceInfo struct {
	ContainerID string    `json:"container_id"`
	TeamID      string    `json:"team_id"`
	SSHHost     string    `json:"ssh_host"`
	SSHPort     int       `json:"ssh_port"`
	AppPort     int       `json:"app_port"`  // host port mapped to container port 3000 (for deployed apps)
	Username    string    `json:"username"`
	Password    string    `json:"password"`
	RAMMb       int64     `json:"ram_mb"`
	CPUCores    float64   `json:"cpu_cores"`
	StoragePath string    `json:"storage_path"` // host path backing /home/hackx
	Status      string    `json:"status"`      // "provisioning" | "ready" | "failed"
	CreatedAt   time.Time `json:"created_at"`
}

// AllocateWorkspace creates an Ubuntu container that feels like an individual
// VM: private network namespace, private PID namespace, persistent home
// directory, unique hostname, and (if lxcfs is running on the host) correct
// resource readings from free/nproc/top.
func (m *Manager) AllocateWorkspace(ctx context.Context, cfg WorkspaceConfig) (*WorkspaceInfo, error) {
	// Block the docker0 bridge from reaching host backend services (runs once).
	installFirewallRules()

	password := randomHex(16)
	username := "hackx"

	// Bind-mount a directory on the host drive into /home/hackx so files
	// survive container restarts and are stored on the designated storage drive.
	storageDir := fmt.Sprintf("/vm-storage/workspaces/%s", cfg.TeamID)
	if err := os.MkdirAll(storageDir, 0o755); err != nil {
		return nil, fmt.Errorf("create workspace storage dir: %w", err)
	}

	// Create (or re-open) an encrypted LUKS home directory on the host and
	// bind-mount the decrypted path into the container.  The workspace user
	// sees a normal filesystem; on disk everything is AES-256 ciphertext.
	homePath, err := setupLUKSHome(storageDir, cfg.VaultKey)
	if err != nil {
		log.Printf("[workspace] LUKS setup failed (%v) — falling back to unencrypted home", err)
		homePath = storageDir // graceful degradation
	} else {
		log.Printf("[workspace] LUKS home ready at %s", homePath)
	}

	// Short, human-readable hostname shown in the shell prompt.
	shortID := cfg.TeamID
	if len(shortID) > 12 {
		shortID = shortID[:12]
	}
	hostname := fmt.Sprintf("ws-%s", shortID)

	// Pick free host ports: one for SSH (22) and one for the app (3000).
	sshPort, err := freePort()
	if err != nil {
		return nil, fmt.Errorf("find free port: %w", err)
	}
	appPort, err := freePort()
	if err != nil {
		return nil, fmt.Errorf("find free app port: %w", err)
	}

	// Inline setup script. The home directory may already contain files from a
	// previous session (the volume persists); chown ensures correct ownership
	// even if the container UID changes between recreations.
	setup := fmt.Sprintf(`
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq openssh-server sudo curl wget git vim nano unzip build-essential
useradd -M -s /bin/bash %s
echo '%s:%s' | chpasswd
# Populate home from skel on first boot; chown always to fix ownership.
[ -f /home/%s/.bashrc ] || cp -r /etc/skel/. /home/%s/
chown -R %s:%s /home/%s
usermod -aG sudo %s
echo '%s ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers
mkdir -p /run/sshd
echo 'PasswordAuthentication yes' >> /etc/ssh/sshd_config
echo 'PermitRootLogin no' >> /etc/ssh/sshd_config
ssh-keygen -A -q
cat > /etc/motd << 'EOF'

  zkLOUD Workspace — %s
  --------------------------------
  RAM:  %d MB
  CPUs: %.1f cores

EOF
exec /usr/sbin/sshd -D
`, username,
		username, password,
		username, username,
		username, username, username,
		username,
		username,
		hostname, cfg.RAMMb, cfg.CPUCores)

	// Pull image (no-op if already cached).
	pull, err := m.client.ImagePull(ctx, workspaceImage, dockerclient.ImagePullOptions{})
	if err != nil {
		return nil, fmt.Errorf("pull %s: %w", workspaceImage, err)
	}
	io.Copy(io.Discard, pull)
	pull.Close()

	sshTCP, _ := network.ParsePort("22/tcp")
	appTCP, _ := network.ParsePort("3000/tcp")
	anyAddr := netip.MustParseAddr("0.0.0.0")

	// Build bind list: encrypted home on /vm-storage + lxcfs mounts if available.
	binds := []string{
		fmt.Sprintf("%s:/home/%s", homePath, username),
	}
	binds = append(binds, lxcfsBinds()...)

	resp, err := m.client.ContainerCreate(ctx, dockerclient.ContainerCreateOptions{
		Name: fmt.Sprintf("zkloud-ws-%s-%d", cfg.TeamID, time.Now().UnixNano()),
		Config: &container.Config{
			Image:    workspaceImage,
			Cmd:      []string{"/bin/bash", "-c", setup},
			Hostname: hostname, // shows up in shell prompt: hackx@ws-team-xxx
			ExposedPorts: network.PortSet{
				sshTCP: struct{}{},
				appTCP: struct{}{},
			},
			Labels: map[string]string{
				"zkloud.team": cfg.TeamID,
				"zkloud.type": "workspace",
			},
		},
		HostConfig: &container.HostConfig{
			// Bridge networking: own network namespace (localhost = this container),
			// own PID namespace (can't see host or other container processes).
			NetworkMode: "bridge",
			DNS: []netip.Addr{
				netip.MustParseAddr("8.8.8.8"),
				netip.MustParseAddr("1.1.1.1"),
			},
			PortBindings: network.PortMap{
				sshTCP: []network.PortBinding{
					{HostIP: anyAddr, HostPort: fmt.Sprintf("%d", sshPort)},
				},
				appTCP: []network.PortBinding{
					{HostIP: anyAddr, HostPort: fmt.Sprintf("%d", appPort)},
				},
			},
			Resources: container.Resources{
				Memory:   cfg.RAMMb * 1024 * 1024,
				NanoCPUs: int64(cfg.CPUCores * 1e9),
			},
			// Drop capabilities that could affect the host kernel or escape isolation.
			CapDrop: []string{
				"NET_ADMIN",  // cannot modify iptables/routing
				"SYS_ADMIN",  // cannot mount filesystems or change namespaces
				"SYS_PTRACE", // cannot trace/inspect other processes
				"SYS_MODULE", // cannot load/unload kernel modules
				"SYS_RAWIO",  // cannot perform raw I/O
				"SYS_BOOT",   // cannot reboot/kexec
				"NET_RAW",    // cannot craft raw packets
			},
			// /tmp gets its own tmpfs so workspace users can't fill the host disk.
			Tmpfs: map[string]string{
				"/tmp": "rw,nosuid,nodev,size=512m",
			},
			ShmSize: 64 * 1024 * 1024, // 64 MB /dev/shm
			// No docker.sock — prevents escaping to the Docker daemon.
			Binds: binds,
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
		AppPort:     appPort,
		Username:    username,
		Password:    password,
		RAMMb:       cfg.RAMMb,
		CPUCores:    cfg.CPUCores,
		StoragePath: storageDir + "/vault.img",
		Status:      "provisioning",
		CreatedAt:   time.Now().UTC(),
	}

	// Store SSH credentials so the gateway can look them up later.
	m.RegisterWorkspace(ws)

	go func() {
		if waitForSSH(fmt.Sprintf("localhost:%d", sshPort), 5*time.Minute) {
			ws.Status = "ready"
		} else {
			ws.Status = "failed"
		}
	}()

	return ws, nil
}

// lxcfsBinds returns bind-mount strings for lxcfs virtual /proc files if
// lxcfs is running on the host. When mounted, tools like free/top/nproc show
// the container's cgroup limits instead of the host's totals.
// Install on the host: apt-get install lxcfs && systemctl enable --now lxcfs
func lxcfsBinds() []string {
	const root = "/var/lib/lxcfs"
	if _, err := os.Stat(root + "/proc/meminfo"); err != nil {
		log.Printf("[workspace] lxcfs not running — /proc shows host totals (apt-get install lxcfs on the host to fix)")
		return nil
	}
	log.Printf("[workspace] lxcfs detected — mounting virtual /proc and /sys/devices/system/cpu")
	return []string{
		root + "/proc/cpuinfo:/proc/cpuinfo:ro",
		root + "/proc/diskstats:/proc/diskstats:ro",
		root + "/proc/meminfo:/proc/meminfo:ro",
		root + "/proc/stat:/proc/stat:ro",
		root + "/proc/swaps:/proc/swaps:ro",
		root + "/proc/uptime:/proc/uptime:ro",
		root + "/sys/devices/system/cpu:/sys/devices/system/cpu:ro",
	}
}

// installFirewallRules inserts iptables rules in the DOCKER-USER chain to
// block containers on docker0 from reaching host backend services.
// Idempotent: checks with -C before inserting with -I.
func installFirewallRules() {
	firewallOnce.Do(func() {
		for _, port := range hostServicePorts {
			check := []string{"-C", "DOCKER-USER", "-i", "docker0", "-p", "tcp", "--dport", port, "-j", "DROP"}
			if err := exec.Command("iptables", check...).Run(); err != nil {
				insert := []string{"-I", "DOCKER-USER", "-i", "docker0", "-p", "tcp", "--dport", port, "-j", "DROP"}
				if out, err := exec.Command("iptables", insert...).CombinedOutput(); err != nil {
					log.Printf("[firewall] WARNING: could not block docker0 → port %s: %v — %s", port, err, out)
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

// waitForSSH polls addr until the SSH banner (SSH-2.0-...) appears.
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
