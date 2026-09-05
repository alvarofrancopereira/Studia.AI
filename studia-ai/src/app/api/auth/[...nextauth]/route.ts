import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/db"
import { authenticateUser, loginSchema } from "@/lib/auth"
import type { NextAuthConfig } from "next-auth"

export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          // Validate credentials
          const validatedFields = loginSchema.safeParse(credentials)
          
          if (!validatedFields.success) {
            return null
          }
          
          const { email, password } = validatedFields.data
          
          // Authenticate user
          const user = await authenticateUser({ email, password })
          
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            securityStamp: user.securityStamp,
          }
        } catch (error) {
          console.error("Authentication error:", error)
          return null
        }
      },
    }),
  ],
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id ?? token.id
        token.securityStamp = user.securityStamp ?? token.securityStamp
      }
      
      // Handle session updates
      if (trigger === "update" && session) {
        return { ...token, ...session }
      }
      
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id ?? session.user.id
        session.user.securityStamp = token.securityStamp ?? session.user.securityStamp
      }
      return session
    },
    async authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user
      const isOnDashboard = request.nextUrl.pathname.startsWith("/dashboard")
      const isOnAuth = request.nextUrl.pathname.startsWith("/auth")
      
      if (isOnDashboard) {
        return isLoggedIn
      }
      
      if (isOnAuth) {
        return !isLoggedIn
      }
      
      return true
    },
  },
  events: {
    async signOut(message) {
      // Optionally invalidate session on sign out
      if ('token' in message && message.token?.id) {
        await prisma.session.deleteMany({
          where: {
            userId: message.token.id as string,
          },
        }).catch(() => {
          // Ignore errors during sign out
        })
      }
    },
  },
  trustHost: true,
}

export const { 
  handlers: { GET, POST }, 
  auth, 
  signIn, 
  signOut 
} = NextAuth(authConfig)
