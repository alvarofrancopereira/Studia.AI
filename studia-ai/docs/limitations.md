# Limitações do Projeto

## Limitações do Ambiente de Desenvolvimento (Sandbox)

### PostgreSQL Não Disponível

**Problema:** O banco de dados PostgreSQL não está rodando no ambiente sandbox.

**Impacto:**
- `prisma db push` falha ao tentar conectar
- `prisma migrate dev` não pode ser executado
- Testes de integração com banco real não funcionam
- Validação completa do schema Prisma requer ambiente local

**Solução Local:**
```bash
# No seu ambiente local, execute:
docker-compose up -d postgres

# Ou configure uma instância remota:
export DATABASE_URL="postgresql://user:pass@host:5432/studia_ai"

# Execute migrations:
npm run db:migrate
```

**Status do Schema:** ✅ O schema Prisma está válido e pronto para uso. Apenas a conexão com o banco está indisponível no sandbox.

---

### Playwright Browsers Não Instalados

**Problema:** Os navegadores do Playwright não estão instalados no sandbox.

**Impacto:**
- `npm run test:e2e` falha ao tentar iniciar navegador
- Testes E2E não podem ser executados automaticamente
- Validação visual de fluxos requer ambiente local

**Solução Local:**
```bash
# Instalar browsers do Playwright:
npx playwright install

# Executar testes E2E:
npm run test:e2e

# Ou com UI:
npm run test:e2e:ui
```

**Status dos Testes E2E:** ✅ Os arquivos de teste existem (`src/tests/e2e/auth.e2e.ts`) e estão corretamente configurados. Apenas a execução requer ambiente local.

---

### Recursos de Rede Limitados

**Problema:** O sandbox pode ter acesso limitado a recursos externos de rede.

**Impacto Potencial:**
- Download de dependências pode falhar ou ser lento
- Serviços externos (Ollama, APIs de IA) podem não estar acessíveis
- Webhooks e callbacks externos podem não funcionar

**Solução:**
- Usar registry npm espelhado ou local quando disponível
- Configurar serviços de IA localmente (Ollama com modelos locais)
- Mockar serviços externos em testes

---

## Limitações da Implementação Atual (Milestone 2)

### Validação do securityStamp em Sessões

**Status:** Parcialmente implementado.

**O que existe:**
- ✅ `securityStamp` é gerado no cadastro
- ✅ `securityStamp` é incluído no token JWT
- ✅ `securityStamp` é rotacionado em reset de senha

**O que falta:**
- ❌ Validação ativa do stamp em cada requisição
- ❌ Invalidação automática de sessões com stamp divergente

**Workaround Atual:** Sessions expiram naturalmente após 30 dias. Para revogação imediata, é necessário implementar validação no callback `jwt` do NextAuth.

**Roadmap:** Implementar validação no Milestone 15 (Segurança Avançada).

---

### Rate Limiting por IP

**Status:** Não implementado.

**O que existe:**
- ✅ Rate limiting por conta (5 tentativas, lockout de 15 min)

**O que falta:**
- ❌ Rate limiting por endereço IP
- ❌ Proteção contra ataques distribuídos

**Motivo:** Requer middleware adicional e possível uso de Redis para contagem distribuída.

**Roadmap:** Implementar no Milestone 15 (Segurança Avançada).

---

### Envio Real de Emails

**Status:** Mockado para desenvolvimento.

**O que existe:**
- ✅ Geração de tokens de reset
- ✅ Armazenamento seguro no banco
- ✅ Validação de tokens

**O que falta:**
- ❌ Integração com serviço de email (SendGrid, AWS SES, etc.)
- ❌ Templates de email HTML
- ❌ Retry logic para envio falho

**Comportamento Atual:** Tokens de reset são retornados na resposta da API (apenas para desenvolvimento/testes).

**Aviso de Segurança:** ⚠️ **NUNCA** use esta implementação em produção sem integrar um serviço real de envio de emails.

**Roadmap:** Implementar no Milestone 14 ou posterior.

---

### Headers de Segurança HTTP

**Status:** Não implementados.

**Headers faltantes:**
- Content-Security-Policy (CSP)
- Strict-Transport-Security (HSTS)
- X-Content-Type-Options
- X-Frame-Options
- Referrer-Policy

**Motivo:** Configuração requerida no Next.js ou no servidor web.

**Roadmap:** Implementar no Milestone 15 (Segurança Avançada).

---

### Logs de Auditoria

**Status:** Não implementado.

