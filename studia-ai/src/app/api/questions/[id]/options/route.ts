import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { z } from "zod";

const optionSchema = z.object({
  content: z.string().min(1, "Content is required"),
  isCorrect: z.boolean().default(false),
  order: z.number().int().default(0),
  explanation: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id: questionId } = await params;
    const body = await request.json();
    const validation = optionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validation.error.errors },
        { status: 400 },
      );
    }

    // Verify question exists
    const question = await prisma.question.findUnique({
      where: { id: questionId },
    });

    if (!question) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 },
      );
    }

    const option = await prisma.questionOption.create({
      data: {
        questionId,
        ...validation.data,
      },
    });

    return NextResponse.json({ option }, { status: 201 });
  } catch (error) {
    console.error("Error creating option:", error);
    return NextResponse.json(
      { error: "Failed to create option" },
      { status: 500 },
    );
  }
}
