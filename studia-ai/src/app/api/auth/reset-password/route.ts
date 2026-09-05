import { NextRequest, NextResponse } from "next/server"
import { resetPassword } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json()
    const { email, token, newPassword } = body
    
    // Validate required fields
    if (!email || !token || !newPassword) {
      return NextResponse.json(
        { error: "Email, token, and new password are required" },
        { status: 400 }
      )
    }
    
    if (typeof email !== "string" || typeof token !== "string" || typeof newPassword !== "string") {
      return NextResponse.json(
        { error: "Invalid field types" },
        { status: 400 }
      )
    }
    
    // Reset password
    await resetPassword(email, token, newPassword)
    
    return NextResponse.json({
      success: true,
      message: "Password has been reset successfully.",
    })
  } catch (error) {
    console.error("Password reset error:", error)
    
    if (error instanceof Error) {
      if (error.message === "Invalid or expired reset token") {
        return NextResponse.json(
          { error: "Invalid or expired reset token" },
          { status: 400 }
        )
      }
      
      if (error.message === "Password does not meet requirements") {
        return NextResponse.json(
          { error: "Password does not meet requirements" },
          { status: 400 }
        )
      }
    }
    
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
