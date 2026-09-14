import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const startDiagnosticSchema = z.object({
  topicId: z.string().uuid(),
  questionCount: z.number().int().min(1).max(20).default(5),
});

/**
 * POST /api/diagnostic/start
 * Start a new diagnostic assessment for the authenticated student
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 },
      );
    }

    const studentId = session.user.id;
    const body = await request.json();

    const validation = startDiagnosticSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.errors },
        { status: 400 },
      );
    }

    const { topicId, questionCount } = validation.data;

    // Verify topic exists
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: {
        subject: true,
      },
    });

    if (!topic) {
      return NextResponse.json({ error: "Topic not found" }, { status: 404 });
    }

    // Get active questions for this topic with their options
    const availableQuestions = await prisma.question.findMany({
      where: {
        topicId,
        isActive: true,
      },
      include: {
        options: {
          orderBy: { order: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    if (availableQuestions.length === 0) {
      return NextResponse.json(
        { error: "No questions available for this topic" },
        { status: 400 },
      );
    }

    // Select random questions for diagnostic (up to questionCount or available)
    const selectedCount = Math.min(questionCount, availableQuestions.length);
    const shuffled = availableQuestions.sort(() => Math.random() - 0.5);
    const selectedQuestions = shuffled.slice(0, selectedCount);

    // Create the diagnostic attempt
    const attempt = await prisma.diagnosticAttempt.create({
      data: {
        studentId,
        topicId,
        totalQuestions: selectedCount,
        status: "IN_PROGRESS",
        baselineLevel: "UNKNOWN",
      },
      include: {
        topic: {
          include: {
            subject: true,
          },
        },
      },
    });

    // Create diagnostic question records
    const diagnosticQuestions = await Promise.all(
      selectedQuestions.map((question, index) =>
        prisma.diagnosticQuestion.create({
          data: {
            attemptId: attempt.id,
            questionId: question.id,
            order: index,
          },
          include: {
            question: {
              include: {
                options: {
                  orderBy: { order: "asc" },
                },
              },
            },
          },
        }),
      ),
    );

    // Return attempt with questions (sanitized - no correct answers exposed)
    const sanitizedQuestions = diagnosticQuestions.map((dq) => ({
      id: dq.question.id,
      content: dq.question.content,
      difficulty: dq.question.difficulty,
      questionType: dq.question.questionType,
      tags: dq.question.tags,
      order: dq.order,
      diagnosticQuestionId: dq.id,
      options: dq.question.options.map((opt) => ({
        id: opt.id,
        content: opt.content,
        order: opt.order,
        // NEVER expose isCorrect to the client during the diagnostic
      })),
    }));

    return NextResponse.json({
      attempt: {
        id: attempt.id,
        topic: attempt.topic,
        startedAt: attempt.startedAt,
        status: attempt.status,
        totalQuestions: attempt.totalQuestions,
      },
      questions: sanitizedQuestions,
    });
  } catch (error) {
    console.error("Error starting diagnostic assessment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
