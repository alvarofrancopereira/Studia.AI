import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/study/attempts/[id]
 * Get a specific study attempt by ID with ownership verification
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 },
      );
    }

    const studentId = session.user.id;
    const { id: attemptId } = await params;

    // Fetch attempt with ownership check - studentId must match session
    const attempt = await prisma.studyAttempt.findFirst({
      where: {
        id: attemptId,
        studentId, // Critical: ensures user can only access their own attempts
      },
      include: {
        topic: {
          include: {
            subject: true,
          },
        },
        answers: {
          include: {
            question: {
              select: {
                id: true,
                content: true,
                questionType: true,
                difficulty: true,
              },
            },
            selectedOption: {
              select: {
                id: true,
                content: true,
              },
            },
          },
          orderBy: { answeredAt: "asc" },
        },
      },
    });

    if (!attempt) {
      return NextResponse.json(
        { error: "Study attempt not found or access denied" },
        { status: 404 },
      );
    }

    // Calculate statistics
    const totalQuestions = attempt.answers.length;
    const correctAnswers = attempt.answers.filter((a) => a.isCorrect).length;
    const accuracy =
      totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

    return NextResponse.json({
      attempt: {
        id: attempt.id,
        topic: attempt.topic,
        startedAt: attempt.startedAt,
        completedAt: attempt.completedAt,
        score: attempt.score,
        status: attempt.status,
        totalQuestions,
        correctAnswers,
        accuracy,
        answers: attempt.answers.map((answer) => ({
          id: answer.id,
          question: answer.question,
          answerText: answer.answerText,
          selectedOption: answer.selectedOption,
          isCorrect: answer.isCorrect,
          points: answer.points,
          answeredAt: answer.answeredAt,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching study attempt:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/study/attempts/[id]
 * Update a study attempt (e.g., complete or abandon)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 },
      );
    }

    const studentId = session.user.id;
    const { id: attemptId } = await params;
    const body = await request.json();
    const { status, score } = body;

    // Verify valid status transitions
    const validStatuses = ["COMPLETED", "ABANDONED"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        {
          error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        },
        { status: 400 },
      );
    }

    // Fetch attempt with ownership check
    const existingAttempt = await prisma.studyAttempt.findFirst({
      where: {
        id: attemptId,
        studentId,
      },
    });

    if (!existingAttempt) {
      return NextResponse.json(
        { error: "Study attempt not found or access denied" },
        { status: 404 },
      );
    }

    // Prevent modifying completed attempts
    if (existingAttempt.status === "COMPLETED") {
      return NextResponse.json(
        { error: "Cannot modify a completed study attempt" },
        { status: 400 },
      );
    }

    // Build update data
    const updateData: {
      status?: string;
      completedAt?: Date;
      score?: number | null;
    } = {};

    if (status) {
      updateData.status = status;
      if (status === "COMPLETED" || status === "ABANDONED") {
        updateData.completedAt = new Date();
      }
    }

    if (score !== undefined) {
      updateData.score = score;
    }

    // Update the attempt
    const updatedAttempt = await prisma.studyAttempt.update({
      where: { id: attemptId },
      data: updateData,
      include: {
        topic: {
          include: {
            subject: true,
          },
        },
      },
    });

    return NextResponse.json({
      attempt: updatedAttempt,
    });
  } catch (error) {
    console.error("Error updating study attempt:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
