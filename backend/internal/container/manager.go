package container

import (
	"context"
	"fmt"
	"io"
	"net/netip"
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
	client *dockerclient.Client
	wsMu   sync.RWMutex
	wsReg  map[string]*WorkspaceInfo // containerID (short or full) → info
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
	return &Manager{client: cli, wsReg: make(map[string]*WorkspaceInfo)}, nil
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

// CreateContainer pulls the image if needed and starts a container for the team.
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

	for _, p := range opts.Ports {
		port, err := network.ParsePort(p)
		if err != nil {
			return nil, fmt.Errorf("parse port %s: %w", p, err)
		}
		exposedPorts[port] = struct{}{}
		portBindings[port] = []network.PortBinding{{HostIP: anyAddr, HostPort: ""}}
	}

	containerName := fmt.Sprintf("zkloud-%s-%s", opts.TeamID, opts.Name)

	resp, err := m.client.ContainerCreate(ctx, dockerclient.ContainerCreateOptions{
		Name:  containerName,
		Image: opts.Image,
		Config: &container.Config{
			ExposedPorts: exposedPorts,
			Labels: map[string]string{
				"zkloud.team": opts.TeamID,
				"zkloud.name": opts.Name,
			},
		},
		HostConfig: &container.HostConfig{
			PortBindings: portBindings,
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

	return &ContainerInfo{
		ID:     resp.ID[:12],
		Name:   opts.Name,
		Status: "running",
	}, nil
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
	_, err := m.client.ContainerRemove(ctx, containerID, dockerclient.ContainerRemoveOptions{Force: true})
	return err
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
