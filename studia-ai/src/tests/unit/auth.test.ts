import { describe, it, expect, beforeEach, vi } from "vitest"
import argon2 from "argon2"

// Mock the @/lib/db module - MUST be before any imports that use it
vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    verificationToken: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    session: {
      deleteMany: vi.fn(),
    },
    $connect: vi.fn(),
    $disconnect: vi.fn(),
  },
}))

// Import after mocking
import { 
  registerSchema, 
  loginSchema, 
  registerUser, 
  authenticateUser,
  isAccountLocked,
  getLockoutExpiryTime,
  sanitizeError,
  requestPasswordReset,
  resetPassword 
} from "@/lib/auth"

// Get the mocked prisma instance from the module
import * as dbModule from "@/lib/db"
const mockPrisma = dbModule.prisma

describe("Validation Schemas", () => {
  describe("registerSchema", () => {
    it("should validate valid registration data", () => {
      const validData = {
        name: "John Doe",
        email: "john@example.com",
        password: "SecurePass123!",
      }

      const result = registerSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it("should reject short names", () => {
      const invalidData = {
        name: "J",
        email: "john@example.com",
        password: "SecurePass123!",
      }

      const result = registerSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it("should reject invalid emails", () => {
      const invalidData = {
        name: "John Doe",
        email: "invalid-email",
        password: "SecurePass123!",
      }

      const result = registerSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it("should reject weak passwords (no uppercase)", () => {
      const invalidData = {
        name: "John Doe",
        email: "john@example.com",
        password: "securepass123!",
      }

      const result = registerSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it("should reject weak passwords (no number)", () => {
      const invalidData = {
        name: "John Doe",
        email: "john@example.com",
        password: "SecurePass!",
      }

      const result = registerSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it("should reject weak passwords (too short)", () => {
      const invalidData = {
        name: "John Doe",
        email: "john@example.com",
        password: "Pass1!",
      }

      const result = registerSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })

  describe("loginSchema", () => {
    it("should validate valid login data", () => {
      const validData = {
        email: "john@example.com",
        password: "password123",
      }

      const result = loginSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it("should reject invalid emails", () => {
      const invalidData = {
        email: "invalid-email",
        password: "password123",
      }

      const result = loginSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })

    it("should reject empty passwords", () => {
      const invalidData = {
        email: "john@example.com",
        password: "",
      }

      const result = loginSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })
})

describe("Security Functions", () => {
  describe("isAccountLocked", () => {
    it("should return false when lockedUntil is null", () => {
      expect(isAccountLocked(null)).toBe(false)
    })

    it("should return false when lockedUntil is in the past", () => {
      const pastDate = new Date(Date.now() - 60000) // 1 minute ago
      expect(isAccountLocked(pastDate)).toBe(false)
    })

    it("should return true when lockedUntil is in the future", () => {
      const futureDate = new Date(Date.now() + 60000) // 1 minute from now
      expect(isAccountLocked(futureDate)).toBe(true)
    })
  })

  describe("getLockoutExpiryTime", () => {
    it("should return a date 15 minutes from now", () => {
      const lockoutTime = getLockoutExpiryTime()
      const expectedTime = new Date(Date.now() + 15 * 60 * 1000)
      
      // Allow 1 second tolerance
      expect(lockoutTime.getTime()).toBeCloseTo(expectedTime.getTime(), -2)
    })
  })

  describe("sanitizeError", () => {
    it("should return generic message for database errors", () => {
      const dbError = new Error("User with this email already exists")
      const sanitized = sanitizeError(dbError)
      expect(sanitized).toBe("An error occurred. Please try again.")
    })

    it("should return generic message for validation errors", () => {
      const validationError = new Error("Password does not meet requirements")
      const sanitized = sanitizeError(validationError)
      expect(sanitized).toBe("An error occurred. Please try again.")
    })

    it("should preserve custom auth errors", () => {
      const authError = new Error("Invalid credentials")
      const sanitized = sanitizeError(authError)
      expect(sanitized).toBe("Invalid credentials")
    })
  })
})

describe("registerUser", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should register a new user successfully", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.create.mockResolvedValue({
      id: "user-123",
      email: "john@example.com",
      name: "John Doe",
      securityStamp: "stamp-abc",
      profile: {},
    })

    const userData = {
      name: "John Doe",
      email: "john@example.com",
      password: "SecurePass123!",
    }

    const result = await registerUser(userData)

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: "john@example.com" },
    })

    expect(mockPrisma.user.create).toHaveBeenCalled()
    expect(result.email).toBe("john@example.com")
    expect(result.name).toBe("John Doe")
  })

  it("should throw error when user already exists", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "existing-user",
      email: "john@example.com",
    })

    const userData = {
      name: "John Doe",
      email: "john@example.com",
      password: "SecurePass123!",
    }

    await expect(registerUser(userData)).rejects.toThrow(
      "User with this email already exists"
    )
  })
})

describe("authenticateUser", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should authenticate user with valid credentials", async () => {
    const mockUser = {
      id: "user-123",
      email: "john@example.com",
      name: "John Doe",
      passwordHash: await argon2.hash("SecurePass123!"),
      failedLoginAttempts: 0,
      lockedUntil: null,
      profile: {},
    }

    mockPrisma.user.findUnique.mockResolvedValue(mockUser)
    mockPrisma.user.update.mockResolvedValue(mockUser)

    const result = await authenticateUser({
      email: "john@example.com",
      password: "SecurePass123!",
    })

    expect(result.email).toBe("john@example.com")
    expect(result.name).toBe("John Doe")
  })

  it("should return null for non-existent user", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)

    await expect(
      authenticateUser({
        email: "nonexistent@example.com",
        password: "password123",
      })
    ).rejects.toThrow("Invalid email or password")
  })

  it("should return null for locked account", async () => {
    const lockedUser = {
      id: "user-123",
      email: "john@example.com",
      passwordHash: "hash",
      failedLoginAttempts: 5,
      lockedUntil: new Date(Date.now() + 60000), // Locked for 1 more minute
      profile: {},
    }

    mockPrisma.user.findUnique.mockResolvedValue(lockedUser)

    await expect(
      authenticateUser({
        email: "john@example.com",
        password: "SecurePass123!",
      })
    ).rejects.toThrow(/Account temporarily locked/)
  })

  it("should increment failed attempts on wrong password", async () => {
    const mockUser = {
      id: "user-123",
      email: "john@example.com",
      passwordHash: await argon2.hash("CorrectPass123!"),
      failedLoginAttempts: 2,
      lockedUntil: null,
      profile: {},
    }

    mockPrisma.user.findUnique.mockResolvedValue(mockUser)
    mockPrisma.user.update.mockResolvedValue({
      ...mockUser,
      failedLoginAttempts: 3,
    })

    await expect(
      authenticateUser({
        email: "john@example.com",
        password: "WrongPassword123!",
      })
    ).rejects.toThrow("Invalid email or password")
    
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-123" },
      data: {
        failedLoginAttempts: 3,
      },
    })
  })

  it("should lock account after 5 failed attempts", async () => {
    const mockUser = {
      id: "user-123",
      email: "john@example.com",
      passwordHash: await argon2.hash("CorrectPass123!"),
      failedLoginAttempts: 4,
      lockedUntil: null,
      profile: {},
    }

    mockPrisma.user.findUnique.mockResolvedValue(mockUser)

    await expect(
      authenticateUser({
        email: "john@example.com",
        password: "WrongPassword123!",
      })
    ).rejects.toThrow(/Account locked due to multiple failed attempts/)

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-123" },
      data: expect.objectContaining({
        failedLoginAttempts: 5,
        lockedUntil: expect.any(Date),
      }),
    })
  })
})

