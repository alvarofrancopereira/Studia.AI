import { NextRequest, NextResponse } from "next/server"
import { requestPasswordReset } from "@/lib/auth"

// Rate limiting for password reset requests
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

const RATE_LIMIT_MAX = 3 // 3 attempts per window
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000 // 1 hour

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(ip)
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  
  if (record.count >= RATE_LIMIT_MAX) {
    return false
  }
  
  record.count++
  rateLimitMap.set(ip, record)
  
  return true
}

export async function POST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const ip = request.headers.get("x-forwarded-for") || "unknown"
    
    // Check rate limit
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      )
    }
    
    // Parse request body
    const body = await request.json()
    const { email } = body
    
    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      )
    }
    
    // Request password reset (anti-enumeration: always returns success)
    const result = await requestPasswordReset(email)
    
    // In production, send email here and don't return the token
    // For development/testing, we return the token
    return NextResponse.json({
      success: true,
      message: "If an account exists with this email, you will receive password reset instructions.",
      // Remove in production:
      resetToken: result.resetToken,
      expiresAt: result.expiresAt,
    })
  } catch (error) {
    console.error("Password reset request error:", error)
    
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
