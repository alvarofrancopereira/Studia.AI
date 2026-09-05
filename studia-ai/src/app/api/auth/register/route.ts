import { NextRequest, NextResponse } from "next/server"
import { registerUser, registerSchema } from "@/lib/auth"
import { z } from "zod"

// Rate limiting simple implementation
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

const RATE_LIMIT_MAX = 5 // 5 attempts
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const record = rateLimitMap.get(ip)
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS })
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 }
  }
  
  if (record.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 }
  }
  
  record.count++
  rateLimitMap.set(ip, record)
  
  return { 
    allowed: true, 
    remaining: RATE_LIMIT_MAX - record.count 
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const ip = request.headers.get("x-forwarded-for") || "unknown"
    
    // Check rate limit
    const rateLimitResult = checkRateLimit(ip)
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: "Too many registration attempts. Please try again later." },
        { status: 429 }
      )
    }
    
    // Add rate limit headers
    const headers = new Headers()
    headers.set("X-RateLimit-Limit", RATE_LIMIT_MAX.toString())
    headers.set("X-RateLimit-Remaining", rateLimitResult.remaining.toString())
    
    // Parse and validate request body
    const body = await request.json()
    
    const validatedData = registerSchema.safeParse(body)
    
    if (!validatedData.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validatedData.error.flatten().fieldErrors },
        { status: 400, headers }
      )
    }
    
    // Register user
    const user = await registerUser(validatedData.data)
    
    return NextResponse.json(
      { 
        success: true, 
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        }
      },
      { status: 201, headers }
    )
  } catch (error) {
    console.error("Registration error:", error)
    
    if (error instanceof Error && error.message === "User with this email already exists") {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 409 }
      )
    }
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
