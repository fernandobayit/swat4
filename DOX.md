# SWAT4 - Documentacao Tecnica de Referencia (DOX)

> Guia de referencia completo para manutencao e evolucao do projeto SWAT4.
> Ultima atualizacao: Junho 2026

---

## 1. Visao Geral

**SWAT4** (Samba 4 Web Administration Tool) e um painel web para gerenciamento de Samba 4 Active Directory. Permite administrar usuarios, grupos, OUs, compartilhamentos, DNS, politicas de senha e logs atraves de uma interface web moderna.

**Dominio padrao**: `SWAT.LOCAL` | **DC**: `dc1.swat.local` | **Admin**: `administrator` (senha definida via `SAMBA_ADMIN_PASSWORD`)

---

## 2. Arquitetura

```
┌──────────────────────────────────────────────────────────────────┐
│                        Docker Compose                            │
│                                                                  │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────┐ │
│  │   Frontend      │  │    Backend      │  │   Samba DC         │ │
│  │   Next.js 14    │──│   FastAPI        │──│   Samba 4 AD DC    │ │
│  │   :3000         │  │   :8000          │  │   :389/636/445/88 │ │
│  │   React 18      │  │   python-ldap   │  │   ldap://samba-dc  │ │
│  │   Tailwind CSS  │  │   SQLite local  │  │   smb.conf        │ │
│  └────────────────┘  └────────────────┘  └────────────────────┘ │
│        │                    │                     │               │
│  /api/* ──rewrite──>  backend:8000/api/*    ldap bind (389/636)  │
│                        │                     │                    │
│                        └── volumes ──────────┘                    │
│                             samba-etc, samba-logs, swat4-shares   │
│                                                                  │
│  Rede: swat-net (172.20.0.0/24)                                 │
│  samba-dc IP fixo: 172.20.0.10                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Fluxo de Comunicacao

1. **Frontend -> Backend**: Next.js rewrites `/api/*` para `http://backend:8000/api/*` (SSR) ou `/api/*` (client-side, via proxy do Next.js)
2. **Backend -> Samba DC**: python-ldap conecta via `ldap://samba-dc:389` (ou `ldaps://samba-dc:636`) para operacoes LDAP
3. **Backend -> Samba DC (DNS)**: `samba-tool dns` via subprocess para operacoes DNS
4. **Backend -> Samba DC (Shares)**: Leitura/escrita direta de `/etc/samba/smb.conf` (volume compartilhado) + `smbcacls` e `smbcontrol` via subprocess
5. **Backend -> SQLite**: Arquivo local em `/app/data/swat4_activity.db` para auditoria e configuracao de roles

---

## 3. Estrutura de Diretorios

```
swat/
├── docker-compose.yml          # Orquestracao de 3 servicos + rede/volumes
├── .env                        # Variaveis de ambiente (NAO commitar em prod)
├── .env.example                # Template de variaveis
├── README.md
│
├── backend/
│   ├── Dockerfile              # Python 3.12-slim + samba deps
│   ├── requirements.txt        # Dependencias Python
│   ├── pytest.ini              # Config do pytest
│   ├── test_dns.py             # Testes manuais de DNS
│   ├── tmp_roles_schema.py     # Script temporario de schema de roles
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py             # FastAPI app + startup + CORS + routers
│   │   ├── config.py           # Pydantic Settings (env vars)
│   │   ├── database.py         # SQLite (atividades + role_settings)
│   │   ├── exceptions.py       # SambaToolError (excecao customizada)
│   │   ├── auth/
│   │   │   ├── __init__.py
│   │   │   ├── dependencies.py # get_current_user (JWT decode)
│   │   │   ├── jwt_handler.py  # create/decode JWT
│   │   │   ├── ldap_auth.py    # authenticate_user + get_admin_connection
│   │   │   └── rbac.py         # require_role() dependency
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   └── schemas.py      # Pydantic models (request/response)
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py         # POST /api/auth/login, GET /api/auth/me
│   │   │   ├── users.py        # CRUD /api/users
│   │   │   ├── groups.py       # CRUD /api/groups + members
│   │   │   ├── shares.py       # CRUD /api/shares
│   │   │   ├── dns.py          # CRUD /api/dns (zones + records)
│   │   │   ├── ous.py          # GET/POST/DELETE /api/ous
│   │   │   ├── logs.py         # GET /api/logs
│   │   │   ├── activities.py   # GET /api/activities
│   │   │   ├── bulk.py         # POST /api/bulk/users, /api/bulk/groups
│   │   │   ├── domain.py       # GET/PUT /api/domain/password-policy
│   │   │   └── roles.py        # GET/PUT /api/roles/{role_name}/settings
│   │   └── services/
│   │       ├── __init__.py
│   │       ├── ldap_service.py  # Leitura LDAP (list users, groups, OU tree)
│   │       ├── samba_tool.py    # Escrita LDAP (create/delete users, groups, OUs, GPOs)
│   │       ├── dns_tool.py     # samba-tool dns subprocess
│   │       ├── share_service.py # smb.conf parser + smbcacls
│   │       └── log_service.py  # Leitura de /var/log/samba
│   └── tests/
│       └── test_api.py
│
├── frontend/
│   ├── Dockerfile              # Node 20-alpine + next dev
│   ├── package.json            # Dependencias Node
│   ├── next.config.js          # Proxy /api/* -> backend:8000
│   ├── tailwind.config.ts      # Design system (cores, fontes, animacoes)
│   ├── tsconfig.json
│   ├── postcss.config.js
│   ├── jest.config.js
│   ├── jest.setup.ts
│   ├── messages/               # Internacionalizacao
│   │   ├── pt.json             # Portugues (padrao)
│   │   ├── en.json             # Ingles
│   │   └── es.json             # Espanhol
│   ├── public/                 # Assets estaticos (saxis-icon.png, saxis-2.png)
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx      # Root layout (metadata)
│   │   │   ├── globals.css     # CSS global + variaveis + animacoes
│   │   │   ├── page.tsx        # Redirect -> /dashboard ou /login
│   │   │   ├── login/
│   │   │   │   ├── layout.tsx  # Login layout (AuthProvider + I18nProvider)
│   │   │   │   └── page.tsx    # Pagina de login
│   │   │   └── dashboard/
│   │   │       ├── layout.tsx  # Dashboard layout (AuthProvider + I18nProvider + Sidebar)
│   │   │       ├── page.tsx    # Dashboard (stats cards)
│   │   │       ├── users/page.tsx     # Gestao de usuarios
│   │   │       ├── groups/page.tsx    # Gestao de grupos
│   │   │       ├── shares/page.tsx    # Gestao de compartilhamentos
│   │   │       ├── dns/page.tsx       # Listagem de zonas DNS
│   │   │       ├── dns/[zoneName]/page.tsx  # Registros DNS de uma zona
│   │   │       ├── logs/page.tsx     # Visualizador de logs
│   │   │       ├── activity/page.tsx # Log de atividades/auditoria
│   │   │       └── settings/page.tsx # Configuracoes (password policy + RBAC)
│   │   ├── components/
│   │   │   ├── sidebar.tsx     # Menu lateral com RBAC
│   │   │   ├── ou-tree.tsx     # Componente de arvore de OUs
│   │   │   └── help-modal.tsx  # Modal de ajuda contextual
│   │   └── lib/
│   │       ├── api.ts          # Cliente API (fetch + JWT + error handling)
│   │       ├── auth.tsx        # AuthProvider + useAuth hook
│   │       ├── i18n.tsx       # I18nProvider + useTranslation hook
│   │       ├── types.ts       # TypeScript interfaces
│   │       └── utils.ts       # cn() utility (tailwind-merge + clsx)
│   └── __tests__/
│       └── example.test.tsx
│
├── samba-dc/
│   ├── Dockerfile              # Ubuntu 22.04 + Samba AD DC
│   └── entrypoint.sh           # Provisionamento + dados de exemplo
│
└── samba-init/                 # (Vazio - scripts de inicializacao adicionais)
```

---

## 4. Backend - Detalhamento

### 4.1 Configuracao (`app/config.py`)

| Variavel | Default | Descricao |
|---|---|---|
| `SAMBA_DC_HOST` | `samba-dc` | Hostname do container Samba DC |
| `SAMBA_REALM` | `SWAT.LOCAL` | Realm Kerberos |
| `SAMBA_DOMAIN` | `SWAT` | NetBIOS domain name |
| `SAMBA_BASE_DN` | `DC=swat,DC=local` | Base DN para buscas LDAP |
| `LDAP_URL` | `ldap://samba-dc:389` | URL LDAP (.env override para `ldaps://samba-dc:636`) |
| `SAMBA_ADMIN_USER` | `administrator` | Usuario admin LDAP |
| `SAMBA_ADMIN_PASSWORD` | `<definir>` | Senha admin LDAP |
| `JWT_SECRET` | `<definir>` | Chave de assinatura JWT |
| `JWT_ALGORITHM` | `HS256` | Algoritmo JWT |
| `JWT_EXPIRE_MINUTES` | `480` (8h) | Tempo de expiracao do token |
| `SAMBA_LOG_PATH` | `/var/log/samba` | Caminho dos logs do Samba |
| `ALLOWED_LOGIN_GROUPS` | `Domain Admins,Account Operators` | Grupos autorizados para login (removido Domain Users) |

### 4.2 Autenticacao e Autorizacao

#### Fluxo de Login

```
POST /api/auth/login { username, password }
  │
  ├── ldap_auth.authenticate_user(username, password)
  │     ├── ldap.initialize(ldap_url)
  │     ├── conn.simple_bind_s(username@REALM, password)  // Valida credenciais
  │     ├── conn.search_s(base_dn, SUBTREE, filter, attrs) // Busca dados do usuario
  │     ├── Extrai: sAMAccountName, displayName, mail, memberOf, primaryGroupID
  │     └── Retorna dict com username, display_name, email, dn, groups[]
  │
  ├── ldap_auth.check_group_membership(groups, allowed_groups)
  │     └── Verifica intersecao com ALLOWED_LOGIN_GROUPS
  │
  └── jwt_handler.create_access_token({
        sub, display_name, email, dn, groups, exp
      })
      └── Retorna { access_token, user: UserInfo }
```

#### JWT Token Payload

```json
{
  "sub": "administrator",
  "display_name": "Administrator",
  "email": null,
  "dn": "CN=Administrator,CN=Users,DC=swat,DC=local",
  "groups": ["Domain Admins", "Domain Users"],
  "exp": 1718294400
}
```

#### RBAC (Role-Based Access Control)

O sistema de RBAC opera em **duas camadas**:

**Camada 1 — Login Gate** (`check_group_membership`): Define quais grupos AD podem fazer login. Apenas membros de `Domain Admins` ou `Account Operators` podem autenticar.

**Camada 2 — Permissões Granulares** (`require_permission`): Dentro do grupo `Account Operators`, as permissoes sao controladas por flags booleanas no banco SQLite (`role_settings`):

| Permissao | Campo no Banco | Efeito |
|---|---|---|
| `manage_users` | `can_manage_users` | Criar, editar, excluir usuarios e reset de senha |
| `manage_groups` | `can_manage_groups` | Criar, editar, excluir grupos e gerenciar membros |
| `manage_shares` | `can_manage_shares` | Criar, editar, excluir compartilhamentos |
| `view_dns` | `can_view_dns` | Visualizar zonas e registros DNS |

**Domain Admins** sempre tem acesso total a tudo, independentemente das flags.

| Perfil | Acessos |
|---|---|
| **Domain Admins** | Tudo: Users, Groups, Shares, DNS, Activities, Settings, Roles (sem restricao) |
| **Account Operators** | Apenas modulos onde as flags correspondentes estao habilitadas no perfil. Visualizacao basica (listar) e permitida, mas escrita depende da flag |
| **Domain Users** | NAO pode fazer login (removido de ALLOWED_LOGIN_GROUPS) |

**Implementacao no backend**:

- `require_role(["Domain Admins", "Account Operators"])` — Verifica se o usuario pertence a um dos grupos permitidos
- `require_permission("manage_users")` — Domain Admins sempre passam; Account Operators precisam ter `can_manage_users=True` no perfil
- `require_permission("manage_groups")` — Similar para grupos
- `require_permission("manage_shares")` — Similar para compartilhamentos
- `require_permission("view_dns")` — Similar para DNS (visualizacao)

**Implementacao no frontend**: Sidebar busca `/api/roles/Account%20Operators/settings` e filtra itens de menu baseado nas flags de permissao. Domain Admins veem tudo. As permissoes sao configuradas diretamente via API (`/api/roles/Account%20Operators/settings`), sem interface de edicao na pagina de Settings.

### 4.3 Routers - Referencia Rapida

| Router | Prefixo | Metodos | Roles Minimas |
|---|---|---|---|
| `auth.py` | `/api/auth` | POST login, GET me | Nenhuma (login) |
| `users.py` | `/api/users` | GET list, GET/{username}, POST create, PUT/{username}, DELETE/{username} | Domain Admins, Account Operators (escrita requer `manage_users`) |
| `groups.py` | `/api/groups` | GET list, GET/{name}, POST create, PUT/{name}, DELETE/{name}, POST/{name}/members, DELETE/{name}/members | Domain Admins, Account Operators (escrita requer `manage_groups`) |
| `shares.py` | `/api/shares` | GET list, GET/{name}, POST create, PUT/{name}, DELETE/{name} | Domain Admins, Account Operators (escrita requer `manage_shares`) |
| `dns.py` | `/api/dns` | GET zones, POST zone, DELETE zone, GET/{zone}/records, POST/{zone}/records, DELETE/{zone}/records, PUT/{zone}/records | Domain Admins; GET requer `view_dns` |
| `ous.py` | `/api/ous` | GET tree, POST create, DELETE | Domain Admins, Account Operators |
| `logs.py` | `/api/logs` | GET /files, GET/{filename}?lines&level&search | Domain Admins, Account Operators |
| `activities.py` | `/api/activities` | GET ?limit&offset | Domain Admins |
| `bulk.py` | `/api/bulk` | POST /users (CSV), POST /groups (CSV) | Domain Admins, Account Operators (users) |
| `domain.py` | `/api/domain` | GET /password-policy, PUT /password-policy | GET: Domain Admins + Account Operators; PUT: Domain Admins |
| `roles.py` | `/api/roles` | GET/{role_name}/settings, PUT/{role_name}/settings | Domain Admins |

### 4.4 Services - Camada de Negocio

#### `ldap_service.py` - Operacoes de Leitura (python-ldap)

| Funcao | Descricao | Detalhes |
|---|---|---|
| `get_ou_tree()` | Retorna arvore hierarquica de OUs | Busca `(objectClass=organizationalUnit)`, constroi arvore via `_build_tree()` |
| `list_users(ou_dn)` | Lista usuarios (opcionalmente por OU) | Filtro: `(&(objectClass=user)(objectCategory=person)(!(objectClass=computer)))` |
| `get_user(username)` | Busca usuario por sAMAccountName | Retorna dict com dn, username, given_name, surname, display_name, email, enabled, when_created, member_of |
| `list_groups(ou_dn)` | Lista grupos de seguranca | Filtro: `(&(objectClass=group)(groupType:...))` com bit 0x80000000 |
| `get_group(name)` | Busca grupo por cn | Retorna dn, name, description, members, member_count, group_type |

**Nota sobre `enabled`**: Determinado pelo bit 0x2 (ACCOUNTDISABLE) do atributo `userAccountControl`. Se o bit estiver setado, `enabled = false`.

#### `samba_tool.py` - Operacoes de Escrita (python-ldap direto)

| Funcao | Operacao LDAP | Notas |
|---|---|---|
| `create_user()` | `conn.add_s()` + modify unicodePwd + modify UAC | Cria com UAC=544 (PASSWD_NOTREQD), depois seta UAC=512 e senha |
| `delete_user()` | `conn.delete_s()` | Busca DN primeiro via `_find_user_dn()` |
| `disable_user()` | Modify UAC: seta bit 0x2 | Le UAC atual, OR com 0x2 |
| `enable_user()` | Modify UAC: limpa bit 0x2 | Le UAC atual, AND com ~0x2 |
| `set_password()` | Modify `unicodePwd` | Encode: `f'"{password}"'.encode("utf-16-le")` |
| `modify_user_attributes()` | Modify replace/delete | Trata valores vazios como delete |
| `create_group()` | `conn.add_s()` | groupType: -2147483646 (Security) ou -2147483644 (Distribution) |
| `delete_group()` | `conn.delete_s()` | Busca DN primeiro |
| `modify_group_description()` | Modify replace/delete | |
| `add_group_members()` | Modify add `member` | Tolerante a TYPE_OR_VALUE_EXISTS |
| `remove_group_members()` | Modify delete `member` | Tolerante a NO_SUCH_ATTRIBUTE |
| `get_group_sid()` | Search `objectSid` + parse binario | Retorna formato S-1-5-21-... |
| `create_ou()` | `conn.add_s()` | |
| `delete_ou()` | `conn.delete_s()` | Falha com NOT_ALLOWED_ON_NONLEAF se OU nao vazia |
| `list_gpos()` | Search `(objectClass=groupPolicyContainer)` | Container: `CN=Policies,CN=System,{base_dn}` |
| `create_gpo()` | `conn.add_s()` | Gera UUID, cria container com gPCFileSysPath |
| `delete_gpo()` | `conn.delete_s()` | Deleta filhos (Machine, User) primeiro |
| `link_gpo()` | Modify `gPLink` attribute | Formato: `[LDAP://CN={guid},CN=Policies,...;0]` |
| `unlink_gpo()` | Modify `gPLink` | Remove especifico GPO link via regex |

#### `dns_tool.py` - Operacoes DNS (subprocess samba-tool)

| Funcao | Comando | Notas |
|---|---|---|
| `list_zones()` | `samba-tool dns zonelist` | Parseia saida texto, hidrata com record count |
| `create_zone()` | `samba-tool dns zonecreate` | |
| `delete_zone()` | `samba-tool dns zonedelete` | |
| `list_records()` | `samba-tool dns query` | Parseia formato `Name=X, Records=N` + tipo:data |
| `add_record()` | `samba-tool dns add` | |
| `delete_record()` | `samba-tool dns delete` | Requer nome, tipo E data exata |
| `update_record()` | `samba-tool dns update` | Requer old_data e new_data |

**Nota**: `run_samba_dns_cmd()` resolve hostname para IP via `socket.gethostbyname()` para evitar timeouts DCE-RPC.

#### `share_service.py` - Gerenciamento de Compartilhamentos

| Funcao | Metodo | Notas |
|---|---|---|
| `parse_smb_conf()` | Parser de arquivo | Le `/etc/samba/smb.conf`, retorna dict de secoes |
| `list_shares()` | Parser | Exclui `sysvol`, `netlogon`, `IPC$`, `print$`, `global` |
| `get_share()` | Parser | Retorna dict da secao |
| `add_share()` | Append + ACL | Cria diretorio em `/mnt/data/Corporativo/{name}`, cria grupos AD `Acesso Escrita {name}` e `Acesso Leitura {name}`, seta ACL via `smbcacls` com SDDL |
| `update_share()` | Regex replace | Substitui secao inteira no smb.conf |
| `delete_share()` | Regex replace | Remove secao + diretorio + grupos AD associados |
| `_reload_samba()` | subprocess | `smbcontrol all reload-config` |

**SDDL padrao para shares**: `O:BAG:BAD:PAI(A;OICI;0x001f01ff;;;BA)(A;OICI;0x001301bf;;;{SID_WRITE})(A;OICI;0x001200a9;;;{SID_READ})`

**Nota**: O IP do DC esta hardcoded como `172.20.0.10` no `add_share()`. Isso precisa ser tornado configuravel.

#### `log_service.py` - Leitura de Logs

| Funcao | Descricao |
|---|---|
| `list_log_files()` | Lista arquivos em `/var/log/samba/` |
| `read_log(filename, lines, level_filter, search)` | Le as ultimas N linhas com filtros opcionais |

**Seguranca**: `read_log()` verifica path traversal comparando `os.path.realpath()` com o diretorio base.

### 4.5 Banco de Dados SQLite

Localizacao: `/app/data/swat4_activity.db` (volume `swat4-data`)

#### Tabela `activities`

| Coluna | Tipo | Descricao |
|---|---|---|
| `id` | INTEGER PK | Auto-increment |
| `username` | TEXT NOT NULL | Usuario que executou a acao |
| `action` | TEXT NOT NULL | CREATE, UPDATE, DELETE |
| `entity_type` | TEXT NOT NULL | User, Group, Share, DNS Zone, etc. |
| `entity_name` | TEXT NOT NULL | Nome da entidade afetada |
| `details` | TEXT | Descricao adicional |
| `timestamp` | DATETIME | DEFAULT CURRENT_TIMESTAMP |

#### Tabela `role_settings`

| Coluna | Tipo | Descricao |
|---|---|---|
| `role_name` | TEXT PK | Nome do grupo AD (ex: "Account Operators") |
| `settings` | TEXT NOT NULL | JSON com configuracoes do perfil |

### 4.6 Schemas (Pydantic Models)

| Schema | Campos |
|---|---|
| `LoginRequest` | username, password |
| `TokenResponse` | access_token, token_type, user: UserInfo |
| `UserInfo` | username, display_name, email, dn, groups[] |
| `UserCreate` | username, password, given_name (alias: givenName), surname (alias: sn), display_name (alias: displayName), email, ou, enabled |
| `UserUpdate` | given_name, surname, display_name, email, enabled, password (todos Optional) |
| `UserResponse` | dn, username, given_name, surname, display_name, email, enabled, when_created, member_of[], ou |
| `GroupCreate` | name, description, ou, group_type (default: "Security") |
| `GroupUpdate` | description |
| `GroupResponse` | dn, name, description, members[], member_count, group_type, ou |
| `GroupMemberAction` | members[] |
| `ShareCreate` | name, path, comment, veto_files, write_list |
| `ShareUpdate` | path, comment, veto_files, write_list |
| `ShareResponse` | name, path, comment, veto_files, write_list |
| `OUNode` | dn, name, children[] (recursivo), has_users, has_groups, has_gpos |
| `OUCreate` | name, parent_dn |
| `LogResponse` | entries[], total, file |
| `LogEntry` | timestamp, level, source, message |
| `DNSZoneResponse` | name, type, recordsCount |
| `DNSZoneCreate` | name |
| `DNSRecordResponse` | name, type, data |
| `DNSRecordCreate` | name, type, data |
| `DNSRecordUpdate` | old_data, new_data |
| `PasswordPolicy` | complexity_enabled, store_plaintext, history_length, min_pwd_length, min_pwd_age_days, max_pwd_age_days, lockout_duration_mins, lockout_threshold, reset_lockout_after_mins |
| `PasswordPolicyUpdate` | Todos optional |
| `RoleSettingsSchema` | visible_groups_regex, visible_groups_list[], can_view_dns, can_manage_users, can_manage_groups, can_manage_shares |

### 4.7 Tratamento de Erros

| Tipo | HTTP Status | Cenario |
|---|---|---|
| `SambaToolError` | 400 | Operacao LDAP/DNS falhou |
| `HTTPException(401)` | 401 | Credenciais invalidas ou token expirado |
| `HTTPException(403)` | 403 | Usuario nao pertence a grupo autorizado |
| `HTTPException(404)` | 404 | Entidade nao encontrada |
| `HTTPException(500)` | 500 | Erro interno inesperado |

O handler global `samba_tool_exception_handler` em `main.py` converte `SambaToolError` em JSONResponse.

---

## 5. Frontend - Detalhamento

### 5.1 Design System

| Elemento | Valor |
|---|---|
| Cor primaria | `#0ABF16` (verde) |
| Cor primaria dark | `#027333` |
| Cor primaria light | `#C7FF9B` |
| Cor de acento | `#262626` (texto) |
| Cor de superficie | `#F5F5F5` (background) |
| Cor de borda | `#D9D9D9` |
| Fontes | Lexend (corpo), Urbanist (headings) |
| Border radius | xl: 16px, 2xl: 24px, 3xl: 32px |
| Sombras | card, elevated, modal |
| Animacoes | fade-in, slide-up, slide-in-right |

### 5.2 Cliente API (`src/lib/api.ts`)

- URL base: `/api` (client-side, via Next.js rewrite) ou `http://backend:8000/api` (SSR)
- Token JWT armazenado em `localStorage` chave `swat4_token`
- Usuario armazenado em `localStorage` chave `swat4_user`
- Em caso de 401: remove token e redireciona para `/login`
- Suporte a `FormData` para upload de CSV (bulk operations)

### 5.3 Context Providers

| Provider | Arquivo | Funcao |
|---|---|---|
| `AuthProvider` | `src/lib/auth.tsx` | Gerencia estado do usuario, login/logout, persistencia em localStorage |
| `I18nProvider` | `src/lib/i18n.tsx` | Gerencia idioma, persiste em localStorage chave `swat4_locale`, idioma padrao: `pt` |

### 5.4 Protecao de Rotas

- **Pagina raiz** (`/`): Redireciona para `/dashboard` se autenticado, `/login` se nao
- **Dashboard layout**: Verifica autenticacao, redireciona para `/login` se nao autenticado
- **Login layout**: Envolve com `I18nProvider` + `AuthProvider`

### 5.5 RBAC no Frontend

A sidebar (`src/components/sidebar.tsx`) controla visibilidade de itens de menu:

| Item | Rota | `requiredRole` |
|---|---|---|
| Dashboard | `/dashboard` | Nenhum |
| Usuarios | `/dashboard/users` | Nenhum |
| Grupos | `/dashboard/groups` | Nenhum |
| Compartilhamentos | `/dashboard/shares` | `Domain Admins` |
| Logs | `/dashboard/logs` | Nenhum |
| DNS | `/dashboard/dns` | `Domain Admins` |
| Atividades | `/dashboard/activity` | `Domain Admins` |
| Configuracoes | `/dashboard/settings` | `Domain Admins` |

### 5.6 Componentes

| Componente | Arquivo | Descricao |
|---|---|---|
| `Sidebar` | `src/components/sidebar.tsx` | Menu lateral colapsavel com RBAC, seletor de idioma, info do usuario, botao ajuda/logout |
| `OUTree` | `src/components/ou-tree.tsx` | Arvore hierarquica de OUs para filtrar usuarios/grupos. Carrega dados de `/api/ous` |
| `HelpModal` | `src/components/help-modal.tsx` | Modal de ajuda contextual com secoes RBAC-filtradas |

### 5.7 Paginas

| Pagina | Arquivo | Funcionalidade |
|---|---|---|
| Login | `src/app/login/page.tsx` | Formulario de login com selecao de idioma, toggle de visibilidade de senha |
| Dashboard | `src/app/dashboard/page.tsx` | Cards de estatisticas (usuarios, grupos, shares) com RBAC, info do dominio |
| Usuarios | `src/app/dashboard/users/page.tsx` | CRUD de usuarios + OU tree lateral + bulk import CSV + enable/disable/reset senha |
| Grupos | `src/app/dashboard/groups/page.tsx` | CRUD de grupos + OU tree + gerenciamento de membros + bulk import CSV |
| Compartilhamentos | `src/app/dashboard/shares/page.tsx` | CRUD de shares com formularios de criacao/edicao |
| DNS | `src/app/dashboard/dns/page.tsx` | Listagem de zonas DNS com cards |
| DNS Records | `src/app/dashboard/dns/[zoneName]/page.tsx` | CRUD de registros DNS (A, AAAA, CNAME, TXT, SRV, MX, PTR) |
| Logs | `src/app/dashboard/logs/page.tsx` | Visualizador de logs com seletor de arquivo, busca, filtro de nivel, auto-refresh |
| Atividades | `src/app/dashboard/activity/page.tsx` | Log de auditoria com icones por tipo de acao |
| Configuracoes | `src/app/dashboard/settings/page.tsx` | Password policy + RBAC profile para Account Operators |

### 5.8 Internacionalizacao

3 idiomas suportados via `next-intl` (carregamento estatico de JSON):

| Idioma | Arquivo | Flag |
|---|---|---|
| Portugues (padrao) | `messages/pt.json` | BR |
| Ingles | `messages/en.json` | US |
| Espanhol | `messages/es.json` | ES |

Chaves organizadas em: `common`, `auth`, `nav`, `dashboard`, `users`, `groups`, `shares`, `logs`, `ouTree`, `settings`, `dns`, `help`.

---

## 6. Infraestrutura Docker

### 6.1 Servicos

| Servico | Container | Imagem Base | Portas | Privilegio |
|---|---|---|---|---|
| `samba-dc` | `swat4-samba-dc` | Ubuntu 22.04 | 389, 636, 445, 88, 464, 3268, 3269 | `privileged: true` |
| `backend` | `swat4-backend` | Python 3.12-slim | 8000 | Normal |
| `frontend` | `swat4-frontend` | Node 20-alpine | 3000 | Normal |

### 6.2 Volumes

| Volume | Montagem | Uso |
|---|---|---|
| `samba-data` | `/var/lib/samba` | Dados do AD (persistente entre restarts) |
| `samba-etc` | `/etc/samba` | Configuracao smb.conf (compartilhado com backend) |
| `samba-logs` | `/var/log/samba` | Logs do Samba (read-only no backend) |
| `swat4-data` | `/app/data` | SQLite de atividades e roles |
| `swat4-shares` | `/mnt/data` | Diretorio de compartilhamentos |

### 6.3 Rede

- Nome: `swat-net`
- Driver: bridge
- Subnet: `172.20.0.0/24`
- `samba-dc` IP fixo: `172.20.0.10`

### 6.4 Healthcheck

```yaml
samba-dc:
  healthcheck:
    test: ["CMD", "samba-tool", "processes", "--configfile=/etc/samba/smb.conf"]
    interval: 15s
    timeout: 10s
    retries: 10
    start_period: 30s
```

### 6.5 Dependencias

```
samba-dc (healthy) -> backend -> frontend
```

O backend so inicia apos o samba-dc estar saudavel. O frontend depende do backend.

### 6.6 Entrypoint do Samba DC

O `entrypoint.sh` e responsavel por:

1. **Provisionamento**: Se `/var/lib/samba/.provisioned` nao existe, executa `samba-tool domain provision`
2. **Configuracao LDAP**: Adiciona `ldap server require strong auth = no` ao smb.conf (para permitir binds simples sem TLS)
3. **Dados de exemplo**: Cria OUs (Company, Users, Groups, IT, HR) e usuarios (john.doe, jane.smith, bob.wilson) e grupos (IT Staff, HR Team, Managers)
4. **Start**: `samba --foreground --no-process-group`

---

## 7. API Endpoints - Referencia Completa

### 7.1 Auth

| Metodo | Endpoint | Corpo | Resposta | Auth |
|---|---|---|---|---|
| POST | `/api/auth/login` | `{ username, password }` | `{ access_token, user }` | Nenhuma |
| GET | `/api/auth/me` | - | `{ username, display_name, ... }` | Bearer JWT |

### 7.2 Users

| Metodo | Endpoint | Corpo | Auth |
|---|---|---|---|
| GET | `/api/users?ou={dn}` | - | `require_role(["Domain Admins", "Account Operators"])` |
| GET | `/api/users/{username}` | - | `require_role(["Domain Admins", "Account Operators"])` |
| POST | `/api/users` | `UserCreate` | `require_permission("manage_users")` |
| PUT | `/api/users/{username}` | `UserUpdate` | `require_permission("manage_users")` |
| DELETE | `/api/users/{username}` | - | `require_permission("manage_users")` |

### 7.3 Groups

| Metodo | Endpoint | Corpo | Auth |
|---|---|---|---|
| GET | `/api/groups?ou={dn}` | - | `require_role(["Domain Admins", "Account Operators"])` (listagem filtrada por role_settings para nao-Admins) |
| GET | `/api/groups/{name}` | - | `require_role(["Domain Admins", "Account Operators"])` |
| POST | `/api/groups` | `GroupCreate` | `require_permission("manage_groups")` |
| PUT | `/api/groups/{name}` | `GroupUpdate` | `require_permission("manage_groups")` |
| DELETE | `/api/groups/{name}` | - | `require_permission("manage_groups")` |
| POST | `/api/groups/{name}/members` | `GroupMemberAction` | `require_permission("manage_groups")` |
| DELETE | `/api/groups/{name}/members` | `GroupMemberAction` | `require_permission("manage_groups")` |

### 7.4 Shares

| Metodo | Endpoint | Corpo | Auth |
|---|---|---|---|
| GET | `/api/shares` | - | `require_role(["Domain Admins", "Account Operators"])` |
| GET | `/api/shares/{name}` | - | `require_role(["Domain Admins", "Account Operators"])` |
| POST | `/api/shares` | `ShareCreate` | `require_permission("manage_shares")` |
| PUT | `/api/shares/{name}` | `ShareUpdate` | `require_permission("manage_shares")` |
| DELETE | `/api/shares/{name}` | - | `require_permission("manage_shares")` |

### 7.5 DNS

| Metodo | Endpoint | Corpo | Auth |
|---|---|---|---|
| GET | `/api/dns` | - | `require_permission("view_dns")` |
| POST | `/api/dns` | `DNSZoneCreate` | `require_role(["Domain Admins"])` |
| DELETE | `/api/dns/{zone_name}` | - | `require_role(["Domain Admins"])` |
| GET | `/api/dns/{zone_name}/records` | - | `require_permission("view_dns")` |
| POST | `/api/dns/{zone_name}/records` | `DNSRecordCreate` | `require_role(["Domain Admins"])` |
| DELETE | `/api/dns/{zone_name}/records?name&type&data` | - | `require_role(["Domain Admins"])` |
| PUT | `/api/dns/{zone_name}/records?name&type` | `DNSRecordUpdate` | `require_role(["Domain Admins"])` |

### 7.6 OUs

| Metodo | Endpoint | Corpo | Auth |
|---|---|---|---|
| GET | `/api/ous` | - | `require_role(["Domain Admins", "Account Operators"])` |
| POST | `/api/ous` | `OUCreate` | `require_role(["Domain Admins", "Account Operators"])` |
| DELETE | `/api/ous?ou_dn={dn}` | - | `require_role(["Domain Admins", "Account Operators"])` |

### 7.7 Logs

| Metodo | Endpoint | Params | Auth |
|---|---|---|---|
| GET | `/api/logs/files` | - | `require_role(["Domain Admins", "Account Operators"])` |
| GET | `/api/logs/{filename}` | `lines`, `level`, `search` | `require_role(["Domain Admins", "Account Operators"])` |

### 7.8 Activities

| Metodo | Endpoint | Params | Auth |
|---|---|---|---|
| GET | `/api/activities` | `limit`, `offset` | Domain Admins |

### 7.9 Bulk

| Metodo | Endpoint | Corpo | Auth |
|---|---|---|---|
| POST | `/api/bulk/users` | FormData (CSV) | Domain Admins / Account Operators |
| POST | `/api/bulk/groups` | FormData (CSV) | Domain Admins |

**CSV de usuarios**: Colunas: `username, password, givenName, surname, email, ou`
**CSV de grupos**: Colunas: `name, description, ou, groupType`

### 7.10 Domain

| Metodo | Endpoint | Corpo | Auth |
|---|---|---|---|
| GET | `/api/domain/password-policy` | - | Domain Admins / Account Operators |
| PUT | `/api/domain/password-policy` | `PasswordPolicyUpdate` | Domain Admins |

**Nota**: Valores de idade de senha em AD sao armazenados em intervals de 100 nanosegundos (negativos). Conversoes em `domain.py`.

### 7.11 Roles

| Metodo | Endpoint | Corpo | Auth |
|---|---|---|---|
| GET | `/api/roles/{role_name}/settings` | - | Domain Admins |
| PUT | `/api/roles/{role_name}/settings` | `RoleSettingsSchema` | Domain Admins |

---

## 8. Dados de Exemplo (Seed)

O entrypoint do Samba DC cria automaticamente:

### OUs
- `OU=Company,DC=swat,DC=local`
- `OU=Users,OU=Company,DC=swat,DC=local`
- `OU=Groups,OU=Company,DC=swat,DC=local`
- `OU=IT,OU=Company,DC=swat,DC=local`
- `OU=HR,OU=Company,DC=swat,DC=local`

### Usuarios
| Username | Nome | Email | OU |
|---|---|---|---|
| `john.doe` | John Doe | john.doe@swat.local | OU=Users,OU=Company |
| `jane.smith` | Jane Smith | jane.smith@swat.local | OU=Users,OU=Company |
| `bob.wilson` | Bob Wilson | bob.wilson@swat.local | OU=IT,OU=Company |

### Grupos
| Grupo | Descricao | Membros | OU |
|---|---|---|---|
| `IT Staff` | IT Department Staff | bob.wilson | OU=Groups,OU=Company |
| `HR Team` | HR Department | jane.smith | OU=Groups,OU=Company |
| `Managers` | Company Managers | john.doe | OU=Groups,OU=Company |

---

## 9. Notas de Seguranca e Producao

### Problemas Conhecidos

| ID | Severidade | Descricao | Arquivo | Status |
|---|---|---|---|---|
| SEC-001 | ALTA | JWT secret hardcoded (default vazio; deve vir de env var) | `backend/app/config.py` | Corrigido |
| SEC-002 | ALTA | CORS permite todas as origens (`allow_origins=["*"]`) | `backend/app/main.py:20` | Aberto |
| SEC-003 | MEDIA | IP do DC hardcoded `172.20.0.10` em `smbcacls` | `backend/app/services/share_service.py:136` | Aberto |
| SEC-004 | BAIXA | `ldap server require strong auth = no` no entrypoint | `samba-dc/entrypoint.sh:34` | Aberto |
| SEC-005 | MEDIA | Senha admin em texto plano no .env | `.env:13` | Aberto |
| SEC-006 | ~~RESOLVIDO~~ | ~~Grupos, Shares, OUs e Logs usavam `get_current_user` (qualquer autenticado)~~ | `backend/app/routers/*.py` | **Corrigido** - Agora usam `require_role` + `require_permission` |
| SEC-007 | ~~RESOLVIDO~~ | ~~`can_manage_users`, `can_manage_groups`, `can_view_dns` nunca eram verificados pelo backend~~ | `backend/app/auth/rbac.py` | **Corrigido** - Implementado `require_permission()` |
| SEC-008 | ~~RESOLVIDO~~ | ~~`Domain Users` em `ALLOWED_LOGIN_GROUPS` permitia login de qualquer usuario~~ | `.env`, `config.py` | **Corrigido** - Removido `Domain Users` |
| SEC-009 | ~~RESOLVIDO~~ | ~~`GET /api/auth/me` retornava `pass` (endpoint morto)~~ | `backend/app/routers/auth.py` | **Corrigido** - Retorna dados do usuario do token |
| PERF-001 | BAIXA | SQLite limita escalabilidade horizontal | `backend/app/database.py` | Aberto |
| MAINT-001 | ~~RESOLVIDO~~ | ~~Endpoint `GET /api/auth/me` nao implementado (pass)~~ | `backend/app/routers/auth.py` | **Corrigido** |
| MAINT-002 | MEDIA | Frontend usa `any` em varios lugares da API client | `frontend/src/lib/api.ts` | Aberto |

### Recomendacoes para Producao

1. **JWT_SECRET**: Gerar chave criptografica forte e injetar via variavel de ambiente
2. **CORS**: Restringir `allow_origins` ao dominio do frontend
3. **LDAPS**: Usar `ldaps://samba-dc:636` em producao (ja configurado no .env)
4. **IP do DC**: Tornar configuravel via env var em vez de hardcoded
5. **SQLite**: Considerar PostgreSQL para ambientes com multiplos replicas do backend
6. **HTTPS**: Adicionar reverse proxy (nginx/traefik) com certificado TLS
7. **Tipagem**: Substituir `any` por tipos especificos no frontend api.ts

---

## 10. Comandos Uteis

### Docker

```bash
# Iniciar todos os servicos
docker compose up -d --build

# Rebuild apenas o backend
docker compose up -d --build backend

# Ver logs do backend
docker compose logs -f backend

# Ver logs do samba-dc
docker compose logs -f samba-dc

# Parar tudo
docker compose down

# Parar e remover volumes (reset completo)
docker compose down -v
```

### Backend (local)

```bash
# Instalar dependencias
cd backend && pip install -r requirements.txt

# Rodar em desenvolvimento
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Rodar testes
pytest

# Ver documentacao da API
# http://localhost:8000/docs (Swagger UI)
# http://localhost:8000/redoc (ReDoc)
```

### Frontend (local)

```bash
# Instalar dependencias
cd frontend && npm install

# Rodar em desenvolvimento
npm run dev

# Build de producao
npm run build

# Rodar testes
npm test

# Lint
npm run lint
```

### Samba DC (dentro do container)

```bash
# Entrar no container
docker exec -it swat4-samba-dc bash

# Listar usuarios
samba-tool user list

# Listar grupos
samba-tool group list

# Criar usuario
samba-tool user create novouser 'Senha@123' --given-name=Novo --surname=Usuario

# Testar conexao LDAP
ldapsearch -x -H ldap://localhost -D "administrator@SWAT.LOCAL" -w '<password>' -b "DC=swat,DC=local" "(objectClass=user)"

# Verificar status do Samba
samba-tool processes

# Teste de DNS
samba-tool dns query 127.0.0.1 swat.local @ ALL -U "administrator%<password>"
```

---

## 11. Mapa de Dependencias

### Backend (Python)

```
fastapi==0.115.0          # Framework web
uvicorn[standard]==0.30.6 # Servidor ASGI
python-ldap==3.4.4        # Cliente LDAP
python-jose[cryptography]==3.3.0  # JWT
passlib[bcrypt]==1.7.4    # Hashing de senhas (nao usado ativamente)
pydantic==2.9.2           # Validacao de dados
pydantic-settings==2.5.2  # Configuracao via env vars
python-multipart==0.0.12  # Upload de arquivos (bulk import)
pytest>=8.0.0             # Testes
pytest-asyncio            # Testes async
pytest-cov                # Cobertura
httpx                     # Cliente HTTP para testes
```

### Frontend (Node)

```
next@14.2.15              # Framework React SSR
react@18.3.1              # UI library
next-intl@3.22.1          # Internacionalizacao
@radix-ui/react-*         # Componentes acessiveis (Dialog, Select, Toast, etc.)
lucide-react@0.454.0     # Icones
tailwindcss@3.4.14       # Utility CSS
class-variance-authority@0.7.0  # Variantes de componentes
clsx@2.1.1               # Condicao de classes
tailwind-merge@2.5.4     # Merge de classes Tailwind
jest@30.2.0               # Testes
@testing-library/react@16.3.2   # Testes de componentes
```

---

## 12. Fluxos de Dados Importantes

### 12.1 Criacao de Share (Add Share)

```
Frontend POST /api/shares { name, path, comment, veto_files, write_list }
  │
  Backend share_service.add_share()
    ├── parse_smb_conf() - Le smb.conf atual
    ├── Verifica se share ja existe
    ├── Cria diretorio /mnt/data/Corporativo/{name}
    ├── samba_tool.create_group("Acesso Escrita {name}") - Cria grupo AD
    ├── samba_tool.create_group("Acesso Leitura {name}") - Cria grupo AD
    ├── Append [name] section em smb.conf
    ├── _reload_samba() - smbcontrol all reload-config
    ├── time.sleep(1.5) - Aguarda smbd processar
    ├── samba_tool.get_group_sid("Acesso Escrita {name}") - Obtem SID
    ├── samba_tool.get_group_sid("Acesso Leitura {name}") - Obtem SID
    └── subprocess: smbcacls //172.20.0.10/{name} / -U administrator%password --sddl --set {SDDL}
```

### 12.2 Login e Sessao

```
Frontend: Login form -> auth.login(username, password)
  │
  POST /api/auth/login
  │
  Backend: ldap_auth.authenticate_user()
    ├── ldap.initialize(LDAP_URL)
    ├── conn.simple_bind_s(username@REALM, password)
    ├── conn.search_s(base_dn, SUBTREE, filter, attrs)
    ├── Extrai groups de memberOf + primaryGroupID
    └── Retorna user_data
  │
  Backend: check_group_membership(groups, allowed_groups)
  │
  Backend: jwt_handler.create_access_token(payload)
  │
  Frontend: setToken(token), localStorage.setItem('swat4_user', JSON.stringify(user))
  │
  Subsequentes requisicoes: headers.Authorization = Bearer {token}
```

### 12.3 Bulk Import de Usuarios

```
Frontend: FormData com arquivo CSV
  │
  POST /api/bulk/users (multipart/form-data)
  │
  Backend: router bulk_import_users()
    ├── Valida extensao .csv
    ├── Decodifica UTF-8
    ├── csv.DictReader()
    ├── Para cada linha:
    │   ├── Valida username e password obrigatorios
    │   └── samba_tool.create_user(username, password, given_name, surname, email, ou)
    ├── log_activity("CREATE", "Bulk Users")
    └── Retorna { success_count, failed_count, errors[] }
```

---

## 13. Troubleshooting Comum

| Problema | Causa Provavel | Solucao |
|---|---|---|
| Backend nao conecta ao LDAP | Container samba-dc nao saudavel | `docker compose logs samba-dc`; aguardar healthcheck |
| Login falha com 401 | Credenciais incorretas ou LDAP URL errada | Verificar .env; testar com `ldapsearch` |
| Login falha com 403 | Usuario nao esta em grupo permitido | Verificar ALLOWED_LOGIN_GROUPS no .env |
| Token JWT expirado | Sessao expirou (8h) | Fazer login novamente |
| Shares nao aparecem | Volume nao montado ou smb.conf nao recarregado | `docker compose restart backend`; verificar volume samba-etc |
| DNS nao funciona | samba-tool nao encontrado no container backend | Verificar se `samba-common-bin` esta instalado no backend |
| Logs vazios | Volume samba-logs nao montado | Verificar docker-compose volumes |
| CORS error | Frontend rodando fora do Docker | Configurar NEXT_PUBLIC_API_URL ou usar proxy |
| SQLite locked | Multiplas requisicoes simultaneas | Considerar PostgreSQL para producao |

---

## 14. Contagem de Linhas por Modulo

| Modulo | Arquivos | Linhas (aprox.) |
|---|---|---|
| Backend - Routers | 11 | ~850 |
| Backend - Services | 5 | ~1,163 |
| Backend - Auth | 4 | ~165 |
| Backend - Models | 1 | ~224 |
| Backend - Database | 1 | ~112 |
| Backend - Config/Exceptions | 2 | ~40 |
| Backend - Main | 1 | ~49 |
| **Backend Total** | **25** | **~2,603** |
| Frontend - Pages | 10 | ~2,100 |
| Frontend - Components | 3 | ~490 |
| Frontend - Libs | 5 | ~395 |
| Frontend - Messages | 3 | ~500 |
| Frontend - Config | 4 | ~130 |
| **Frontend Total** | **25** | **~3,615** |
| Samba DC | 2 | ~107 |
| Docker/Infra | 2 | ~111 |
| **TOTAL GERAL** | **~54** | **~6,436** |