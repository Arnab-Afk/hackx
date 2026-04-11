package api

import (
	"bytes"
	"fmt"
	"time"

	"golang.org/x/crypto/ssh"
)

// runSSHScript dials the workspace SSH server, runs script as a single
// non-interactive session, and returns the combined stdout+stderr output.
func runSSHScript(host string, port int, user, password, script string) (string, error) {
	cfg := &ssh.ClientConfig{
		User:            user,
		Auth:            []ssh.AuthMethod{ssh.Password(password)},
		HostKeyCallback: ssh.InsecureIgnoreHostKey(),
		Timeout:         10 * time.Second,
	}

	client, err := ssh.Dial("tcp", fmt.Sprintf("%s:%d", host, port), cfg)
	if err != nil {
		return "", fmt.Errorf("ssh dial: %w", err)
	}
	defer client.Close()

	sess, err := client.NewSession()
	if err != nil {
		return "", fmt.Errorf("ssh session: %w", err)
	}
	defer sess.Close()

	var buf bytes.Buffer
	sess.Stdout = &buf
	sess.Stderr = &buf

	// Run as login shell so PATH / nvm / etc. are set up correctly.
	if err := sess.Run("bash -l -s <<'__SCRIPT__'\n" + script + "\n__SCRIPT__"); err != nil {
		return buf.String(), fmt.Errorf("script: %w", err)
	}
	return buf.String(), nil
}
