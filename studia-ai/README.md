# STUDIA AI

> Aprenda no seu ritmo. Domine no seu tempo.

Uma plataforma educacional adaptativa baseada em inteligência artificial, capaz de analisar o desempenho do estudante, estimar o domínio de cada tópico e selecionar dinamicamente a próxima atividade de estudo.

## 🎯 Visão Geral

O STUDIA AI é uma plataforma de estudos adaptativa que vai além de simplesmente gerar perguntas com IA. O principal diferencial é **descobrir o nível de conhecimento do estudante e determinar qual deve ser a próxima melhor atividade para ele**.

### Funcionalidades Principais

- 📊 **Diagnóstico Adaptativo**: Avalia o conhecimento atual do estudante
- 🎯 **Planos de Estudo Personalizados**: Cria rotas de aprendizado baseadas em metas e prazos
- 🧠 **Study Engine**: Algoritmo que determina a próxima melhor atividade
- 📈 **Tracking de Domínio**: Monitora progresso por tópico (0-100%)
- 🔄 **Revisão Espaçada**: Sistema de flashcards com algoritmo SM-2
- 🧩 **Puzzles Interativos**: Atividades variadas para engajamento
- 📝 **Simulados**: Testes cronometrados com análise de desempenho
- 🤖 **IA Local**: Integração com Ollama/Qwen para privacidade e controle

## 🚀 Getting Started

### Pré-requisitos

- Node.js 18+ 
- PostgreSQL 16+
- Docker (opcional, para containerização)

### Instalação

```bash
# Clone o repositório
git clone <repository-url>
cd studia-ai

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env
# Edite .env com suas credenciais

# Gere o cliente Prisma
npm run db:generate

# Execute as migrações do banco
npm run db:migrate

# Inicie o servidor de desenvolvimento
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000)

### Docker (Desenvolvimento)

```bash
# Inicie os serviços (PostgreSQL + App)
docker-compose up -d

# Acesse o app em http://localhost:3000
```

## 📁 Estrutura do Projeto

```
studia-ai/
├── app/              # Next.js App Router
├── components/       # Componentes React reutilizáveis
├── features/         # Features modulares (auth, study, quiz, etc.)
├── lib/             # Utilitários, DB, auth, security, AI
├── prisma/          # Schema e seeds do banco
├── tests/           # Testes unitários, integração e E2E
└── docs/            # Documentação técnica
```

## 🛠️ Stack Tecnológica

### Frontend
- Next.js 14+ (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui
- Radix UI

### Backend
- Next.js Route Handlers
- Prisma ORM
- PostgreSQL
- Zod (validação)

### Testes
- Vitest (unitários)
- React Testing Library
- Playwright (E2E)

### IA
- Provider Pattern (Ollama, OpenAI, Gemini, Anthropic)
- Qwen 7B (local)

## 🧪 Testes

```bash
# Testes unitários (watch mode)
npm test

# Testes unitários (uma vez)
npm run test -- --run

# Testes E2E
npm run test:e2e

# Testes E2E com UI
npm run test:e2e:ui
```

## 🗄️ Banco de Dados

```bash
# Gerar cliente Prisma
npm run db:generate

# Push do schema (dev)
npm run db:push

# Migração (dev)
npm run db:migrate

# Prisma Studio
npm run db:studio
```

## 🔒 Segurança

O projeto segue as melhores práticas de segurança:

- ✅ OWASP Top 10 mitigation
- ✅ Validação server-side com Zod
- ✅ Ownership verification em todas as operações
- ✅ Proteção contra SQL Injection, XSS, CSRF
- ✅ Rate limiting preparado
- ✅ Secrets via environment variables
- ✅ Prompt injection protection para IA

## 📊 Arquitetura

### Study Engine

O coração do sistema determina a próxima melhor atividade baseada em:
- Domínio atual por tópico
- Desempenho recente
- Dificuldade das questões
- Histórico de erros/acertos
- Tempo disponível
- Objetivos e prazos

### Algoritmo de Domínio

Fórmula ponderada considerando:
- **Acurácia** (40%): Taxa de acertos
- **Consistência** (25%): Regularidade do desempenho
- **Recência** (20%): Quão recente foi o estudo
- **Dificuldade** (15%): Peso das questões resolvidas

### Decaimento Temporal

O domínio considera esquecimento natural:
- Revisões aumentam retenção
- Períodos sem estudo reduzem estimativa
- Baseado em curvas de esquecimento

## 📖 Documentação

- [Arquitetura](docs/architecture.md)
- [Segurança](docs/security.md)
- [Study Engine](docs/study-engine.md)
- [Integração IA](docs/ai.md)
- [Banco de Dados](docs/database.md)
- [Desenvolvimento](docs/development.md)

## 🚧 Status do Projeto

Este projeto está em desenvolvimento ativo seguindo um roadmap de 20 milestones.

**Milestone Atual**: 1 - Fundação ✅

### Roadmap

1. ✅ Fundação (Next.js, TypeScript, Prisma, Docker)
2. ⏳ Autenticação segura
3. Dashboard
4. Matérias e tópicos
5. Sistema de questões
6. Study Engine core
7. Diagnóstico
8. Plano adaptativo
9. Puzzles
10. Flashcards
11. Revisão espaçada
12. Simulados
13. Integração Ollama/Qwen
14. Upload de materiais
15. Segurança avançada
16. Testes E2E
17. Performance
18. Polimento visual
19. Docker/produção
20. Documentação final

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor, leia as diretrizes de contribuição antes de enviar PRs.

## 📄 Licença

Este projeto está sob a licença MIT.

## 🎓 Objetivo Acadêmico

O STUDIA AI demonstra:
- Engenharia de Software moderna
- Arquitetura escalável
- Banco de dados relacional
- Segurança web
- Inteligência Artificial aplicada
- Algoritmos adaptativos
- UX/UI acessível
- Testes automatizados
- Preocupação com custos (IA local)
- Possibilidade de aplicação real

---

**STUDIA AI** - Aprenda no seu ritmo. Domine no seu tempo.
