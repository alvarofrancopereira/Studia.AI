import NextAuth from "next-auth"
import type { DefaultSession, DefaultUser } from "next-auth"
import type { JWT, DefaultJWT } from "next-auth/jwt"

// Extend the built-in session types
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      securityStamp: string
    } & DefaultSession["user"]
  }

  interface User extends DefaultUser {
    securityStamp: string
  }
}

// Extend the JWT type
declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string
    securityStamp: string
  }
}
