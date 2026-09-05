# RBAC de operadores + OUs visiveis — Plano de Implementacao

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Menus e permissoes corretos para Account Operators + configuracao de OUs visiveis pelo admin, com enforcement no backend.

**Architecture:** RoleSettings (SQLite) ganha `visible_ous`; helpers de RBAC resolvem OUs visiveis; routers filtram listas e validam escritas; sidebar usa permissoes; settings page ganha painel de perfil do operador com arvore de checkboxes.

**Tech Stack:** FastAPI + python-ldap + SQLite (backend), Next.js 14 + Tailwind (frontend), GHCR + GHA (imagens).

**Branch:** `rbac-ou-visibility` no repo swat4.

---

## Task 1: Backend — schema + helpers RBAC

**Files:**
- Modify: `backend/app/models/schemas.py`
- Modify: `backend/app/auth/rbac.py`

**Step 1:** Em `RoleSettingsSchema`: trocar defaults `False` → `True` nas 4 permissoes; adicionar `visible_ous: List[str] = []`.

**Step 2:** Em `rbac.py` adicionar:

```python
def get_visible_ous(current_user: dict) -> Optional[List[str]]:
    """DNs de OUs visiveis (match de subarvore) ou None se irrestrito."""
    groups = current_user.get("groups") or []
    if ADMIN_ROLE in groups:
        return None
    if OPERATOR_ROLE in groups:
        ous = (get_role_settings(OPERATOR_ROLE).get("visible_ous") or [])
        return ous if ous else None
    return []

def is_ou_visible(dn: str, visible_ous: Optional[List[str]]) -> bool:
    if visible_ous is None:
        return True
    d = dn.lower()
    return any(d == ou.lower() or d.endswith("," + ou.lower()) for ou in visible_ous)
```

**Step 3:** Commit `feat: schema de roles com visible_ous e helpers de RBAC`.

---

## Task 2: Backend — enforcement nos routers

**Files:**
- Modify: `backend/app/routers/activities.py`
- Modify: `backend/app/routers/ous.py`
- Modify: `backend/app/routers/users.py`
- Modify: `backend/app/routers/groups.py`

**Step 1:** `activities.py`: `require_role(["Domain Admins", "Account Operators"])`.

**Step 2:** `ous.py` GET: se `visible = get_visible_ous(current_user)` nao for None, filtrar nodos: manter nodos cujo `dn` (ou ancestral) passa em `is_ou_visible`; POST: validar DN de destino (`ou_dn` ou base) com `is_ou_visible(..., visible)` → 403 senão; DELETE: validar `ou_dn` alvo.

**Step 3:** `users.py`: GET: filtrar lista por `is_ou_visible(u["ou"] or u["dn"], visible)`; POST: validar `user.ou` (ou base default `CN=Users,DC=...`) — 403 fora; PUT: validar `existing["dn"]`; DELETE: validar `existing["dn"]`.

**Step 4:** `groups.py`: GET: combinar filtro existente (regex settings) com `is_ou_visible(g["ou"] or g["dn"], visible)`; POST: validar `group.ou`; DELETE: validar DN do grupo.

**Step 5:** Commit `feat: enforcement de OUs visiveis em users/groups/ous + atividades para operadores`.

---

## Task 3: Frontend — sidebar

**Files:**
- Modify: `frontend/src/components/sidebar.tsx`

**Step 1:** item `dns`: trocar `requiredRole: 'Domain Admins'` por `permission: 'can_view_dns'`.

**Step 2:** item `activity`: remover `requiredRole` (fica visivel para operador e admin; Settings continua admin-only).

**Step 3:** Commit `fix: menus do sidebar conforme permissoes do perfil (DNS/Atividades)`.

---

## Task 4: Frontend — painel do perfil do operador (settings)

**Files:**
- Modify: `frontend/src/app/dashboard/settings/page.tsx`
- Create: `frontend/src/components/ou-checkbox-tree.tsx` (arvore de OUs com checkboxes: selecao no nodo marca fila? NAO — marcar pai marca subarvore visualmente; envio = lista de DNs dos marcados)

**Step 1:** Novo componente `ou-checkbox-tree.tsx` recebe `tree` (OUs), `selected: string[]`, `onChange`; checkbox por OU (padrao unchecked = "todas"); hierarquia indentada.

**Step 2:** Settings page: nova secao "Perfil do Account Operators" com 4 toggles + a arvore; carregar `roles.getSettings('Account Operators')` e `ous.tree()`; salvar via `roles.updateSettings('Account Operators', payload completo com visible_ous)`.

**Step 3:** TODO: lembrar de campos `visible_groups_regex`/`visible_groups_list` existentes no payload (preservar).

**Step 4:** Commit `feat: configuracao de permissoes e OUs visiveis do operador`.

---

## Task 5: i18n

**Files:**
- Modify: `frontend/messages/pt.json`, `en.json`, `es.json`

Chaves: `settings.operatorProfile`, `settings.opManageUsers`, `settings.opManageGroups`, `settings.opManageShares`, `settings.opViewDns`, `settings.opVisibleOus`, `settings.opVisibleOusHint` (vazio = todas), `settings.opSaved`.

Commit `feat: i18n do painel do operador`.

---

## Task 6: Build, e2e e publicacao

1. Build local das imagens (backend/frontend) para teste
2. Bateria e2e estendida (stack swat4 local + override dc):
   - adicionar `test.op` ao grupo Account Operators (a conta existe? criar)
   - operador: menus padrao visiveis (toggless default true)
   - operador restrito (admin salva visible_ous=OU=Company): usuarios filtrados;
     criar usuario fora → 403; dentro → 201/200
   - can_view_dns=false → GET /api/dns 403 p/ operador; true → 200
   - GET /api/activities como operador → 200
3. Merge da branch → push main (GHA publica imagens multi-arch automaticamente)
4. Atualizar bateria: manter script em sync com os novos cenarios