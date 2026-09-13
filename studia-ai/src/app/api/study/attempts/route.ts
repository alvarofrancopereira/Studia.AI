import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createAttemptSchema = z.object({
  topicId: z.string().uuid(),
});

/**
 * POST /api/study/attempts
 * Create a new study attempt for the authenticated student
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

    const validation = createAttemptSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.errors },
        { status: 400 },
      );
    }

    const { topicId } = validation.data;

    // Verify topic exists and get its subject
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: {
        subject: true,
      },
    });

    if (!topic) {
      return NextResponse.json({ error: "Topic not found" }, { status: 404 });
    }

    // For now, allow any authenticated user to study any topic
    // In a real system, you might check enrollment or other access rules

    // Get active questions for this topic
    const questions = await prisma.question.findMany({
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

    // Create the study attempt
    const attempt = await prisma.studyAttempt.create({
      data: {
        studentId,
        topicId,
        status: "IN_PROGRESS",
      },
      include: {
        topic: {
          include: {
            subject: true,
          },
        },
      },
    });

    // Return attempt with questions (sanitized - no correct answers exposed)
    const sanitizedQuestions = questions.map((q) => ({
      id: q.id,
      content: q.content,
      difficulty: q.difficulty,
      questionType: q.questionType,
      tags: q.tags,
      options: q.options.map((opt) => ({
        id: opt.id,
        content: opt.content,
        order: opt.order,
        // NEVER expose isCorrect to the client during the attempt
      })),
    }));

    return NextResponse.json({
      attempt: {
        id: attempt.id,
        topic: attempt.topic,
        startedAt: attempt.startedAt,
        status: attempt.status,
      },
      questions: sanitizedQuestions,
    });
  } catch (error) {
    console.error("Error creating study attempt:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/study/attempts
 * List all study attempts for the authenticated student
 */
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 },
      );
    }

    const studentId = session.user.id;

    const attempts = await prisma.studyAttempt.findMany({
      where: { studentId },
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
      orderBy: { startedAt: "desc" },
    });

    const formattedAttempts = attempts.map((attempt) => ({
      id: attempt.id,
      topic: attempt.topic,
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt,
      score: attempt.score,
      status: attempt.status,
      totalQuestions: attempt.answers.length,
      correctAnswers: attempt.answers.filter((a) => a.isCorrect).length,
    }));

    return NextResponse.json({ attempts: formattedAttempts });
  } catch (error) {
    console.error("Error fetching study attempts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
