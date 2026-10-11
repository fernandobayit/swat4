# ── Stage 1: Build ──────────────────────────────────────
# Debian (não alpine): os node_modules do build precisam ser glibc —
# o runtime (abaixo) também é debian e roda os mesmos binários nativos.
FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY package.json ./
RUN npm install --legacy-peer-deps

COPY . .

RUN npm run build

# ── Stage 2: Runtime ────────────────────────────────────
FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# NetBird (mesh VPN) — optional, enabled via NETBIRD_SETUP_KEY.
# Mesmo padrão do DC (samba-ad-fs): pacote .deb do release oficial.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gnupg \
    iproute2 \
    gosu \
    && case "$(dpkg --print-architecture)" in \
      amd64) NB_ARCH=amd64 ;; \
      arm64) NB_ARCH=arm64 ;; \
      *) NB_ARCH=amd64 ;; \
    esac && \
    curl -sSL -o /tmp/netbird.deb "https://github.com/netbirdio/netbird/releases/download/v0.80.0/netbird_0.80.0_linux_${NB_ARCH}.deb" && \
    apt-get install -y --no-install-recommends /tmp/netbird.deb && \
    rm -f /tmp/netbird.deb && \
    rm -rf /var/lib/apt/lists/*

RUN addgroup --system --gid 1001 nextjs && \
    adduser  --system --uid 1001 nextjs

COPY --from=builder /app/public          ./public
COPY --from=builder /app/.next           ./.next
COPY --from=builder /app/node_modules     ./node_modules
COPY --from=builder /app/package.json     ./package.json
COPY --from=builder /app/next.config.js   ./next.config.js
COPY --from=builder /app/messages         ./messages

# Entrypoint: sem NETBIRD_SETUP_KEY roda só o Next (como antes);
# com key, entra na mesh antes de subir o painel.
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Sem USER nextjs: o entrypoint roda como root (netbird precisa de
# /dev/net/tun + firewall) e troca para nextjs via gosu no Next.js.

EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]