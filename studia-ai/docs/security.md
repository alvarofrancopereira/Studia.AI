# Security Implementation

## Visão Geral

O STUDIA AI implementa múltiplas camadas de segurança para proteger dados dos usuários e prevenir ataques comuns. Este documento descreve as medidas de segurança implementadas no Milestone 2 (Autenticação).

---

## Hash de Senhas com Argon2id

### Implementação

Todas as senhas são hasheadas utilizando **Argon2id**, o algoritmo recomendado pelo OWASP para armazenamento seguro de senhas.

```typescript
const passwordHash = await argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 19456,    // 19 MB
  timeCost: 2,          // 2 iterations
  parallelism: 1,       // 1 lane
})
```

### Parâmetros de Segurança

| Parâmetro | Valor | Justificativa |
|-----------|-------|---------------|
| `type` | `argon2id` | Híbrido entre Argon2i e Argon2d, resistente a ataques side-channel e GPU |
| `memoryCost` | 19456 KB | ~19 MB de memória, suficiente para tornar ataques de força bruta caros |
| `timeCost` | 2 | 2 iterações, balanceando segurança e performance |
| `parallelism` | 1 | 1 lane, adequado para maioria dos servidores |

### Verificação de Senha

```typescript
const isValid = await argon2.verify(user.passwordHash, password)
```

---

## Rate Limiting e Account Lockout

### Proteção Contra Brute Force

O sistema implementa proteção contra tentativas excessivas de login:

- **Máximo de tentativas:** 5 falhas consecutivas
- **Duração do lockout:** 15 minutos
- **Contador:** Armazenado no banco de dados (`failedLoginAttempts`)
- **Reset:** Contador zerado após login bem-sucedido

### Implementação

```typescript
const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15 minutes

// Durante autenticação:
if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: newFailedAttempts,
      lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS),
    },
  })
}
```

### Verificação de Lockout

Antes de tentar autenticar, o sistema verifica se a conta está bloqueada:

```typescript
function isAccountLocked(lockedUntil: Date | null): boolean {
  if (!lockedUntil) return false
  return lockedUntil > new Date()
}
```

---

## securityStamp para Revogação de Sessão

### Propósito

O `securityStamp` é um UUID único gerado para cada usuário e atualizado sempre que há uma mudança crítica de segurança:

- Cadastro inicial
- Reset de senha
- Alteração de senha
- Revogação manual de sessões

### Implementação

**Geração no cadastro:**
```typescript
const user = await prisma.user.create({
  data: {
    name,
    email,
    passwordHash,
    securityStamp: crypto.randomUUID(),
  },
})
```

**Rotação no reset de senha:**
```typescript
await prisma.user.update({
  where: { id: userId },
  data: {
    passwordHash: newPasswordHash,
    securityStamp: crypto.randomUUID(), // Rotaciona o stamp
  },
})
```

### Integração com NextAuth

O `securityStamp` é incluído no token JWT da sessão:

```typescript
callbacks: {
  async jwt({ token, user }) {
    if (user) {
      token.id = user.id
      token.securityStamp = user.securityStamp
    }
    return token
  },
  async session({ session, token }) {
    if (session.user) {
      session.user.id = token.id as string
      session.user.securityStamp = token.securityStamp as string
    }
    return session
  },
}
```

### Revogação de Sessões

Para revogar todas as sessões de um usuário (ex.: após suspeita de comprometimento):

```typescript
await prisma.user.update({
  where: { id: userId },
  data: {
    securityStamp: crypto.randomUUID(), // Novo stamp invalida sessões antigas
  },
})
```

**Nota:** A validação completa do securityStamp nas sessões JWT deve ser implementada verificando se o stamp do token corresponde ao stamp atual no banco de dados.

---

## Proteção de Rotas (Middleware)

### Middleware NextAuth

O middleware protege rotas privadas e redireciona usuários não autenticados:

```typescript
import NextAuth from "next-auth"
import { authConfig } from "@/app/api/auth/[...nextauth]/route"

export const middleware = NextAuth(authConfig)

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
```

### Autorização por Callback

O callback `authorized` verifica permissões:

```typescript
async authorized({ auth, request }) {
  const isLoggedIn = !!auth?.user
  const isOnDashboard = request.nextUrl.pathname.startsWith("/dashboard")
  const isOnAuth = request.nextUrl.pathname.startsWith("/auth")

  if (isOnDashboard) {
    return isLoggedIn // Requer login
  }

  if (isOnAuth) {
    return !isLoggedIn // Páginas de auth só para não-logados
  }

  return true // Outras rotas públicas
}
```

---

## Validação de Entrada com Zod

### Schema de Cadastro

```typescript
export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain uppercase")
    .regex(/[a-z]/, "Must contain lowercase")
    .regex(/[0-9]/, "Must contain number")
    .regex(/[^A-Za-z0-9]/, "Must contain special character"),
})
```

