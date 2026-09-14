import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/diagnostic/results
 * Get diagnostic assessment results and history for the authenticated student
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 },
      );
    }

    const studentId = session.user.id;
    const { searchParams } = new URL(request.url);
    const topicId = searchParams.get("topicId");
    const attemptId = searchParams.get("attemptId");

    // If specific attemptId is provided, return detailed results for that attempt
    if (attemptId) {
      const attempt = await prisma.diagnosticAttempt.findFirst({
        where: {
          id: attemptId,
          studentId,
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

      if (!attempt) {
        return NextResponse.json(
          { error: "Diagnostic attempt not found or access denied" },
          { status: 404 },
        );
      }

      // Parse strengths and weaknesses from JSON strings
      const strengths = attempt.strengths ? JSON.parse(attempt.strengths) : [];
      const weaknesses = attempt.weaknesses
        ? JSON.parse(attempt.weaknesses)
        : [];

      return NextResponse.json({
        attempt: {
          id: attempt.id,
          topic: attempt.topic,
          startedAt: attempt.startedAt,
          completedAt: attempt.completedAt,
          score: attempt.score,
          status: attempt.status,
          baselineLevel: attempt.baselineLevel,
          totalQuestions: attempt.totalQuestions,
          correctAnswers: attempt.correctAnswers,
          strengths,
          weaknesses,
          questions: attempt.questions.map((q) => ({
            id: q.id,
            question: q.question,
            selectedOption: q.selectedOption,
            isCorrect: q.isCorrect,
            timeSpent: q.timeSpent,
            answeredAt: q.answeredAt,
          })),
        },
      });
    }

    // Return summary of all diagnostic attempts
    const whereClause: Record<string, unknown> = {
      studentId,
    };

    if (topicId) {
      whereClause.topicId = topicId;
    }

    const attempts = await prisma.diagnosticAttempt.findMany({
      where: whereClause,
      include: {
        topic: {
          include: {
            subject: true,
          },
        },
      },
      orderBy: { startedAt: "desc" },
    });

    // Calculate overall diagnostic statistics
    const completedAttempts = attempts.filter((a) => a.status === "COMPLETED");
    const inProgressAttempts = attempts.filter(
      (a) => a.status === "IN_PROGRESS",
    );

    const overallStats = {
      totalAttempts: attempts.length,
      completedAttempts: completedAttempts.length,
      inProgressAttempts: inProgressAttempts.length,
      averageScore:
        completedAttempts.length > 0
          ? completedAttempts.reduce((sum, a) => sum + (a.score || 0), 0) /
            completedAttempts.length
          : 0,
      averageBaselineLevel: calculateAverageBaselineLevel(completedAttempts),
    };

    // Group attempts by topic for topic-level insights
    const attemptsByTopic = attempts.reduce(
      (acc, attempt) => {
        if (!acc[attempt.topicId]) {
          acc[attempt.topicId] = {
            topic: attempt.topic,
            attempts: [],
            latestBaselineLevel: "UNKNOWN",
          };
        }
        acc[attempt.topicId].attempts.push(attempt);
        if (attempt.status === "COMPLETED") {
          acc[attempt.topicId].latestBaselineLevel = attempt.baselineLevel;
        }
        return acc;
      },
      {} as Record<
        string,
        {
          topic: (typeof attempts)[0]["topic"];
          attempts: typeof attempts;
          latestBaselineLevel: string;
        }
      >,
    );

    return NextResponse.json({
      stats: overallStats,
      attempts: attempts.map((attempt) => ({
        id: attempt.id,
        topic: attempt.topic,
        startedAt: attempt.startedAt,
        completedAt: attempt.completedAt,
        score: attempt.score,
        status: attempt.status,
        baselineLevel: attempt.baselineLevel,
        totalQuestions: attempt.totalQuestions,
        correctAnswers: attempt.correctAnswers,
      })),
      topicSummaries: Object.values(attemptsByTopic).map((summary) => ({
        topic: summary.topic,
        attemptCount: summary.attempts.length,
        latestBaselineLevel: summary.latestBaselineLevel,
        averageScore:
          summary.attempts.filter((a) => a.status === "COMPLETED").length > 0
            ? summary.attempts
                .filter((a) => a.status === "COMPLETED")
                .reduce((sum, a) => sum + (a.score || 0), 0) /
              summary.attempts.filter((a) => a.status === "COMPLETED").length
            : 0,
      })),
    });
  } catch (error) {
    console.error("Error fetching diagnostic results:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

function calculateAverageBaselineLevel(
  attempts: Array<{ baselineLevel: string }>,
): string {
  if (attempts.length === 0) return "UNKNOWN";

  const levelScores: Record<string, number> = {
    UNKNOWN: 0,
    BEGINNER: 1,
    INTERMEDIATE: 2,
    ADVANCED: 3,
  };

  const totalScore = attempts.reduce(
    (sum, a) => sum + (levelScores[a.baselineLevel] || 0),
    0,
  );
  const avgScore = totalScore / attempts.length;

  if (avgScore >= 2.5) return "ADVANCED";
  if (avgScore >= 1.5) return "INTERMEDIATE";
  if (avgScore >= 0.5) return "BEGINNER";
  return "UNKNOWN";
}
