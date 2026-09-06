import { PrismaClient } from "@prisma/client"
import argon2 from "argon2"
import { z } from "zod"

// Allow Prisma client to be mocked for tests
declare global {
   
  var prisma: PrismaClient | undefined
}

const prisma = global.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma
}

// ============================================
// Validation Schemas
// ============================================

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
})

export type RegisterInput = z.infer<typeof registerSchema>

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
})

export type LoginInput = z.infer<typeof loginSchema>

// ============================================
// Security Constants
// ============================================

export const MAX_FAILED_ATTEMPTS = 5
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15 minutes

// ============================================
// Helper Functions (exported for testing)
// ============================================

/**
 * Check if an account is currently locked
 */
export function isAccountLocked(lockedUntil: Date | null): boolean {
  if (!lockedUntil) return false
  return lockedUntil > new Date()
}

/**
 * Get the lockout expiry time (15 minutes from now)
 */
export function getLockoutExpiryTime(): Date {
  return new Date(Date.now() + LOCKOUT_DURATION_MS)
}

/**
 * Sanitize error messages to prevent information leakage
 */
export function sanitizeError(error: Error): string {
  const message = error.message.toLowerCase()
  
  // Database-related errors (e.g., unique constraint violations)
  if (message.includes("already exists") || 
      message.includes("unique constraint")) {
    return "An error occurred. Please try again."
  }
  
  // Validation errors that might reveal system details
  if (message.includes("requirements") || 
      message.includes("validation")) {
    return "An error occurred. Please try again."
  }
  
  // Authentication errors - keep generic for anti-enumeration
  if (message.includes("credentials") || 
      message.includes("password") || 
      message.includes("email")) {
    return "Invalid credentials"
  }
  
  // Default: return original message for operational errors
  return error.message
}

// ============================================
// Authentication Functions
// ============================================

/**
 * Register a new user with secure password hashing using Argon2id
 */
export async function registerUser(data: RegisterInput) {
  const { name, email, password } = data

  // Check if user already exists (anti-enumeration: same error message)
  const existingUser = await prisma.user.findUnique({
    where: { email },
  })

  if (existingUser) {
    throw new Error("User with this email already exists")
  }

  // Hash password with Argon2id
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  })

  // Create user with profile
  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      securityStamp: crypto.randomUUID(),
      profile: {
        create: {},
      },
    },
    include: {
      profile: true,
    },
  })

  return {
    id: user.id,
    email: user.email,
    name: user.name,
  }
}

/**
 * Authenticate user with rate limiting and account lockout protection
 */
export async function authenticateUser(data: LoginInput) {
  const { email, password } = data

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      profile: true,
    },
  })

  // Anti-enumeration: check account lockout first
  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    const remainingMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000)
    throw new Error(`Account temporarily locked. Try again in ${remainingMinutes} minutes.`)
  }

  // Reset lockout if user was previously locked but time has passed
  if (user?.lockedUntil && user.lockedUntil <= new Date()) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    })
  }

  // Anti-enumeration: generic error message
  if (!user || !user.passwordHash) {
    throw new Error("Invalid email or password")
  }

  // Verify password with Argon2id
  const isPasswordValid = await argon2.verify(user.passwordHash, password)

  if (!isPasswordValid) {
    // Increment failed attempts
    const newFailedAttempts = user.failedLoginAttempts + 1
    
    if (newFailedAttempts >= MAX_FAILED_ATTEMPTS) {
      // Lock account
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: newFailedAttempts,
          lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS),
        },
      })
      throw new Error(`Account locked due to multiple failed attempts. Try again in ${Math.ceil(LOCKOUT_DURATION_MS / 60000)} minutes.`)
    }

    // Update failed attempts
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: newFailedAttempts,
      },
    })

    throw new Error("Invalid email or password")
  }

  // Successful login: reset failed attempts and update security stamp
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      securityStamp: crypto.randomUUID(),
    },
  })

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    profile: user.profile,
    securityStamp: user.securityStamp,
  }
}

/**
 * Get user by ID with profile
 */
export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      profile: true,
    },
  })

  return user
}

/**
 * Get user by email (for NextAuth adapter)
 */
export async function getUserByEmail(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      profile: true,
    },
  })

  return user
}

/**
 * Invalidate all sessions for a user (security stamp rotation)
 */
export async function invalidateUserSessions(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      securityStamp: crypto.randomUUID(),
    },
  })
}

/**
 * Change user password with validation
 */
export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  // Validate new password
  const result = registerSchema.safeParse({ 
    name: "x", 
    email: "x@x.com", 
    password: newPassword 
  })
  
  if (!result.success) {
    throw new Error("New password does not meet requirements")
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!user || !user.passwordHash) {
    throw new Error("User not found")
  }

  // Verify current password
  const isCurrentPasswordValid = await argon2.verify(user.passwordHash, currentPassword)

  if (!isCurrentPasswordValid) {
    throw new Error("Current password is incorrect")
  }

  // Hash new password
  const newPasswordHash = await argon2.hash(newPassword, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  })

  // Update password and rotate security stamp
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: newPasswordHash,
      securityStamp: crypto.randomUUID(),
    },
  })

  return true
}

/**
 * Request password reset token
 */
export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
  })

  // Anti-enumeration: always return success even if user doesn't exist
  if (!user) {
    return { success: true }
  }

  // Generate reset token (in production, send via email)
  const resetToken = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

  // Store token in VerificationToken table
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

  // In production: send email with reset link
  // For now, return token (only for development/testing)
  return {
    success: true,
    resetToken, // Remove in production
    expiresAt,
  }
}

/**
 * Reset password with token
 */
export async function resetPassword(email: string, token: string, newPassword: string) {
  // Validate new password
  const result = registerSchema.safeParse({ 
    name: "x", 
    email: "x@x.com", 
    password: newPassword 
  })
  
  if (!result.success) {
    throw new Error("Password does not meet requirements")
  }

  // Verify token
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

  const user = await prisma.user.findUnique({
    where: { email },
  })

  if (!user) {
    throw new Error("User not found")
  }

  // Hash new password
  const passwordHash = await argon2.hash(newPassword, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  })

  // Update password, reset lockout, and rotate security stamp
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      failedLoginAttempts: 0,
      lockedUntil: null,
      securityStamp: crypto.randomUUID(),
    },
  })

  // Delete used token
  await prisma.verificationToken.delete({
    where: {
      identifier_token: {
        identifier: `password-reset:${email}`,
        token,
      },
    },
  })

  return true
}