### Schema de Login

```typescript
export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
})
```

### Validação Server-Side

Todas as entradas são validadas no servidor antes de qualquer operação:

```typescript
const validatedFields = loginSchema.safeParse(credentials)

if (!validatedFields.success) {
  return null // Rejeita credenciais inválidas
}
```

---

## Proteção Anti-Enumeração de Usuários

### Problema

Mensagens de erro específicas podem revelar se um email está cadastrado:

- ❌ "User with this email already exists" → Email cadastrado
- ❌ "User not found" → Email não cadastrado

### Solução

Mensagens genéricas que não revelam informações:

```typescript
// Cadastro duplicado
if (existingUser) {
  throw new Error("User with this email already exists")
  // Na API: retornar mensagem genérica
}

// Login falhou
if (!user) {
  return null // Não diferenciar "usuário não existe" de "senha errada"
}

// Forgot password
if (!user) {
  return { success: true } // Sempre retorna sucesso, mesmo se usuário não existir
}
```

### Mensagem Genérica

```typescript
function sanitizeError(error: Error): string {
  // Erros específicos de validação/banco → mensagem genérica
  if (error.message.includes("already exists") || 
      error.message.includes("requirements")) {
    return "An error occurred. Please try again."
  }
  
  // Manter erros de auth genéricos
  return "Invalid credentials"
}
```

---

## CSRF Protection

### Proteção Nativa do NextAuth

O NextAuth v5 inclui proteção CSRF nativa:

- Tokens CSRF automáticos em requisições POST
- Validação de origem das requisições
- Cookies seguros com mesma política

### Configuração

```typescript
export const authConfig: NextAuthConfig = {
  // ... outras configurações
  trustHost: true, // Permitir hosts confiáveis
}
```

### Boas Práticas

- Todas as mutações usam POST/PUT/DELETE
- Tokens CSRF validados automaticamente
- Cookies configurados com `SameSite=Lax`

---

## Gerenciamento de Tokens de Recuperação

### Geração de Token

Tokens de reset de senha são UUIDs únicos:

```typescript
const resetToken = crypto.randomUUID()
const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hora
```

### Armazenamento Seguro

Tokens são armazenados na tabela `VerificationToken` do Prisma:

```typescript
await prisma.verificationToken.upsert({
  where: {
    identifier_token: {
      identifier: `password-reset:${email}`,
      token: resetToken,
    },
  },
  update: {
    expires: expiresAt,
  },
  create: {
    identifier: `password-reset:${email}`,
    token: resetToken,
    expires: expiresAt,
  },
})
```

### Validação

```typescript
const verificationToken = await prisma.verificationToken.findUnique({
  where: {
    identifier_token: {
      identifier: `password-reset:${email}`,
      token,
    },
  },
})

if (!verificationToken || verificationToken.expires < new Date()) {
  throw new Error("Invalid or expired reset token")
}
```

### Invalidação Após Uso

```typescript
await prisma.verificationToken.delete({
  where: {
    identifier_token: {
      identifier: `password-reset:${email}`,
      token,
    },
  },
})
```

---

## Environment Variables e Secrets

### Variáveis Obrigatórias

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/studia_ai"

# NextAuth
NEXTAUTH_SECRET="<gerar-com-openssl-rand-base64-32>"
NEXTAUTH_URL="http://localhost:3000"
```

### Boas Práticas

- `.env` nunca é commitado
- `.env.example` contém apenas chaves vazias ou placeholders
- Secrets gerados com `openssl rand -base64 32`
- Variáveis de produção diferentes de desenvolvimento

---

## Auditoria e Logs

### Logging Seguro

```typescript
try {
  // Operação de auth
} catch (error) {
  console.error("Authentication error:", error)
  // Nunca logar senhas, tokens ou dados sensíveis
  return null
}
```

### O Que NÃO Logar

- ❌ Senhas (mesmo hash)
- ❌ Tokens de sessão completos
- ❌ Tokens de reset de senha
- ❌ Dados pessoais sensíveis

---

## Próximas Melhorias (Roadmap)

- [ ] Implementar verificação ativa do securityStamp em cada requisição
- [ ] Adicionar logs de auditoria para ações críticas
- [ ] Implementar 2FA (Two-Factor Authentication)
- [ ] Adicionar rate limiting por IP no middleware
- [ ] Implementar headers de segurança (CSP, HSTS, etc.)
- [ ] Adicionar monitoramento de tentativas suspeitas
- [ ] Implementar invalidação de sessão em mudança de senha

---

## Referências

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [NextAuth.js Documentation](https://next-auth.js.org/)
- [Argon2 RFC 9106](https://www.rfc-editor.org/rfc/rfc9106.html)
