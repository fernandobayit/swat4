# Design: SWAT4 como gerente multi-topologia (AD no host ou em container)

> Data: 2026-09-01 | Status: Aprovado

## Objetivo

Qualquer pessoa baixa o `docker-compose.yml` do swat4, preenche os dados do
dominio e usa a interface web de gerenciamento, seja o Samba AD rodando **no
host** ou **em container** (stack proprio do projeto samba-ad-fs).

## Decisoes

- O compose do swat4 sobe APENAS o gerenciamento: backend + frontend (imagens
  GHCR). O DC nunca e provisionado pelo swat4.
- Um arquivo base (`docker-compose.yml`) para AD no host + um override
  (`docker-compose.dc.yml`) para DC containerizado — commandos diferentes por
  modo, sem duplicar servicos no YAML.
- Configuracao 100% na secao `environment:` (sem `.env`), com interpolacao
  `${VAR:-default}`; nunca commitamos valores reais.
- `docker-compose.prod.yml` e removido (substituido pelo novo base).

## Topologias

### Modo 1: AD no host (padrao)

```
docker compose up -d
```
- backend alcança o DC via `extra_hosts: host.docker.internal:host-gateway`
- mounts: `/etc/samba` (rw), `/var/log/samba` (ro), `/mnt/data` (shares)
- defaults: `SAMBA_DC_HOST=host.docker.internal`, `LDAP_URL=ldap://host.docker.internal:389`

### Modo 2: DC containerizado (samba-ad-fs)

```
# no projeto samba-ad-fs:
docker compose up -d
# no swat4:
docker compose -f docker-compose.yml -f docker-compose.dc.yml up -d
```
- override troca os mounts por volumes externos nomeados do stack do DC:
  `samba-config`, `samba-logs`, `samba-shares` (nomes fisicos
  `<projeto>_<volume>`; prefixo configuravel via `${SAMBA_DC_COMPOSE_PROJECT:-samba-ad-fs}`)
- rede docker compartilhada `swat-net` com `name:` fixo nos dois repos:
  quem subir primeiro cria, o outro une (sem `docker network create` manual)
- `SAMBA_DC_HOST=samba-ad-dc1` (container_name do DC), `LDAP_URL=ldap://samba-ad-dc1:389`

## Variaveis (environment inline no compose base)

| Var | Default | Uso |
|---|---|---|
| SAMBA_REALM | SWAT.LOCAL | Realm do dominio |
| SAMBA_DOMAIN | SWAT | Nome netbios/curto |
| SAMBA_BASE_DN | DC=swat,DC=local | Base DN do LDAP |
| SAMBA_DC_HOST | host.docker.internal | Alvo do DC |
| LDAP_URL | ldap://host.docker.internal:389 | URL LDAP/LDAPS |
| SAMBA_ADMIN_USER | administrator | Usuario de servico |
| SAMBA_ADMIN_PASSWORD | ChangeThisPassword | Senha (placeholder recusado pelo backend? — validar) |
| JWT_SECRET | change-me | Chave JWT |
| ALLOWED_LOGIN_GROUPS | Domain Admins,Account Operators | Grupos com acesso |
| SWAT4_API_URL | http://localhost:8000 | URL publica do backend (frontend) |

## Mudancas por repo

### swat4
1. Reescrever `docker-compose.yml` (modo host, imagens GHCR, environment inline)
2. Criar `docker-compose.dc.yml` (override modo container)
3. Remover `docker-compose.prod.yml`
4. Atualizar README com os dois fluxos + tabela de variaveis

### samba-ad-fs
1. Adicionar volume `samba-shares:/mnt/data` (shares SMB servidos pelo DC)
2. Adicionar rede `swat-net` com `name: swat-net` fixo nos `networks:`
   (todos os servicos entram: default + swat-net)

## Erros/falhas
- Missing volume x network no modo containerizado: erros do compose serao
  claros apontando o item (documentado no README)
- Senha placeholder: entrada em branco/placeholder deve falhar de forma clara
  (backend valida? — delegar a checagem ao usuario; manter `${:-}` e README)

## Testes
- `docker compose config -q` (base e override)
- Smoke end-to-end: stack samba-ad-fs (DC) + swat4 override + login via LDAP
  na UI contra o DC containerizado