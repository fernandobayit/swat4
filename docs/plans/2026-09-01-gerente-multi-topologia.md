# SWAT4 multi-topologia — Plano de Implementacao

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Um `docker-compose.yml` unico do swat4 (com override opcional) para gerenciar Samba AD no host OU containerizado (samba-ad-fs), com config via environment inline e imagens do GHCR.

**Architecture:** Compose base = backend+frontend (imagens GHCR, env com interpolacao, mounts de host para AD no host). Override `.dc.yml` = troca mounts por volumes externos do stack do DC + rede compartilhada `swat-net` (nome fixo nos 2 repos). Remover docker-compose.prod.yml.

**Tech Stack:** Docker Compose, GHCR, FastAPI/Next (imagens ja publicadas).

---

## Task 1: Reescrever docker-compose.yml (modo host)

**Files:**
- Modify: `docker-compose.yml` (raiz swat4)

**Step 1: Escrever o novo base**

```yaml
# SWAT4 — Samba 4 Web Administration Tool
# Modo padrao: Samba AD rodando no proprio host.
# Se o seu DC e containerizado (projeto samba-ad-fs), use o override:
#   docker compose -f docker-compose.yml -f docker-compose.dc.yml up -d
# Preencha as variaveis abaixo (ou export no shell). Nunca commite valores reais.

services:
  backend:
    image: ghcr.io/fernandobayit/swat4-backend:latest
    pull_policy: always
    container_name: swat4-backend
    extra_hosts:
      - "host.docker.internal:host-gateway"
    environment:
      SAMBA_DC_HOST: ${SAMBA_DC_HOST:-host.docker.internal}
      SAMBA_REALM: ${SAMBA_REALM:-SWAT.LOCAL}
      SAMBA_DOMAIN: ${SAMBA_DOMAIN:-SWAT}
      SAMBA_BASE_DN: ${SAMBA_BASE_DN:-DC=swat,DC=local}
      LDAP_URL: ${LDAP_URL:-ldap://host.docker.internal:389}
      SAMBA_ADMIN_USER: ${SAMBA_ADMIN_USER:-administrator}
      SAMBA_ADMIN_PASSWORD: ${SAMBA_ADMIN_PASSWORD:-ChangeThisPassword}
      JWT_SECRET: ${JWT_SECRET:-change-this-jwt-secret}
      ALLOWED_LOGIN_GROUPS: ${ALLOWED_LOGIN_GROUPS:-Domain Admins,Account Operators}
      SAMBA_LOG_PATH: /var/log/samba
      TZ: ${TZ:-America/Sao_Paulo}
    volumes:
      - /etc/samba:/etc/samba
      - /var/log/samba:/var/log/samba:ro
      - /mnt/data:/mnt/data
      - swat4-data:/app/data
    ports:
      - "8000:8000"
    restart: unless-stopped

  frontend:
    image: ghcr.io/fernandobayit/swat4-frontend:latest
    pull_policy: always
    container_name: swat4-frontend
    environment:
      - NEXT_PUBLIC_API_URL=${SWAT4_API_URL:-http://localhost:8000}
      - API_URL=http://backend:8000
    ports:
      - "3000:3000"
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  swat4-data:
```

**Step 2: Validar**

Run: `docker compose config -q; echo exit=$?` — Expected: `exit=0` (nao imprimir config completo).

**Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: compose base multi-topologia (modo AD no host)"
```

---

## Task 2: Criar docker-compose.dc.yml (override DC containerizado)

**Files:**
- Create: `docker-compose.dc.yml`

**Step 1: Escrever o override**

```yaml
# SWAT4 — override para DC containerizado (projeto samba-ad-fs no mesmo host).
# Uso:
#   docker compose -f docker-compose.yml -f docker-compose.dc.yml up -d
# Pre-requisito: o stack do DC ja deve estar rodando:
#   (no diretorio do samba-ad-fs) docker compose up -d
# Se o DC vive em outro diretorio/projeto, defina SAMBA_DC_COMPOSE_PROJECT.

services:
  backend:
    extra_hosts: !reset null
    environment:
      SAMBA_DC_HOST: ${SAMBA_DC_HOST:-samba-ad-dc1}
      LDAP_URL: ${LDAP_URL:-ldap://samba-ad-dc1:389}
    volumes:
      - type: volume
        source: samba-config
        target: /etc/samba
      - type: volume
        source: samba-logs
        target: /var/log/samba
        read_only: true
      - type: volume
        source: samba-shares
        target: /mnt/data
      - swat4-data:/app/data
    networks:
      - default
      - swat-net

frontend:
    networks:
      - default
      - swat-net

volumes:
  samba-config:
    external: true
    name: ${SAMBA_DC_COMPOSE_PROJECT:-samba-ad-fs}_samba-config
  samba-logs:
    external: true
    name: ${SAMBA_DC_COMPOSE_PROJECT:-samba-ad-fs}_samba-logs
  samba-shares:
    external: true
    name: ${SAMBA_DC_COMPOSE_PROJECT:-samba-ad-fs}_samba-shares

networks:
  swat-net:
    name: swat-net
    driver: bridge
```

**Step 2: Validar os dois arquivos juntos**

Run: `docker compose -f docker-compose.yml -f docker-compose.dc.yml config -q; echo exit=$?` — Expected: `exit=0`.

**Step 3: Commit**

```bash
git add docker-compose.dc.yml
git commit -m "feat: override para DC containerizado (samba-ad-fs)"
```

---

## Task 3: Remover docker-compose.prod.yml

**Files:**
- Delete: `docker-compose.prod.yml`

**Step 1:** `git rm docker-compose.prod.yml`

**Step 2: Commit**

```bash
git commit -m "refactor: remover docker-compose.prod.yml (substituido pelo base)"
```

---

## Task 4: README (fluxos e variaveis)

**Files:**
- Modify: `README.md` (swat4)

Reescrever com: visao geral dos 2 modos; tabela de variaveis do compose; quick start
para cada topologia; aviso de seguranca (placeholders/cobrem; observacao sobre senha
do admin); como build local dos servicos (comentarios). Substituir qualquer referencia
a docker-compose.prod.yml e ao samba-dc build local.

Commit: `docs: README multi-topologia`

---

## Task 5: samba-ad-fs — shares + rede compartilhada

**Files:**
- Modify: `docker-compose.yml` (repo samba-ad-fs)
- Modify: `README.md` (repo samba-ad-fs, secao de integracao)

**Step 1:** Adicionar ao servico `samba-dc`: volume `samba-shares:/mnt/data`; declarar
volume `samba-shares:`; adicionar `networks: - default - swat-net` no servico; criar
`networks: swat-net: { name: swat-net, driver: bridge }`.

Validar: `docker compose config -q` no repo samba-ad-fs.

**Step 2:** README: nota na secao de integracao de que o swat4 se conecta via rede
`swat-net` compartilhada e volumes nomeados.

Commit: `feat: compartilhar shares e rede swat-net com o swat4`

---

## Task 6: Verificacao end-to-end

**Step 1:** Subir stack do DC (samba-ad-fs) com `export SAMBA_ADMIN_PASSWORD=...` e
aguardar healthy.

**Step 2:** Subir swat4 com override e env do mesmo dominio; aguardar backend.

**Step 3:** `curl localhost:8000/api/health` → healthy; testar login na API
(`/api/auth/login` com administrator do DC containerizado) → 200 + token.

**Step 4:** Down dos dois stacks; remover volumes de teste.

**Step 5:** Push das branches (se usando branch) e merge.