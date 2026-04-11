package container

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"os"
	"os/exec"
	"strings"
)

// setupLUKSHome creates (or re-opens) an encrypted LUKS2 image at
// storageDir/vault.img and mounts the decrypted filesystem at
// storageDir/home.  Returns the mount path.
//
// vaultKey is a hex string (64 chars = 32 bytes).  If empty, a random key is
// generated (files are still encrypted, just not blockchain-gated).
func setupLUKSHome(storageDir, vaultKey string) (mountPath string, err error) {
	imgPath := storageDir + "/vault.img"
	mountPath = storageDir + "/home"
	mapper := "zkloud-" + randomMapperSuffix()
	keyfile := storageDir + "/vault.key"

	if err := os.MkdirAll(mountPath, 0o755); err != nil {
		return "", fmt.Errorf("mkdir mountpath: %w", err)
	}

	// Derive key bytes.
	if vaultKey == "" {
		b := make([]byte, 32)
		rand.Read(b)
		vaultKey = hex.EncodeToString(b)
	}
	if err := os.WriteFile(keyfile, []byte(vaultKey), 0o600); err != nil {
		return "", fmt.Errorf("write keyfile: %w", err)
	}
	defer os.Remove(keyfile) // wipe after use

	// Find a free loop device.
	loopDev, err := runOutput("losetup", "-f")
	if err != nil {
		return "", fmt.Errorf("losetup -f: %w", err)
	}
	loopDev = strings.TrimSpace(loopDev)

	if _, err := os.Stat(imgPath); os.IsNotExist(err) {
		// First boot: create + format.
		log.Printf("[luks] creating 512MB encrypted volume at %s", imgPath)
		if err := run("dd", "if=/dev/urandom", "of="+imgPath, "bs=1M", "count=512"); err != nil {
			return "", fmt.Errorf("dd: %w", err)
		}
		if err := run("losetup", loopDev, imgPath); err != nil {
			return "", fmt.Errorf("losetup attach: %w", err)
		}
		if err := run("cryptsetup", "luksFormat", "--batch-mode",
			"--key-file", keyfile, "--type", "luks2", loopDev); err != nil {
			run("losetup", "-d", loopDev) //nolint:errcheck
			return "", fmt.Errorf("luksFormat: %w", err)
		}
		if err := run("cryptsetup", "open", "--key-file", keyfile, loopDev, mapper); err != nil {
			run("losetup", "-d", loopDev) //nolint:errcheck
			return "", fmt.Errorf("luksOpen: %w", err)
		}
		if err := run("mkfs.ext4", "-q", "/dev/mapper/"+mapper); err != nil {
			run("cryptsetup", "close", mapper) //nolint:errcheck
			run("losetup", "-d", loopDev)      //nolint:errcheck
			return "", fmt.Errorf("mkfs: %w", err)
		}
		if err := run("mount", "/dev/mapper/"+mapper, mountPath); err != nil {
			run("cryptsetup", "close", mapper) //nolint:errcheck
			run("losetup", "-d", loopDev)      //nolint:errcheck
			return "", fmt.Errorf("mount: %w", err)
		}
		log.Printf("[luks] formatted and mounted at %s (mapper=%s loop=%s)", mountPath, mapper, loopDev)
	} else {
		// Subsequent boot: re-open.
		log.Printf("[luks] re-opening existing vault at %s", imgPath)
		if err := run("losetup", loopDev, imgPath); err != nil {
			return "", fmt.Errorf("losetup attach: %w", err)
		}
		if err := run("cryptsetup", "open", "--key-file", keyfile, loopDev, mapper); err != nil {
			run("losetup", "-d", loopDev) //nolint:errcheck
			return "", fmt.Errorf("luksOpen (wrong key?): %w", err)
		}
		if err := run("mount", "/dev/mapper/"+mapper, mountPath); err != nil {
			run("cryptsetup", "close", mapper) //nolint:errcheck
			run("losetup", "-d", loopDev)      //nolint:errcheck
			return "", fmt.Errorf("mount: %w", err)
		}
		log.Printf("[luks] re-mounted at %s (mapper=%s loop=%s)", mountPath, mapper, loopDev)
	}

	return mountPath, nil
}

// teardownLUKSHome unmounts and closes all LUKS devices associated with
// storageDir/home.  Best-effort — logs errors but does not return them.
func teardownLUKSHome(storageDir string) {
	mountPath := storageDir + "/home"

	// Unmount.
	if err := run("umount", "-l", mountPath); err != nil {
		log.Printf("[luks] umount %s: %v (continuing)", mountPath, err)
	}

	// Close any zkloud-* mapper that is backed by a loop device pointing to our image.
	imgPath := storageDir + "/vault.img"
	out, _ := runOutput("losetup", "-j", imgPath)
	for _, line := range strings.Split(strings.TrimSpace(out), "\n") {
		if line == "" {
			continue
		}
		// line: "/dev/loop3: [2049]:12345 (/path/to/vault.img)"
		loopDev := strings.SplitN(line, ":", 2)[0]

		// Find mapper using this loop device.
		mappers, _ := runOutput("dmsetup", "ls", "--target", "crypt")
		for _, mline := range strings.Split(strings.TrimSpace(mappers), "\n") {
			name := strings.Fields(mline)[0]
			status, _ := runOutput("dmsetup", "status", name)
			if strings.Contains(status, loopDev) || strings.HasPrefix(name, "zkloud-") {
				run("cryptsetup", "close", name) //nolint:errcheck
			}
		}
		run("losetup", "-d", loopDev) //nolint:errcheck
	}
}

func run(name string, args ...string) error {
	out, err := exec.Command(name, args...).CombinedOutput()
	if err != nil {
		return fmt.Errorf("%s %v: %w — %s", name, args, err, strings.TrimSpace(string(out)))
	}
	return nil
}

func runOutput(name string, args ...string) (string, error) {
	out, err := exec.Command(name, args...).Output()
	return string(out), err
}

func randomMapperSuffix() string {
	b := make([]byte, 4)
	rand.Read(b)
	return hex.EncodeToString(b)
}
