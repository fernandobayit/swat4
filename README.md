# SWAT4

Painel web de gerenciamento para Samba 4 Active Directory. Roda como dois
containers (backend FastAPI, frontend Next.js), e gerencia um DC que pode
estar rodando no proprio host ou containerizado.

## Topologias

| Modo | Comando | Quando usar |
|------|---------|-------------|
| AD no host | `docker compose up -d` | O Samba 4 AD DC ja roda no proprio host |
| AD containerizado | `docker compose -f docker-compose.yml -f docker-compose.dc.yml up -d` | O DC roda no stack do projeto samba-ad-fs, no mesmo host |

> Configuracao 100% na secao `environment:` do docker-compose.yml, com
> interpolacao `${VAR:-default}` — nao precisa de arquivo `.env`. Os
> placeholders (`ChangeThisPassword`, `change-this-jwt-secret`) devem ser
> trocados antes do uso, via `export` no shell ou edicao do arquivo. Nunca
> commite valores reais.

## Quick Start (AD no host)

1. Defina as variaveis obrigatorias no shell:

   ```bash
   export SAMBA_ADMIN_PASSWORD='...'
   export JWT_SECRET='...'
   ```

2. Suba os containers:

   ```bash
   docker compose up -d
   ```

3. Acesse `http://localhost:3000` e entre com uma conta do grupo
   `Domain Admins` (ou `Account Operators`).

> O backend monta `/etc/samba` (rw), `/var/log/samba` (ro) e `/mnt/data` do
> host. Em producao, rode com cuidado extra e use credenciais de servico
> fortes.

## Quick Start (DC containerizado)

1. Clone o samba-ad-fs no diretorio desejado (o nome do diretorio vira o
   prefixo dos volumes; o default esperado e `samba-ad-fs`).
2. Exporte as variaveis de dominio e suba o DC:

   ```bash
   # no diretorio do samba-ad-fs
   export SAMBA_ADMIN_PASSWORD='...'
   docker compose up -d
   ```

3. Suba o swat4 com o override:

   ```bash
   # no diretorio do swat4
   docker compose -f docker-compose.yml -f docker-compose.dc.yml up -d
   ```

4. Acesse `http://localhost:3000`.

Nesse modo o backend entra na rede docker `swat-net` compartilhada e monta os
volumes nomeados do stack do DC (`<projeto>_samba-config`,
`<projeto>_samba-logs`, `<projeto>_samba-shares`) — shares e logs continuam
funcionando.

- Se o seu projeto do DC tiver outro nome de diretorio, defina
  `SAMBA_DC_COMPOSE_PROJECT`. Exemplo:

  ```bash
  export SAMBA_DC_COMPOSE_PROJECT=dc-prod
  ```

- **Importante:** se houver um `.env` local definindo `SAMBA_DC_HOST` ou
  `LDAP_URL`, ele sobrescreve os defaults do override — remova ou faca `unset`
  nessas variaveis para o modo containerizado.
- **Nota de rede:** quem subir primeiro (DC ou swat4) cria a rede `swat-net`;
  o outro se junta automaticamente.

## Acesso via NetBird (opcional)

O frontend pode entrar na malha NetBird como **peer independente** (mesmo
modelo do DC no samba-ad-fs): o painel fica acessivel via
`http://<ip-mesh>:3000` a partir de qualquer peer autorizado, sem depender do
NetBird embutido do DC.

```bash
export NETBIRD_MANAGEMENT_URL='https://seu-management:33073'
export NETBIRD_SETUP_KEY='sua-setup-key'
docker compose up -d
```

- Sem `NETBIRD_SETUP_KEY`, o frontend sobe normalmente sem NetBird.
- A identidade do peer persiste nos volumes `swat4-netbird-config` e
  `swat4-netbird-estado` (IP da malha estavel entre recriacoes).
- Se o acesso for exclusivo pela mesh, restrinja as portas publicadas no host
  para `127.0.0.1:` (ex.: `"127.0.0.1:3000:3000"` e `"127.0.0.1:8000:8000"`).
- O DNS management do cliente fica **desativado** (`netbird up --disable-dns`)
  para nao conflitar com o DNS interno do Docker usado na resolucao do
  `backend` (rewrite `/api` do Next.js).
- O container do frontend precisa de `cap_add: NET_ADMIN/NET_RAW` +
  `/dev/net/tun` (ja configurados no compose). Em hosts sem `/dev/net/tun`
  (ex.: LXC/Proxmox sem recurso TUN), o padrao e **degradar com aviso**:
  o painel sobe sem NetBird. Para obrigar a mesh (abortar o container se nao
  conectar), defina `NETBIRD_STRICT=true`.
- O nome do container pode variar por host (remova `container_name:` ou ajuste
  no seu compose de deploy) — a imagem e identica em ambos os casos.

## Variaveis de ambiente

| Nome | Default | Descricao |
|------|---------|-----------|
| `SAMBA_DC_HOST` | `host.docker.internal` | Host do DC (no override dc: `samba-ad-dc1`) |
| `SAMBA_REALM` | `SWAT.LOCAL` | Realm do dominio |
| `SAMBA_DOMAIN` | `SWAT` | Nome curto/NetBIOS do dominio |
| `SAMBA_BASE_DN` | `DC=swat,DC=local` | Base DN do LDAP |
| `LDAP_URL` | `ldap://host.docker.internal:389` | URL do LDAP/LDAPS (no override dc: `ldap://samba-ad-dc1:389`) |
| `SAMBA_ADMIN_USER` | `administrator` | Usuario de servico para o LDAP |
| `SAMBA_ADMIN_PASSWORD` | `ChangeThisPassword` | Senha do usuario de servico — obrigatorio trocar |
| `JWT_SECRET` | `change-this-jwt-secret` | Segredo JWT — obrigatorio trocar |
| `ALLOWED_LOGIN_GROUPS` | `Domain Admins,Account Operators` | Grupos com acesso ao painel |
| `SWAT4_API_URL` | `http://localhost:8000` | URL publica do backend usada no navegador: use o host/IP do servidor se o painel for acessado remotamente (importante no modo containerizado se o navegador nao rodar no mesmo host do docker) |
| `NETBIRD_MANAGEMENT_URL` | *(vazio)* | URL do Management NetBird self-hosted (obrigatoria se `NETBIRD_SETUP_KEY` estiver definida) |
| `NETBIRD_SETUP_KEY` | *(vazio)* | Setup key para o frontend entrar na mesh como peer independente; vazio desativa o NetBird |

## Arquitetura resumida

- **backend** (FastAPI, porta 8000): usa python-ldap para falar com o DC e
  SQLite local para auditoria.
- **frontend** (Next.js, porta 3000): faz proxy de `/api` para o backend.
- Imagens hospedadas em `ghcr.io/fernandobayit/swat4-backend` e
  `ghcr.io/fernandobayit/swat4-frontend`.

## Desenvolvimento local dos servicos

Para build local, descomente/crie `build:` nos servicos do compose (ou use o
script `build-push.sh` para publicar em outro registry).