**O que falta:**
- ❌ Log de ações críticas (login, logout, reset de senha)
- ❌ Log de tentativas falhas de autenticação
- ❌ Sistema de alerta para atividades suspeitas

**Motivo:** Requer infraestrutura de logging e possível integração com serviços externos.

**Roadmap:** Implementar no Milestone 39 (Observabilidade).

---

### Two-Factor Authentication (2FA)

**Status:** Não implementado.

**O que falta:**
- ❌ Suporte a TOTP (Google Authenticator, Authy)
- ❌ Códigos de backup
- ❌ Fluxo de habilitação/desabilitação

**Motivo:** Funcionalidade adicional além do escopo do Milestone 2.

**Roadmap:** Implementar como melhoria futura pós-Milestone 20.

---

## Limitações Conhecidas de Dependências

### Vulnerabilidades em Dependências de Desenvolvimento

**Status:** 5 vulnerabilidades detectadas (npm audit).

**Detalhes:**
- Severidade: 3 moderate, 1 high, 1 critical
- Pacotes afetados: esbuild, vite, vitest (dependências de dev)
- Impacto em produção: **Nenhum** (são dependências apenas de desenvolvimento)

**Motivo da Não Correção:**
- Algumas vulnerabilidades exigem breaking changes
- Outras são em pacotes de build/teste que não vão para produção
- Correção automática pode quebrar configuração atual

**Recomendação:**
```bash
# Em ambiente controlado, executar:
npm audit fix --force

# E testar extensivamente após atualização
```

---

### Versão do NextAuth (v5 Beta)

**Status:** Usando NextAuth v5.0.0-beta.32.

**Considerações:**
- ✅ API mais moderna e simplificada
- ✅ Melhor integração com Next.js App Router
- ⚠️ Ainda em beta (pode haver breaking changes)

**Mitigação:**
- Pin da versão específica no package.json
- Monitorar changelog para atualizações
- Manter backups e testes para detectar breaking changes

**Roadmap:** Atualizar para versão stable quando disponível.

---

## Limitações de Performance

### Conexões com Banco de Dados

**Status:** Singleton implementado para desenvolvimento.

**O que existe:**
```typescript
// src/lib/db.ts
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || new PrismaClient()
```

**Limitação:**
- Pool de conexões não otimizado para produção
- Pode exigir configuração adicional em ambientes serverless

**Roadmap:** Otimizar no Milestone 37 (Performance).

---

### Cache de Consultas

**Status:** Não implementado.

**O que falta:**
- ❌ Cache de consultas frequentes
- ❌ Invalidação estratégica de cache
- ❌ Redis ou outro sistema de cache distribuído

**Motivo:** Foco inicial em funcionalidade correta antes de otimização.

**Roadmap:** Implementar no Milestone 37 (Performance).

---

## Resumo das Limitações

| Limitação | Ambiente | Produção | Status |
|-----------|----------|----------|--------|
| PostgreSQL offline | Sandbox | ✅ OK | Documentado |
| Playwright browsers | Sandbox | ✅ OK | Documentado |
| Validação completa securityStamp | Ambas | ⚠️ Parcial | Roadmap M15 |
| Rate limiting por IP | Ambas | ⚠️ Pendente | Roadmap M15 |
| Envio real de emails | Ambas | ❌ Mockado | Roadmap M14+ |
| Headers de segurança | Ambas | ❌ Pendente | Roadmap M15 |
| Logs de auditoria | Ambas | ❌ Pendente | Roadmap M39 |
| 2FA | Ambas | ❌ Pendente | Pós-M20 |
| Vulnerabilidades (dev deps) | Sandbox | ✅ Sem impacto | Aceito |

---

## Notas Importantes

1. **Nenhuma limitação impede a funcionalidade básica de autenticação.**
2. **Todas as limitações do sandbox são resolvidas em ambiente local com Docker.**
3. **Vulnerabilidades em dependências de desenvolvimento não afetam produção.**
4. **Funcionalidades pendentes estão documentadas no roadmap.**

---

## Como Executar Localmente (Sem Limitações)

```bash
# 1. Clonar repositório
git clone <repo-url>
cd studia-ai

# 2. Instalar dependências
npm install

# 3. Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com valores apropriados

# 4. Iniciar banco de dados
docker-compose up -d postgres

# 5. Executar migrations
npm run db:migrate

# 6. Instalar browsers do Playwright
npx playwright install

# 7. Rodar todos os testes
npm run test
npm run test:e2e

# 8. Iniciar aplicação
npm run dev
```

---

**Última atualização:** Setembro 2026  
**Versão do projeto:** Milestone 2 completo
