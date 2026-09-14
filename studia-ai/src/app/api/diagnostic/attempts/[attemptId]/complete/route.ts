import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

/**
 * PUT /api/diagnostic/attempts/[attemptId]/complete
 * Complete a diagnostic assessment and calculate baseline level
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> },
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
    const { attemptId } = await params;

    // Fetch attempt with ownership verification
    const attempt = await prisma.diagnosticAttempt.findFirst({
      where: {
        id: attemptId,
        studentId,
      },
      include: {
        questions: {
          include: {
            question: {
              select: {
                id: true,
                difficulty: true,
              },
            },
          },
        },
        topic: {
          include: {
            subject: true,
          },
        },
      },
    });

    if (!attempt) {
      return NextResponse.json(
        { error: "Diagnostic attempt not found or access denied" },
        { status: 404 },
      );
    }

    // Check if already completed
    if (attempt.status === "COMPLETED") {
      return NextResponse.json(
        { error: "Diagnostic attempt is already completed" },
        { status: 400 },
      );
    }

    // Verify all questions have been answered
    const unansweredQuestions = attempt.questions.filter(
      (q) => !q.selectedOptionId,
    );

    if (unansweredQuestions.length > 0) {
      return NextResponse.json(
        {
          error: `Please answer all questions before completing. ${unansweredQuestions.length} question(s) remaining.`,
        },
        { status: 400 },
      );
    }

    // Calculate final score
    const totalQuestions = attempt.questions.length;
    const correctCount = attempt.questions.filter((q) => q.isCorrect).length;
    const finalScore =
      totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

    // Determine baseline level based on score
    let baselineLevel = "UNKNOWN";
    if (finalScore >= 80) {
      baselineLevel = "ADVANCED";
    } else if (finalScore >= 60) {
      baselineLevel = "INTERMEDIATE";
    } else if (finalScore >= 40) {
      baselineLevel = "BEGINNER";
    } else {
      baselineLevel = "BEGINNER";
    }

    // Analyze strengths and weaknesses by difficulty
    const difficultyAnalysis = attempt.questions.reduce(
      (acc, q) => {
        const difficulty = q.question.difficulty.toLowerCase();
        if (!acc[difficulty]) {
          acc[difficulty] = { total: 0, correct: 0 };
        }
        acc[difficulty].total++;
        if (q.isCorrect) {
          acc[difficulty].correct++;
        }
        return acc;
      },
      {} as Record<string, { total: number; correct: number }>,
    );

    // Identify strengths (>= 70% accuracy) and weaknesses (< 50% accuracy)
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    Object.entries(difficultyAnalysis).forEach(([difficulty, stats]) => {
      const accuracy = (stats.correct / stats.total) * 100;
      if (accuracy >= 70) {
        strengths.push(`${difficulty} difficulty`);
      } else if (accuracy < 50) {
        weaknesses.push(`${difficulty} difficulty`);
      }
    });

    // Update the attempt with final values
    const updatedAttempt = await prisma.diagnosticAttempt.update({
      where: { id: attemptId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        score: finalScore,
        correctAnswers: correctCount,
        baselineLevel,
        strengths: strengths.length > 0 ? JSON.stringify(strengths) : null,
        weaknesses: weaknesses.length > 0 ? JSON.stringify(weaknesses) : null,
      },
      include: {
        topic: {
          include: {
            subject: true,
          },
        },
        questions: {
          include: {
            question: {
              select: {
                id: true,
                content: true,
                difficulty: true,
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
          orderBy: { order: "asc" },
        },
      },
    });

    // Update or create user's mastery record for this topic
    const existingMastery = await prisma.userTopicMastery.findUnique({
      where: {
        userId_topicId: {
          userId: studentId,
          topicId: attempt.topicId,
        },
      },
    });

    if (!existingMastery) {
      // Initialize mastery based on diagnostic result
      await prisma.userTopicMastery.create({
        data: {
          userId: studentId,
          topicId: attempt.topicId,
          masteryLevel: finalScore,
          accuracy: finalScore,
          reviewCount: 1,
          correctCount: correctCount,
          lastStudied: new Date(),
        },
      });
    } else {
      // Update existing mastery with weighted average
      const newReviewCount = existingMastery.reviewCount + 1;
      const newCorrectCount = existingMastery.correctCount + correctCount;
      const newAccuracy =
        (existingMastery.accuracy * existingMastery.reviewCount + finalScore) /
        newReviewCount;

      await prisma.userTopicMastery.update({
        where: {
          userId_topicId: {
            userId: studentId,
            topicId: attempt.topicId,
          },
        },
        data: {
          masteryLevel: existingMastery.masteryLevel * 0.7 + finalScore * 0.3, // Weight recent performance
          accuracy: newAccuracy,
          reviewCount: newReviewCount,
          correctCount: newCorrectCount,
          lastStudied: new Date(),
        },
      });
    }

    return NextResponse.json({
      attempt: {
        id: updatedAttempt.id,
        topic: updatedAttempt.topic,
        startedAt: updatedAttempt.startedAt,
        completedAt: updatedAttempt.completedAt,
        score: updatedAttempt.score,
        status: updatedAttempt.status,
        baselineLevel: updatedAttempt.baselineLevel,
        totalQuestions: updatedAttempt.totalQuestions,
        correctAnswers: updatedAttempt.correctAnswers,
        strengths,
        weaknesses,
        questions: updatedAttempt.questions.map((q) => ({
          id: q.id,
          question: q.question,
          selectedOption: q.selectedOption,
          isCorrect: q.isCorrect,
          timeSpent: q.timeSpent,
          answeredAt: q.answeredAt,
        })),
      },
    });
  } catch (error) {
    console.error("Error completing diagnostic assessment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
