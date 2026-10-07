#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  SWAT4 frontend entrypoint
#
#  Sobe o Next.js. Se NETBIRD_SETUP_KEY estiver definida, primeiro
#  entra na malha NetBird (peer independente — mesmo modelo do DC
#  do samba-ad-fs): daemon em background, connect via setup key,
#  aguarda Connected (fail-fast ~90s) e entao sobe o painel.
#  Sem key, o container sobe exatamente como antes (Next.js puro).
# ─────────────────────────────────────────────────────────────
set -e

NEXT_USER=nextjs

if [ -z "$NETBIRD_SETUP_KEY" ]; then
    echo "==> NetBird: NETBIRD_SETUP_KEY vazia — iniciando Next.js sem NetBird."
    exec gosu "$NEXT_USER" npm run start
fi

echo "==> NetBird: starting..."

# Comportamento multi-host: por padrao (NETBIRD_STRICT=false), se o ambiente
# nao suporta mesh (sem /dev/net/tun — ex.: LXC/Proxmox sem recurso TUN),
# apenas avisa e sobe o painel sem NetBird. Com NETBIRD_STRICT=true, mantem
# o fail-fast (exit 1).
_warn_degrade() {
    echo "WARN: NetBird desativado neste container — $1" >&2
    echo "WARN: Subindo apenas o painel. (NETBIRD_STRICT=true para abortar o container nesse caso)" >&2
    exec gosu "$NEXT_USER" npm run start
}

if [ ! -c /dev/net/tun ]; then
    if [ "$NETBIRD_STRICT" = "true" ]; then
        echo "ERROR: /dev/net/tun not available. Add 'devices: - /dev/net/tun' to the frontend service in docker-compose.yml (or set NETBIRD_STRICT=false)." >&2
        exit 1
    fi
    _warn_degrade "/dev/net/tun not available no host/container."
fi
if [ -z "$NETBIRD_MANAGEMENT_URL" ]; then
    if [ "$NETBIRD_STRICT" = "true" ]; then
        echo "ERROR: NETBIRD_MANAGEMENT_URL is required when NETBIRD_SETUP_KEY is set." >&2
        exit 1
    fi
    _warn_degrade "NETBIRD_MANAGEMENT_URL vazia com NETBIRD_SETUP_KEY definida."
fi

mkdir -p /var/log/netbird /etc/netbird /var/lib/netbird
rm -f /var/run/netbird.sock

# Daemon em background ("service run" herda o ambiente do container;
# "netbird service start" daemonizaria via systemd e perderia a env).
netbird service run --log-level info \
    --daemon-addr unix:///var/run/netbird.sock \
    --log-file /var/log/netbird/client.log \
    >> /var/log/netbird/console.log 2>&1 &
NB_PID=$!
disown "$NB_PID" 2>/dev/null || true

for _ in {1..10}; do
    if netbird status --check live >/dev/null 2>&1; then
        break
    fi
    sleep 1
done

# Connect — DNS management desativado: o container depende do DNS
# interno do Docker (127.0.0.11) para resolver o hostname `backend`
# usado no rewrite /api do Next.js. O acesso a nomes da malha fica
# por conta do navegador do operador (que entra na mesh pelo cliente
# dele), nao do container.
netbird up --management-url "$NETBIRD_MANAGEMENT_URL" --setup-key "$NETBIRD_SETUP_KEY" \
    --disable-dns 2>&1 || {
    if [ "$NETBIRD_STRICT" = "true" ]; then
        echo "ERROR: netbird up failed. Check NETBIRD_MANAGEMENT_URL and NETBIRD_SETUP_KEY." >&2
        exit 1
    fi
    echo "WARN: netbird up falhou — subindo apenas o painel (NETBIRD_STRICT=false)." >&2
    exec gosu "$NEXT_USER" npm run start
}

connected=0
for _ in {1..30}; do
    if netbird status --check startup >/dev/null 2>&1; then
        connected=1
        break
    fi
    sleep 3
done

if [ "$connected" -ne 1 ]; then
    echo "ERROR: NetBird did not reach Connected state within 90s." >&2
    netbird status 2>&1 | head -n 20 >&2
    exit 1
fi

echo "==> NetBird: connected."
_MESH_IP=$(ip -4 -o addr show wt0 2>/dev/null | awk '{print $4}' | cut -d/ -f1 | head -1)
if [ -n "$_MESH_IP" ]; then
    echo "==> NetBird: mesh IP ${_MESH_IP} — painel disponivel em http://${_MESH_IP}:3000"
fi

exec gosu "$NEXT_USER" npm run start
