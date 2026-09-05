import { NextRequest, NextResponse } from "next/server"
import { registerSchema, registerUser } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const validatedData = registerSchema.parse(body)
    
    const user = await registerUser(validatedData)
    
    return NextResponse.json({ 
      success: true, 
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      }
    }, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { success: false, error: "Erro ao criar conta" },
      { status: 500 }
    )
  }
}
