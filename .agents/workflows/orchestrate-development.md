# Orchestrate Development

Workflow principal que coordena todos os agentes especializados para desenvolver software completo.

## Descrição

Este workflow orquestra um fluxo completo de desenvolvimento, delegando tarefas para agentes especializados:
1. Product Manager: Coleta requisitos e cria especificação
2. Architect: Projeta arquitetura e design técnico
3. Engineer: Implementa código e testes
4. QA: Testa e valida qualidade

## Passos

### Passo 1: Coletar Requisito do Usuário

Comece pedindo ao usuário que descreva o que precisa ser desenvolvido:

```
Qual é o requisito ou projeto que você gostaria de desenvolver?
Forneça o máximo de detalhes possível sobre:
- Objetivo principal
- Funcionalidades necessárias
- Usuários finais
- Restrições técnicas ou orçamentárias
- Timeline esperada
```

### Passo 2: Delegar para Product Manager

Passe o requisito para o PM Agent:

```
/workflow-pm-requirements

Requisito do Usuário:
[Requisito coletado no passo anterior]

Instruções:
1. Clarificar e detalhar requisitos
2. Criar especificação completa
3. Definir user stories
4. Estabelecer prioridades
5. Gerar artifact: Specification Document
```

Aguarde o PM Agent completar a especificação.

### Passo 3: Delegar para Architect

Passe a especificação para o Architect Agent:

```
/workflow-architect-design

Especificação do PM:
[Specification Document do passo anterior]

Instruções:
1. Analisar requisitos técnicos
2. Selecionar stack tecnológico
3. Projetar arquitetura
4. Definir padrões de design
5. Documentar decisões técnicas
6. Gerar artifact: Architecture Design Document
```

Aguarde o Architect Agent completar o design.

### Passo 4: Delegar para Engineer

Passe o design para o Engineer Agent:

```
/workflow-engineer-implement

Design Técnico:
[Architecture Design Document do passo anterior]

Especificação:
[Specification Document do PM]

Instruções:
1. Setup do ambiente
2. Implementar features conforme design
3. Escrever testes unitários
4. Realizar code review
5. Validar padrões
6. Gerar artifact: Implementation Code + Tests
```

Aguarde o Engineer Agent completar a implementação.

### Passo 5: Delegar para QA

Passe o código para o QA Agent:

```
/workflow-qa-testing

Código Implementado:
[Implementation Code do Engineer]

Especificação Original:
[Specification Document do PM]

Design Técnico:
[Architecture Design Document do Architect]

Instruções:
1. Preparar ambiente de testes
2. Executar testes funcionais
3. Validar requisitos
4. Testar casos de borda
5. Verificar segurança e performance
6. Documentar bugs encontrados
7. Gerar artifact: Test Report + Quality Assessment
```

Aguarde o QA Agent completar os testes.

### Passo 6: Consolidar Resultados

Consolide todos os artifacts e resultados:

```markdown
## Consolidação de Resultados

### Artifacts Gerados

1. **Specification Document** (PM)
   - Requisitos completos
   - User stories
   - Critérios de aceitação

2. **Architecture Design Document** (Architect)
   - Stack tecnológico
   - Componentes principais
   - Padrões de design

3. **Implementation Code** (Engineer)
   - Código fonte
   - Testes unitários
   - Documentação

4. **Test Report** (QA)
   - Resultados dos testes
   - Bugs encontrados
   - Recomendações

### Status Geral

- Especificação: ✓ COMPLETA
- Design: ✓ COMPLETO
- Implementação: ✓ COMPLETA
- Testes: ✓ COMPLETOS

### Próximos Passos

1. Se houver bugs críticos:
   - Voltar para Engineer para correção
   - Re-testar com QA
   - Iterar até aprovação

2. Se tudo passou:
   - Preparar para deployment
   - Documentação final
   - Entrega ao usuário

3. Aprendizados:
   - Documentar padrões bem-sucedidos
   - Salvar snippets de código reutilizáveis
   - Atualizar knowledge base
```

### Passo 7: Iteração (Se Necessário)

Se houver bugs ou problemas:

**Bugs Críticos:**
```
Bugs encontrados: [lista]

Ação: Voltar para Engineer

/workflow-engineer-implement

Bugs a Corrigir:
[Lista de bugs do QA Report]

Após correção:
- Executar testes novamente
- Passar para QA para re-validação
- Consolidar novamente
```

**Melhorias Sugeridas:**
```
Se QA sugerir melhorias não-críticas:

Ação: Documentar para próximas iterações
- Adicionar à backlog
- Priorizar para próximo ciclo
- Comunicar ao usuário
```

### Passo 8: Entrega Final

Quando tudo estiver pronto:

```markdown
## Entrega Final

### O que foi desenvolvido
[Resumo do que foi entregue]

### Artifacts Disponíveis
1. Código fonte
2. Documentação técnica
3. Testes e cobertura
4. Guia de deployment
5. Documentação de uso

### Qualidade
- Testes: 100% passando
- Cobertura: 85%+
- Bugs: 0 críticos
- Performance: Validada
- Segurança: Validada

### Próximos Passos
1. Deploy em staging
2. Testes finais
3. Deploy em produção
4. Monitoramento
5. Suporte

### Contato
Para dúvidas ou sugestões, use os agentes especializados:
- @pm-specialist - Requisitos
- @architect-specialist - Design
- @engineer-specialist - Código
- @qa-specialist - Testes
```

## Dicas

### 1. Comunicação Clara
- Forneça contexto completo
- Seja específico nas instruções
- Aguarde conclusão de cada fase

### 2. Iteração Rápida
- Se houver bloqueadores, comunique imediatamente
- Não pule fases
- Valide saídas de cada agente

### 3. Documentação
- Mantenha artifacts atualizados
- Documente decisões
- Compartilhe aprendizados

### 4. Qualidade
- Não comprometa qualidade por velocidade
- Teste thoroughly
- Valide segurança

## Exemplo Completo

Para ver um exemplo completo de orquestração, veja:
- `/orchestrate-development` com requisito de "API REST de Tarefas"

## Troubleshooting

**Se um agente ficar preso:**
- Forneça mais contexto
- Simplifique o requisito
- Tente novamente

**Se houver conflito entre agentes:**
- Revise a especificação original
- Comunique mudanças
- Repita fases afetadas

**Se a qualidade estiver baixa:**
- Aumente rigor de testes
- Revise padrões
- Documente lições aprendidas

---

**Versão:** 1.0  
**Tipo:** Workflow Principal  
**Status:** Pronto para Uso
