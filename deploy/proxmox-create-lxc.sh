#!/usr/bin/env bash
# Run this ON THE PROXMOX HOST (as root) to create an LXC and deploy SongFind into it.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "This script must be run as root on the Proxmox host." >&2
  exit 1
fi

prompt() {
  local var_name="$1" message="$2" default="$3" value
  read -rp "$message [$default]: " value
  printf -v "$var_name" '%s' "${value:-$default}"
}

DEFAULT_CTID=$(pvesh get /cluster/nextid 2>/dev/null || echo 200)

prompt CTID        "Container ID"                                "$DEFAULT_CTID"
prompt HOSTNAME     "Hostname"                                    "songfind"
prompt IP_CIDR      "IP address with CIDR (e.g. 192.168.1.50/24)" ""
prompt GATEWAY      "Gateway IP"                                  ""
prompt BRIDGE       "Network bridge"                              "vmbr0"
prompt STORAGE      "Storage pool for rootfs"                     "local-lvm"
prompt DISK_GB      "Disk size (GB)"                               "8"
prompt RAM_MB       "RAM (MB)"                                     "2048"
prompt CORES        "CPU cores"                                    "2"
prompt NAS_HOST_PATH "NAS path on the Proxmox HOST to bind-mount in" "/mnt/nas/omv2"
prompt REPO_URL     "Git repo URL to deploy"                       "https://github.com/Kkspike/songfind.git"

if [ -z "$IP_CIDR" ] || [ -z "$GATEWAY" ]; then
  echo "IP address and gateway are required." >&2
  exit 1
fi

echo "==> Making sure a Debian 12 template is available"
pveam update >/dev/null
TEMPLATE=$(pveam available --section system | grep -o 'debian-12-standard[^ ]*' | sort -V | tail -1)
if [ -z "$TEMPLATE" ]; then
  echo "Could not find a debian-12-standard template in 'pveam available'." >&2
  exit 1
fi
if ! pveam list local | grep -q "$TEMPLATE"; then
  pveam download local "$TEMPLATE"
fi
TEMPLATE_PATH="local:vztmpl/$TEMPLATE"

echo "==> Creating CT $CTID ($HOSTNAME)"
pct create "$CTID" "$TEMPLATE_PATH" \
  -hostname "$HOSTNAME" \
  -cores "$CORES" \
  -memory "$RAM_MB" \
  -swap 512 \
  -rootfs "${STORAGE}:${DISK_GB}" \
  -net0 "name=eth0,bridge=${BRIDGE},ip=${IP_CIDR},gw=${GATEWAY}" \
  -features "nesting=1,keyctl=1" \
  -unprivileged 1 \
  -onboot 1

echo "==> Bind-mounting NAS path ($NAS_HOST_PATH -> /mnt/nas-music)"
pct set "$CTID" -mp0 "${NAS_HOST_PATH},mp=/mnt/nas-music"

echo "==> Starting CT $CTID"
pct start "$CTID"

echo "==> Waiting for networking inside the container"
for i in $(seq 1 30); do
  if pct exec "$CTID" -- getent hosts github.com >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

INNER_SCRIPT="$(mktemp)"
cat > "$INNER_SCRIPT" <<EOS
set -euo pipefail
apt-get update
apt-get install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
git clone "$REPO_URL" /opt/songfind
cd /opt/songfind
echo "NAS_MOUNT_PATH=/mnt/nas-music" > .env
docker compose up -d --build
EOS

echo "==> Installing Docker and deploying SongFind inside CT $CTID (this can take a few minutes)"
pct push "$CTID" "$INNER_SCRIPT" /root/deploy-songfind.sh
pct exec "$CTID" -- bash /root/deploy-songfind.sh
rm -f "$INNER_SCRIPT"

IP_ONLY="${IP_CIDR%%/*}"
cat <<EOF

==> Done.

SongFind should now be reachable at: http://${IP_ONLY}:3000

Next steps:
  1. Open the app, go to Settings, and set "NAS mount path" to /mnt/nas-music
  2. Configure Lidarr / Azuracast / Spotify credentials in Settings
  3. Once your reverse proxy is in front of this LXC, update the Spotify
     redirect URI in Settings (and re-save it in the Spotify dashboard)
EOF
