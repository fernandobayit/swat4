# Design: NetBird embutido no frontend do SWAT4 (peer independente)

> Data: 2026-10-07 | Status: Aprovado
>
> Implementado em 2026-10-07: runtime debian-slim, NetBird 0.79.0 via .deb
> oficial, `--disable-dns` no connect (preserva DNS do Docker p/ rewrite /api)
> e Next.js como usuario `nextjs` via `gosu`.

## Objetivo

O container do frontend do SWAT4 entra na mesh NetBird (self-hosted) como peer
independente, aos mesmos moldes do samba-ad-fs: painel web acessivel via IP da
malha (`http://<ip-mesh>:3000`), sem depender do NetBird do DC. Sem
`NETBIRD_SETUP_KEY`, o frontend sobe exatamente como hoje.

## Decisoes

- Cliente NetBird embutido na propria imagem do frontend (Abordagem A - builtin)
- Registro via Setup Key (env var); peer proprio e independente do peer do DC
- NetBird **opcional**: sem key, comportamento atual preservado (Next.js puro)
- **Fail-fast**: com key, falta de `/dev/net/tun` ou `NETBIRD_MANAGEMENT_URL`
  aborta com erro claro; connect que nao estabiliza em ~90s aborta (exit 1)
- Env vars com os MESMOS nomes usados no samba-ad-fs
- Volumes proprios preservam a identidade do peer entre recriacoes:
  `swat4-netbird-config` + `swat4-netbird-estado`
- Runtime do frontend troca de `node:20-alpine` para `node:20-bookworm-slim`
  (alpine nao possui pacote oficial; repo oficial `pkgs.netbird.io/debian`)
- Container roda com `cap_add: NET_ADMIN/NET_RAW` + `device /dev/net/tun`
  (suficiente para o netbird criar a wt0; sem `privileged` — mais portavel
  entre hosts). O Next.js continua executando como usuario `nextjs` via
  `gosu`.
- **Multi-host (2026-10-07)**: `container_name:` removido do compose-base;
  `NETBIRD_STRICT` (default `false`) — em host sem `/dev/net/tun` (ex.:
  LXC/Proxmox sem recurso TUN) o entrypoint apenas avisa (WARN) e sobe o
  painel sem NetBird; com `NETBIRD_STRICT=true`, mantem o fail-fast (exit 1)
  tambem nos casos de tun ausente, `NETBIRD_MANAGEMENT_URL` vazia e falha do
  `netbird up`.
- `docker-compose.dc.yml` NAO muda: o peer do swat4 e independente da topologia

## Arquitetura

```
┌──────────────────────────────────────────────┐
│ Container swat4-frontend (privileged)        │
│  /dev/net/tun                                │
│  ┌───────────────────┐ ┌──────────────────┐  │
│  │ netbird daemon    │ │ next.js :3000    │  │
│  │ (wt0, background) │ │ (usuario nextjs) │  │
│  └───────────────────┘ └──────────────────┘  │
│  Painel: http://<ip-mesh>:3000               │
│  /api/* continua via rewrite p/ backend:8000 │
└──────────────────────────────────────────────┘
```

## Mudancas

### swat4

1. `frontend/Dockerfile`: stage runtime para `node:20-bookworm-slim`;
   repo `pkgs.netbird.io/debian` + pacote `netbird`; mantidas as etapas de
   build (builder alpine pode permanecer); usuario `nextjs` mantido para o Next
2. `frontend/entrypoint.sh` (novo):
   - Sem `NETBIRD_SETUP_KEY` → log informativo → `exec su nextjs -c npm run start`
   - Com key: valida `/dev/net/tun` e `NETBIRD_MANAGEMENT_URL` (erro claro se
     faltar) → `netbird service run` em background (logs em
     `/var/log/netbird/`) → aguarda daemon live (`netbird status --check live`)
     → `netbird up --management-url ... --setup-key ...` → aguarda Connected
     (timeout ~90s; falha → exit 1) → `exec su nextjs -c npm run start`
3. `docker-compose.yml` (frontend): `privileged: true`, `devices: /dev/net/tun`,
   env `NETBIRD_MANAGEMENT_URL`/`NETBIRD_SETUP_KEY`, volumes do peer
4. Volumes top-level: `swat4-netbird-config`, `swat4-netbird-estado`
5. `.env.example`: comentario ja existente fica valido; garantir os 2 vars no
   bloco frontend do compose com interpolacao `${VAR:-}`
6. `README.md`: topologia de acesso via mesh + dica de restringir portas do
   host para `127.0.0.1` quando o acesso for exclusivo pela malha

## Env vars

| Variavel | Obrigatoria | Uso |
|---|---|---|
| `NETBIRD_MANAGEMENT_URL` | sim p/ mesh | URL do Management self-hosted |
| `NETBIRD_SETUP_KEY` | sim p/ mesh | Habilita NetBird + registro do peer |

## Erros e fail-fast

- Sem key → sobe so o Next (log informativo)
- Com key, `/dev/net/tun` ausente → mensagem de remedicao (devices no compose)
- Connect timeout/erro → exit 1 (padrao do deploy de referencia)

## Notas

- **DNS**: o cliente NetBird pode gerenciar `/etc/resolv.conf` do container;
  o rewrite do Next resolve `backend:8000` pelo DNS do Docker. Na implementacao,
  validar resolucao pos-connect; se necessario, desativar DNS management do
  cliente (`netbird up --disable-dns` ou equivalente)
- **Portas do host**: manter `3000:3000`/`8000:8000` publicadas ou restringir
  para `127.0.0.1:` fica a cargo do operador (dica no README)

## Verificacao

- Build da imagem do frontend
- Sem key → container sobe e UI responde em :3000
- Com key → `docker exec swat4-frontend netbird status` → Connected; wt0 com IP
- `curl http://<ip-mesh>:3000` de outro peer → UI carrega; login E2E via mesh
- Resolucao `/api/*` interna (rewrite para backend:8000) segue funcional
