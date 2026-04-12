package container

import (
	"archive/tar"
	"bytes"
	"context"
	"fmt"
	"io"
	"log"
	"net"
	"net/netip"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	dockerclient "github.com/moby/moby/client"
	"github.com/moby/moby/api/types/container"
	"github.com/moby/moby/api/types/network"
)

type PackageManager string

const (
	PackageManagerNPM PackageManager = "npm"
	PackageManagerPIP PackageManager = "pip"
	PackageManagerAPT PackageManager = "apt"
)

type IDEType string

const (
	IDEVSCode  IDEType = "vscode"
	IDEJupyter IDEType = "jupyter"
)

type DBType string

const (
	DBPostgres DBType = "postgres"
	DBMongo    DBType = "mongo"
	DBRedis    DBType = "redis"
	DBMySQL    DBType = "mysql"
)

type CreateOpts struct {
	TeamID   string
	Name     string
	Image    string
	RAMMb    int64
	CPUCores float64
	Ports    []string // e.g. ["3000/tcp", "8080/tcp"]
	VaultKey string   // hex AES-256 key for LUKS /app encryption; random if empty
}

type ContainerInfo struct {
	ID     string
	Name   string
	Status string
	Ports  map[string]string // "containerPort/proto" -> hostPort
}

type HealthStatus struct {
	Running bool
	Status  string
}

type Manager struct {
	client         *dockerclient.Client
	wsMu           sync.RWMutex
	wsReg          map[string]*WorkspaceInfo // containerID (short or full) → info
	deployMu       sync.RWMutex
	deployReg      map[string]map[string]string // containerID → (containerPort/proto → hostPort)
	storageMu      sync.RWMutex
	storageReg     map[string]string // containerID → storageDir (for LUKS teardown)
}

func NewManager(host string) (*Manager, error) {
	var cli *dockerclient.Client
	var err error

	if host == "" || host == "unix:///var/run/docker.sock" {
		cli, err = dockerclient.NewClientWithOpts(dockerclient.FromEnv, dockerclient.WithAPIVersionNegotiation())
	} else {
		cli, err = dockerclient.NewClientWithOpts(
			dockerclient.WithHost(host),
			dockerclient.WithAPIVersionNegotiation(),
		)
	}
	if err != nil {
		return nil, fmt.Errorf("docker client: %w", err)
	}
	return &Manager{
		client:     cli,
		wsReg:      make(map[string]*WorkspaceInfo),
		deployReg:  make(map[string]map[string]string),
		storageReg: make(map[string]string),
	}, nil
}

// RegisterWorkspace stores workspace SSH credentials in memory so the SSH
// gateway can look them up later without hitting the database.
func (m *Manager) RegisterWorkspace(ws *WorkspaceInfo) {
	m.wsMu.Lock()
	defer m.wsMu.Unlock()
	m.wsReg[ws.ContainerID] = ws // short ID (12 chars)
}

// GetWorkspaceInfo returns the workspace info for a given container ID (short
// or full — only short IDs are stored so we truncate to 12 chars if longer).
func (m *Manager) GetWorkspaceInfo(containerID string) (*WorkspaceInfo, bool) {
	key := containerID
	if len(key) > 12 {
		key = key[:12]
	}
	m.wsMu.RLock()
	defer m.wsMu.RUnlock()
	ws, ok := m.wsReg[key]
	return ws, ok
}

// RegisterDeploy records the host-port mapping for a deployed container so the
// subdomain proxy middleware can route traffic to it.
func (m *Manager) RegisterDeploy(containerID string, ports map[string]string) {
	m.deployMu.Lock()
	defer m.deployMu.Unlock()
	m.deployReg[containerID] = ports
}

// LookupDeployPort returns the primary host port for a deployed container.
// It returns the first non-empty host port found in the port map.
func (m *Manager) LookupDeployPort(containerID string) (string, bool) {
	m.deployMu.RLock()
	defer m.deployMu.RUnlock()
	ports, ok := m.deployReg[containerID]
	if !ok {
		return "", false
	}
	for _, hp := range ports {
		if hp != "" {
			return hp, true
		}
	}
	return "", false
}

