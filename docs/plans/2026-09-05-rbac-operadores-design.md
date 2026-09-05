# Design: RBAC de operadores (menus + permissoes) e OUs visiveis

> Data: 2026-09-05 | Status: Aprovado

## Objetivo

1. Account Operators enxergam os menus corretos no sidebar (Usuarios, Grupos,
   Compartilhamentos, DNS, Atividades) conforme as permissoes do perfil
2. O admin configura quais OUs os operadores podem visualizar e gerenciar

## Decisoes aprovadas

- Permissoes do Account Operators: **todas habilitadas por padrao** (quando nao
  ha configuracao salva)
- OUs visiveis: **selecao por checkboxes** em arvore, no painel do admin
- **Lista vazia = todas as OUs**; marcando 1+ restringe a essas (e subarvores)
- Atividades: operadores passam a visualizar (read-only)
- Menu DNS: passa a depender de `can_view_dns` (antes exigia Domain Admins)

## Mudancas

### Backend (swat4)

1. `models/schemas.py` — `RoleSettingsSchema`:
   - defaults `True` para as 4 permissoes (can_manage_users, can_manage_groups,
     can_manage_shares, can_view_dns)
   - novo campo `visible_ous: List[str] = []` (DNs de OUs)
2. `auth/rbac.py` — helpers:
   - `get_visible_ous(current_user) -> Optional[List[str]]` (admin → None;
     operador com lista vazia → None; caso contrario lista; outros → [])
   - `is_ou_visible(dn, visible)` — match exato ou dentro de subarvore
     (comparacao case-insensitive)
3. `routers/activities.py` — `require_role(["Domain Admins", "Account Operators"])`
4. `routers/ous.py` — GET: arvore filtrada para operadores (nodos dentro das OUs
   visiveis, mantendo ancestrais para montar a arvore); POST/DELETE: validar OU
   de destino dentro das visiveis (403 fora)
5. `routers/users.py` — GET: filtro por OU visivel; POST: validar `ou` alvo;
   PUT/DELETE: validar DN do usuario (403 fora)
6. `routers/groups.py` — GET: filtro por OU visivel (além do regex atual);
   POST/DELETE: validar OU/DN alvo

### Frontend (swat4)

7. `components/sidebar.tsx` — DNS: `permission: 'can_view_dns'`; Atividades:
   remover `requiredRole` (visivel para operador e admin)
8. `app/dashboard/settings/page.tsx` — nova secao "Perfil do Account Operators":
   - 4 toggles de permissao
   - arvore de OUs com checkboxes (multi-selecao, mostra subarvore)
   - carregar `GET /api/roles/Account Operators/settings` e salvar via PUT
9. `lib/i18n.tsx`/messages — novas chaves PT/EN/ES

## Observacoes

- Filtro e enforced no backend (nao apenas visual)
- Admin nunca e filtrado
- PUT do role settings passa a incluir `visible_ous` (frontend envia schema
  completo)

## Testes

- Bateria e2e local estendida:
  - criar operador (usuario no grupo Account Operators)
  - login operador: menus visiveis por padrao; toggles desligam menus e
    endpoints (403)
  - admin restringe `visible_ous` (ex.: OU=Company): operador ve arvore
    filtrada, lista de usuarios/grupos filtrada; criacao de usuario fora da OU
    → 403; dentro → 200
  - DNS como operador: 200 com can_view_dns, 403 sem
  - Atividades: 200 para operador