describe("requestPasswordReset", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should return success even if user doesn't exist (anti-enumeration)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)

    const result = await requestPasswordReset("nonexistent@example.com")

    expect(result.success).toBe(true)
    expect(mockPrisma.verificationToken.upsert).not.toHaveBeenCalled()
  })

  it("should create reset token for existing user", async () => {
    const mockUser = {
      id: "user-123",
      email: "john@example.com",
    }

    mockPrisma.user.findUnique.mockResolvedValue(mockUser)
    mockPrisma.verificationToken.upsert.mockResolvedValue({})

    const result = await requestPasswordReset("john@example.com")

    expect(result.success).toBe(true)
    expect(result.resetToken).toBeDefined()
    expect(mockPrisma.verificationToken.upsert).toHaveBeenCalled()
  })
})

describe("resetPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should reject invalid tokens", async () => {
    mockPrisma.verificationToken.findUnique.mockResolvedValue(null)

    await expect(
      resetPassword("john@example.com", "invalid-token", "NewPass123!")
    ).rejects.toThrow("Invalid or expired reset token")
  })

  it("should reject expired tokens", async () => {
    const expiredToken = {
      identifier: "password-reset:john@example.com",
      token: "valid-token",
      expires: new Date(Date.now() - 60000), // Expired 1 minute ago
    }

    mockPrisma.verificationToken.findUnique.mockResolvedValue(expiredToken)

    await expect(
      resetPassword("john@example.com", "valid-token", "NewPass123!")
    ).rejects.toThrow("Invalid or expired reset token")
  })

  it("should reject weak new passwords", async () => {
    const validToken = {
      identifier: "password-reset:john@example.com",
      token: "valid-token",
      expires: new Date(Date.now() + 3600000), // Valid for 1 hour
    }

    mockPrisma.verificationToken.findUnique.mockResolvedValue(validToken)

    await expect(
      resetPassword("john@example.com", "valid-token", "weak")
    ).rejects.toThrow("Password does not meet requirements")
  })

  it("should successfully reset password with valid token", async () => {
    const validToken = {
      identifier: "password-reset:john@example.com",
      token: "valid-token",
      expires: new Date(Date.now() + 3600000),
    }

    const mockUser = {
      id: "user-123",
      email: "john@example.com",
    }

    mockPrisma.verificationToken.findUnique.mockResolvedValue(validToken)
    mockPrisma.user.findUnique.mockResolvedValue(mockUser)
    mockPrisma.user.update.mockResolvedValue(mockUser)
    mockPrisma.verificationToken.delete.mockResolvedValue({})

    const result = await resetPassword(
      "john@example.com",
      "valid-token",
      "NewSecurePass123!"
    )

    expect(result).toBe(true)
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-123" },
      data: expect.objectContaining({
        passwordHash: expect.any(String),
        failedLoginAttempts: 0,
        lockedUntil: null,
        securityStamp: expect.any(String),
      }),
    })
    expect(mockPrisma.verificationToken.delete).toHaveBeenCalled()
  })
})
