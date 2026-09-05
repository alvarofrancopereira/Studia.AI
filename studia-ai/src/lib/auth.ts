import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { z } from "zod"

const prisma = new PrismaClient()

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

export type RegisterInput = z.infer<typeof registerSchema>

export async function registerUser(data: RegisterInput) {
  const { name, email, password } = data

  const existingUser = await prisma.user.findUnique({
    where: { email },
  })

  if (existingUser) {
    throw new Error("User with this email already exists")
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: hashedPassword,
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

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
})

export type LoginInput = z.infer<typeof loginSchema>

export async function authenticateUser(data: LoginInput) {
  const { email, password } = data

  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      profile: true,
    },
  })

  if (!user || !user.passwordHash) {
    throw new Error("Invalid email or password")
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash)

  if (!isPasswordValid) {
    throw new Error("Invalid email or password")
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    profile: user.profile,
  }
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      profile: true,
    },
  })

  return user
}
