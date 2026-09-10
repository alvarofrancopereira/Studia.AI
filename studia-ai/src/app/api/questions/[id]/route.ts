import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/app/api/auth/[...nextauth]/route";

export async function GET(
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

    const { id } = await params;

    const question = await prisma.question.findUnique({
      where: { id },
      include: {
        topic: {
          select: {
            id: true,
            name: true,
            subject: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        options: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!question) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 },
      );
    }

    // Sanitize: remove isCorrect from options for regular users
    const sanitizedQuestion = {
      ...question,
      options: question.options.map((opt) => ({
        id: opt.id,
        content: opt.content,
        order: opt.order,
        explanation: opt.explanation,
      })),
    };

    return NextResponse.json({ question: sanitizedQuestion });
  } catch (error) {
    console.error("Error fetching question:", error);
    return NextResponse.json(
      { error: "Failed to fetch question" },
      { status: 500 },
    );
  }
}

export async function PUT(
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

    const { id } = await params;
    const body = await request.json();
    const { content, difficulty, questionType, explanation, tags, isActive } =
      body;

    // Verify question exists
    const existingQuestion = await prisma.question.findUnique({
      where: { id },
    });

    if (!existingQuestion) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 },
      );
    }

    const updateData: {
      content?: string;
      difficulty?: string;
      questionType?: string;
      explanation?: string;
      tags?: string[];
      isActive?: boolean;
    } = {};
    if (content !== undefined) updateData.content = content;
    if (difficulty !== undefined) updateData.difficulty = difficulty;
    if (questionType !== undefined) updateData.questionType = questionType;
    if (explanation !== undefined) updateData.explanation = explanation;
    if (tags !== undefined) updateData.tags = tags;
    if (isActive !== undefined) updateData.isActive = isActive;

    const question = await prisma.question.update({
      where: { id },
      data: updateData,
      include: {
        topic: {
          select: {
            id: true,
            name: true,
          },
        },
        options: {
          orderBy: { order: "asc" },
        },
      },
    });

    return NextResponse.json({ question });
  } catch (error) {
    console.error("Error updating question:", error);
    return NextResponse.json(
      { error: "Failed to update question" },
      { status: 500 },
    );
  }
}

export async function DELETE(
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

    const { id } = await params;

    // Verify question exists
    const existingQuestion = await prisma.question.findUnique({
      where: { id },
    });

    if (!existingQuestion) {
      return NextResponse.json(
        { error: "Question not found" },
        { status: 404 },
      );
    }

    // Soft delete by setting isActive to false
    await prisma.question.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ message: "Question deleted successfully" });
  } catch (error) {
    console.error("Error deleting question:", error);
    return NextResponse.json(
      { error: "Failed to delete question" },
      { status: 500 },
    );
  }
}
