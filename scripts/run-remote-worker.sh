#!/usr/bin/env bash
# Start a dis-com worker on a remote host (outside docker-compose).
#
# Required:
#   --node-id ID
#   --orchestrator URL    base URL of the orchestrator
#   --worker-url URL      base URL the orchestrator should call back on
#   --peer ADDR           "host:port" or "tls://host:port"
#
# Optional: --model, --image, --name, --worker-port, --axl-tcp-port, --axl-api-port,
#           --data-volume, --hf-cache, --foreground, --dry-run, --tailscale-auth KEY
#
# When --tailscale-auth is given: --worker-url is optional (auto-detected from Tailscale IP).
#   --peer should be the peer's Tailscale IP or MagicDNS hostname.

set -euo pipefail

NODE_ID=""
ORCHESTRATOR_URL=""
WORKER_URL=""
PEER=""
MODEL_NAME="Qwen/Qwen2.5-3B-Instruct"
IMAGE="dis-com:latest"
NAME=""
WORKER_PORT=7000
AXL_TCP_PORT=7001
AXL_API_PORT=9002
DATA_VOLUME=""
HF_CACHE_VOLUME="discom-hf-cache"
DETACH_FLAG="-d"
DRY_RUN=0
TAILSCALE_AUTH=""

usage() {
    sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
    exit "${1:-0}"
}

while [ "$#" -gt 0 ]; do
    case "$1" in
        --node-id)        NODE_ID="$2"; shift 2 ;;
        --orchestrator)   ORCHESTRATOR_URL="$2"; shift 2 ;;
        --worker-url)     WORKER_URL="$2"; shift 2 ;;
        --peer)           PEER="$2"; shift 2 ;;
        --model)          MODEL_NAME="$2"; shift 2 ;;
        --image)          IMAGE="$2"; shift 2 ;;
        --name)           NAME="$2"; shift 2 ;;
        --worker-port)    WORKER_PORT="$2"; shift 2 ;;
        --axl-tcp-port)   AXL_TCP_PORT="$2"; shift 2 ;;
        --axl-api-port)   AXL_API_PORT="$2"; shift 2 ;;
        --data-volume)    DATA_VOLUME="$2"; shift 2 ;;
        --hf-cache)       HF_CACHE_VOLUME="$2"; shift 2 ;;
        --detach)         DETACH_FLAG="-d"; shift ;;
        --foreground)     DETACH_FLAG=""; shift ;;
        --dry-run)        DRY_RUN=1; shift ;;
        --tailscale-auth) TAILSCALE_AUTH="$2"; shift 2 ;;
        -h|--help)        usage 0 ;;
        *) echo "unknown flag: $1" >&2; usage 1 ;;
    esac
done

missing=()
[ -z "${NODE_ID}" ]          && missing+=("--node-id")
[ -z "${ORCHESTRATOR_URL}" ] && missing+=("--orchestrator")
# WORKER_URL is optional when --tailscale-auth is set (auto-detected inside container)
[ -z "${WORKER_URL}" ] && [ -z "${TAILSCALE_AUTH}" ] && missing+=("--worker-url")
[ -z "${PEER}" ]             && missing+=("--peer")
if [ "${#missing[@]}" -gt 0 ]; then
    echo "error: missing required flag(s): ${missing[*]}" >&2
    usage 1
fi

case "${PEER}" in
    tls://*) PEER_ADDR="${PEER}" ;;
    *)       PEER_ADDR="tls://${PEER}" ;;
esac

[ -z "${NAME}" ]        && NAME="discom-${NODE_ID}"
[ -z "${DATA_VOLUME}" ] && DATA_VOLUME="discom-${NODE_ID}-data"

cmd=(
    docker run
    ${DETACH_FLAG:+--detach}
    --name "${NAME}"
    --restart unless-stopped
    -e "NODE_ID=${NODE_ID}"
    -e "ORCHESTRATOR_URL=${ORCHESTRATOR_URL}"
    -e "WORKER_URL=${WORKER_URL}"
    -e "MODEL_NAME=${MODEL_NAME}"
    -e "AXL_API_URL=http://localhost:9002"
    -e "PEER_ADDR=${PEER_ADDR}"
    ${OWNER_API_KEY:+-e "OWNER_API_KEY=${OWNER_API_KEY}"}
    ${TAILSCALE_AUTH:+-e "TS_AUTHKEY=${TAILSCALE_AUTH}"}
    ${TAILSCALE_AUTH:+--cap-add NET_ADMIN}
    ${TAILSCALE_AUTH:+--device /dev/net/tun}
    -v "${DATA_VOLUME}:/data"
    -v "${HF_CACHE_VOLUME}:/root/.cache/huggingface"
    -p "${WORKER_PORT}:7000"
    -p "${AXL_TCP_PORT}:7001"
    -p "${AXL_API_PORT}:9002"
    "${IMAGE}"
    worker
)

printf 'running:'
for token in "${cmd[@]}"; do
    printf ' %q' "${token}"
done
printf '\n'

if [ "${DRY_RUN}" -eq 1 ]; then
    exit 0
fi

exec "${cmd[@]}"