// CreateContainer pulls the image if needed and starts a container for the team.
// The container's /app directory is backed by a LUKS-encrypted volume on the host,
// so all cloned source code and build artefacts are AES-256 encrypted at rest.
func (m *Manager) CreateContainer(ctx context.Context, opts CreateOpts) (*ContainerInfo, error) {
	pullResp, err := m.client.ImagePull(ctx, opts.Image, dockerclient.ImagePullOptions{})
	if err != nil {
		return nil, fmt.Errorf("pull image %s: %w", opts.Image, err)
	}
	if err := pullResp.Wait(ctx); err != nil {
		return nil, fmt.Errorf("wait for image pull: %w", err)
	}

	exposedPorts := network.PortSet{}
	portBindings := network.PortMap{}
	anyAddr := netip.MustParseAddr("0.0.0.0")
	// hostPortMap tracks container_port → actual host port for the return value
	hostPortMap := make(map[string]string)

	for _, p := range opts.Ports {
		port, err := network.ParsePort(p)
		if err != nil {
			return nil, fmt.Errorf("parse port %s: %w", p, err)
		}
		exposedPorts[port] = struct{}{}

		// Try to bind to the same port number on the host; fall back to random
		// if that port is already occupied (e.g. two teams deploy on port 3000).
		containerPortNum := port.Port()
		hostPort := containerPortNum
		if !isPortAvailable(hostPort) {
			hostPort = "" // let Docker pick a free ephemeral port
		}
		portBindings[port] = []network.PortBinding{{HostIP: anyAddr, HostPort: hostPort}}
		hostPortMap[port.String()] = hostPort
	}

	// Set up an encrypted LUKS volume for /app (the cloned repo + build artefacts).
	// A unique storage dir is created so each container has its own isolated vault.
	storageDir := fmt.Sprintf("/vm-storage/containers/%s-%s-%s", opts.TeamID, opts.Name, randomHex(6))
	if err := os.MkdirAll(storageDir, 0o755); err != nil {
		return nil, fmt.Errorf("create container storage dir: %w", err)
	}
	appPath, luksErr := setupLUKSHome(storageDir, opts.VaultKey)
	if luksErr != nil {
		log.Printf("[container] LUKS setup failed (%v) — falling back to unencrypted /app", luksErr)
		appPath = storageDir + "/app"
		if err := os.MkdirAll(appPath, 0o755); err != nil {
			return nil, fmt.Errorf("mkdir fallback app dir: %w", err)
		}
	}

	// Bind list: encrypted /app volume.
	binds := []string{appPath + ":/app"}

	containerName := fmt.Sprintf("zkloud-%s-%s", opts.TeamID, opts.Name)

	resp, err := m.client.ContainerCreate(ctx, dockerclient.ContainerCreateOptions{
		Name:  containerName,
		Image: opts.Image,
		Config: &container.Config{
			ExposedPorts: exposedPorts,
			// Keep container alive so exec commands can run inside it.
			// The actual application is started later via start_process.
			Cmd: []string{"sh", "-c", "tail -f /dev/null"},
			Labels: map[string]string{
				"zkloud.team":      opts.TeamID,
				"zkloud.name":      opts.Name,
				"zkloud.encrypted": fmt.Sprintf("%v", luksErr == nil),
			},
		},
		HostConfig: &container.HostConfig{
			PortBindings: portBindings,
			Binds:        binds,
			Resources: container.Resources{
				Memory:   opts.RAMMb * 1024 * 1024,
				NanoCPUs: int64(opts.CPUCores * 1e9),
			},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("create container: %w", err)
	}

	if _, err := m.client.ContainerStart(ctx, resp.ID, dockerclient.ContainerStartOptions{}); err != nil {
		return nil, fmt.Errorf("start container: %w", err)
	}

	// Inspect to get the actual host ports Docker assigned (important when we
	// fell back to an ephemeral port because the desired one was taken).
	inspect, err := m.client.ContainerInspect(ctx, resp.ID, dockerclient.ContainerInspectOptions{})
	ports := make(map[string]string)
	if err == nil {
		for cPort, bindings := range inspect.Container.HostConfig.PortBindings {
			for _, b := range bindings {
				if b.HostPort != "" {
					ports[cPort.String()] = b.HostPort
				}
			}
		}
		// If HostConfig bindings are empty (Docker filled them in), read from NetworkSettings
		if len(ports) == 0 {
			for cPort, bindings := range inspect.Container.NetworkSettings.Ports {
				for _, b := range bindings {
					if b.HostPort != "" {
						ports[cPort.String()] = b.HostPort
					}
				}
			}
		}
	}

	shortID := resp.ID[:12]

	// Register storageDir so Destroy can tear down the LUKS volume.
	m.storageMu.Lock()
	m.storageReg[shortID] = storageDir
	m.storageMu.Unlock()

	log.Printf("[container] created %s encrypted=%v storageDir=%s", shortID, luksErr == nil, storageDir)

	return &ContainerInfo{
		ID:     shortID,
		Name:   opts.Name,
		Status: "running",
		Ports:  ports,
	}, nil
}

// isPortAvailable returns true if no process is currently listening on the given
// TCP port on all interfaces. Used to prefer same-port host bindings.
func isPortAvailable(port string) bool {
	if port == "" {
		return false
	}
	ln, err := net.Listen("tcp", ":"+port)
	if err != nil {
		return false
	}
	ln.Close()
	return true
}

// InstallPackages runs a package install command inside a running container.
func (m *Manager) InstallPackages(ctx context.Context, containerID string, packages []string, mgr PackageManager) error {
	var cmd []string
	switch mgr {
	case PackageManagerNPM:
		cmd = append([]string{"npm", "install", "-g"}, packages...)
	case PackageManagerPIP:
		cmd = append([]string{"pip", "install"}, packages...)
	case PackageManagerAPT:
		cmd = []string{"sh", "-c", "apt-get update && apt-get install -y " + strings.Join(packages, " ")}
	default:
		return fmt.Errorf("unknown package manager: %s", mgr)
	}
	return m.exec(ctx, containerID, cmd)
}

// CreateNetwork creates an isolated bridge network for a team if it doesn't exist.
func (m *Manager) CreateNetwork(ctx context.Context, teamID string) error {
	name := teamNetworkName(teamID)

	nets, err := m.client.NetworkList(ctx, dockerclient.NetworkListOptions{
		Filters: make(dockerclient.Filters).Add("name", name),
	})
	if err != nil {
		return fmt.Errorf("list networks: %w", err)
	}
	for _, n := range nets.Items {
		if n.Name == name {
			return nil
		}
	}

	_, err = m.client.NetworkCreate(ctx, name, dockerclient.NetworkCreateOptions{
		Driver: "bridge",
		Labels: map[string]string{"zkloud.team": teamID},
		Options: map[string]string{
			"com.docker.network.bridge.enable_icc":           "true",
			"com.docker.network.bridge.enable_ip_masquerade": "true",
		},
	})
	return err
}

// ConnectContainers connects containers to the team's shared network.
func (m *Manager) ConnectContainers(ctx context.Context, teamID string, containerIDs []string) error {
	netName := teamNetworkName(teamID)
	for _, id := range containerIDs {
		_, err := m.client.NetworkConnect(ctx, netName, dockerclient.NetworkConnectOptions{
			Container:      id,
			EndpointConfig: &network.EndpointSettings{},
		})
		if err != nil && !strings.Contains(err.Error(), "already exists") {
			return fmt.Errorf("connect %s to network: %w", id, err)
		}
	}
	return nil
}

// SetupIDE installs a web IDE into a container.
func (m *Manager) SetupIDE(ctx context.Context, containerID string, ideType IDEType) error {
	switch ideType {
	case IDEVSCode:
		return m.exec(ctx, containerID, []string{"sh", "-c",
			"curl -fsSL https://code-server.dev/install.sh | sh && code-server --bind-addr 0.0.0.0:8443 --auth none &"})
	case IDEJupyter:
		if err := m.exec(ctx, containerID, []string{"pip", "install", "jupyterlab"}); err != nil {
			return err
		}
		return m.exec(ctx, containerID, []string{"sh", "-c",
			"jupyter lab --ip=0.0.0.0 --port=8888 --no-browser --allow-root &"})
	default:
		return fmt.Errorf("unknown IDE type: %s", ideType)
	}
}

// SetupDatabase starts a database container for the team.
func (m *Manager) SetupDatabase(ctx context.Context, teamID string, dbType DBType, version string) (*ContainerInfo, error) {
	imageMap := map[DBType]string{
		DBPostgres: "postgres",
		DBMongo:    "mongo",
		DBRedis:    "redis",
		DBMySQL:    "mysql",
	}
	portMap := map[DBType]string{
		DBPostgres: "5432/tcp",
		DBMongo:    "27017/tcp",
		DBRedis:    "6379/tcp",
		DBMySQL:    "3306/tcp",
	}

	image, ok := imageMap[dbType]
	if !ok {
		return nil, fmt.Errorf("unsupported db type: %s", dbType)
	}
	if version != "" {
		image = image + ":" + version
	}

	return m.CreateContainer(ctx, CreateOpts{
		TeamID:   teamID,
		Name:     string(dbType),
		Image:    image,
		RAMMb:    512,
		CPUCores: 0.5,
		Ports:    []string{portMap[dbType]},
	})
}

// HealthCheck inspects a container and returns its running status.
func (m *Manager) HealthCheck(ctx context.Context, containerID string) (*HealthStatus, error) {
	result, err := m.client.ContainerInspect(ctx, containerID, dockerclient.ContainerInspectOptions{})
	if err != nil {
		return nil, fmt.Errorf("inspect container: %w", err)
	}
	return &HealthStatus{
		Running: result.Container.State.Running,
		Status:  string(result.Container.State.Status),
	}, nil
}

// GetLogs returns the last N lines of logs from a container.
func (m *Manager) GetLogs(ctx context.Context, containerID string, lines int) (string, error) {
	reader, err := m.client.ContainerLogs(ctx, containerID, dockerclient.ContainerLogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Tail:       fmt.Sprintf("%d", lines),
	})
	if err != nil {
		return "", fmt.Errorf("get logs: %w", err)
	}
	defer reader.Close()

	var sb strings.Builder
	io.Copy(&sb, reader)
	return sb.String(), nil
}

// Destroy stops and removes a container.
func (m *Manager) Destroy(ctx context.Context, containerID string) error {
	timeout := 10
	if _, err := m.client.ContainerStop(ctx, containerID, dockerclient.ContainerStopOptions{Timeout: &timeout}); err != nil {
		return fmt.Errorf("stop container: %w", err)
	}
	if _, err := m.client.ContainerRemove(ctx, containerID, dockerclient.ContainerRemoveOptions{Force: true}); err != nil {
		return err
	}

	// Tear down the LUKS-encrypted /app volume and remove storage dir.
	m.storageMu.Lock()
	storageDir, ok := m.storageReg[containerID]
	if ok {
		delete(m.storageReg, containerID)
	}
	m.storageMu.Unlock()

	if ok {
		teardownLUKSHome(storageDir)
		if err := os.RemoveAll(storageDir); err != nil {
			log.Printf("[container] cleanup storageDir %s: %v", storageDir, err)
		}
	}
	return nil
}

// ListTeamContainers returns all containers for a given team.
func (m *Manager) ListTeamContainers(ctx context.Context, teamID string) ([]ContainerInfo, error) {
	result, err := m.client.ContainerList(ctx, dockerclient.ContainerListOptions{
		Filters: make(dockerclient.Filters).Add("label", "zkloud.team="+teamID),
	})
	if err != nil {
		return nil, err
	}

	var containers []ContainerInfo
	for _, c := range result.Items {
		ports := make(map[string]string)
		for _, p := range c.Ports {
			if p.PublicPort != 0 {
				ports[fmt.Sprintf("%d/%s", p.PrivatePort, p.Type)] = fmt.Sprintf("%d", p.PublicPort)
			}
		}
		containers = append(containers, ContainerInfo{
			ID:     c.ID[:12],
			Name:   c.Labels["zkloud.name"],
			Status: string(c.State),
			Ports:  ports,
		})
	}
	return containers, nil
}

// CloneRepo ensures git is present then clones a repository into the container.
// dir defaults to /app if empty. Returns combined command output.
func (m *Manager) CloneRepo(ctx context.Context, containerID, repoURL, dir string) (string, error) {
	if dir == "" {
		dir = "/app"
	}
	// Best-effort git install; ignore errors from already-installed or non-apt images
	_ = m.exec(ctx, containerID, []string{"sh", "-c",
		"which git > /dev/null 2>&1 || (apt-get update -qq && apt-get install -y -qq git)"})
	out, err := m.execWithOutput(ctx, containerID, []string{"git", "clone", "--depth=1", repoURL, dir}, "/", nil)
	if err != nil {
		return out, fmt.Errorf("git clone: %w", err)
	}
	return out, nil
}

// RunCommand runs a shell command inside a container and returns combined stdout+stderr.
// workDir may be empty (defaults to container's working dir).
func (m *Manager) RunCommand(ctx context.Context, containerID, shellCmd, workDir string, env map[string]string) (string, error) {
	var envSlice []string
	for k, v := range env {
		envSlice = append(envSlice, fmt.Sprintf("%s=%s", k, v))
	}
	return m.execWithOutput(ctx, containerID, []string{"sh", "-c", shellCmd}, workDir, envSlice)
}

// StartProcess launches a long-running process in the container and returns immediately.
// Stdout/stderr are redirected to the container's PID-1 stdout so they appear in docker logs.
func (m *Manager) StartProcess(ctx context.Context, containerID, shellCmd, workDir string, env map[string]string) (string, error) {
	var envSlice []string
	for k, v := range env {
		envSlice = append(envSlice, fmt.Sprintf("%s=%s", k, v))
	}
	// Redirect output to /proc/1/fd/1 (PID 1 stdout → docker logs) and run detached
	wrapped := fmt.Sprintf("nohup sh -c %q > /proc/1/fd/1 2>&1 &", shellCmd)
	return m.execWithOutput(ctx, containerID, []string{"sh", "-c", wrapped}, workDir, envSlice)
}

// WriteFile writes arbitrary text content to a path inside the container.
// Parent directories are created automatically.
func (m *Manager) WriteFile(ctx context.Context, containerID, path, content string) error {
	fname := filepath.Base(path)
	dir := filepath.ToSlash(filepath.Dir(path))

	var buf bytes.Buffer
	tw := tar.NewWriter(&buf)
	hdr := &tar.Header{
		Name:    fname,
		Mode:    0644,
		Size:    int64(len(content)),
		ModTime: time.Now(),
	}
	if err := tw.WriteHeader(hdr); err != nil {
		return err
	}
	if _, err := tw.Write([]byte(content)); err != nil {
		return err
	}
	tw.Close()

	_, err := m.client.CopyToContainer(ctx, containerID, dockerclient.CopyToContainerOptions{
		DestinationPath: dir,
		Content:         &buf,
	})
	return err
}

// execWithOutput runs a command in a container and returns its combined stdout+stderr.
func (m *Manager) execWithOutput(ctx context.Context, containerID string, cmd []string, workDir string, env []string) (string, error) {
	opts := dockerclient.ExecCreateOptions{
		Cmd:          cmd,
		AttachStdout: true,
		AttachStderr: true,
		WorkingDir:   workDir,
		Env:          env,
	}
	execResult, err := m.client.ExecCreate(ctx, containerID, opts)
	if err != nil {
		return "", fmt.Errorf("exec create: %w", err)
	}

	attachResult, err := m.client.ExecAttach(ctx, execResult.ID, dockerclient.ExecAttachOptions{})
	if err != nil {
		return "", fmt.Errorf("exec attach: %w", err)
	}
	defer attachResult.Close()

	var sb strings.Builder
	io.Copy(&sb, attachResult.Reader)

	for {
		inspect, err := m.client.ExecInspect(ctx, execResult.ID, dockerclient.ExecInspectOptions{})
		if err != nil {
			return sb.String(), err
		}
		if !inspect.Running {
			if inspect.ExitCode != 0 {
				return sb.String(), fmt.Errorf("exited %d: %s", inspect.ExitCode, sb.String())
			}
			break
		}
		time.Sleep(200 * time.Millisecond)
	}
	return sb.String(), nil
}

// exec runs a command in a running container and waits for completion.
func (m *Manager) exec(ctx context.Context, containerID string, cmd []string) error {
	execResult, err := m.client.ExecCreate(ctx, containerID, dockerclient.ExecCreateOptions{
		Cmd:          cmd,
		AttachStdout: true,
		AttachStderr: true,
	})
	if err != nil {
		return fmt.Errorf("exec create: %w", err)
	}

	attachResult, err := m.client.ExecAttach(ctx, execResult.ID, dockerclient.ExecAttachOptions{})
	if err != nil {
		return fmt.Errorf("exec attach: %w", err)
	}
	defer attachResult.Close()
	io.Copy(io.Discard, attachResult.Reader)

	for {
		inspect, err := m.client.ExecInspect(ctx, execResult.ID, dockerclient.ExecInspectOptions{})
		if err != nil {
			return err
		}
		if !inspect.Running {
			if inspect.ExitCode != 0 {
				return fmt.Errorf("command exited with code %d", inspect.ExitCode)
			}
			break
		}
		time.Sleep(200 * time.Millisecond)
	}
	return nil
}

func teamNetworkName(teamID string) string {
	return "zkloud-" + teamID + "-net"
}
