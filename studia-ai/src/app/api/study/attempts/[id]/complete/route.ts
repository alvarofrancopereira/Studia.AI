import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';

/**
 * PUT /api/study/attempts/[id]/complete
 * Complete or abandon a study attempt with final score calculation
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      );
    }

    const studentId = session.user.id;
    const { id: attemptId } = await params;
    const body = await request.json();
    const { status } = body;

    // Validate status
    const validStatuses = ['COMPLETED', 'ABANDONED'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Fetch attempt with ownership verification
    const attempt = await prisma.studyAttempt.findFirst({
      where: {
        id: attemptId,
        studentId,
      },
      include: {
        answers: {
          select: {
            isCorrect: true,
            points: true,
          },
        },
      },
    });

    if (!attempt) {
      return NextResponse.json(
        { error: 'Study attempt not found or access denied' },
        { status: 404 }
      );
    }

    // Check if already completed
    if (attempt.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'Attempt is already completed' },
        { status: 400 }
      );
    }

    if (attempt.status === 'ABANDONED') {
      return NextResponse.json(
        { error: 'Attempt was already abandoned' },
        { status: 400 }
      );
    }

    // Calculate final score based on answers
    const totalQuestions = attempt.answers.length;
    const correctCount = attempt.answers.filter((a) => a.isCorrect).length;
    
    // Score percentage: (correct answers / total answered) * 100
    const finalScore = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

    // Determine final status
    const finalStatus = status || 'COMPLETED';

    // Update the attempt with final values
    const updatedAttempt = await prisma.studyAttempt.update({
      where: { id: attemptId },
      data: {
        status: finalStatus,
        completedAt: new Date(),
        score: finalScore,
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
              },
            },
            selectedOption: {
              select: {
                id: true,
                content: true,
              },
            },
          },
          orderBy: { answeredAt: 'asc' },
        },
      },
    });

    // Update user's mastery record for this topic if completed successfully
    if (finalStatus === 'COMPLETED' && finalScore >= 70) {
      await prisma.userTopicMastery.upsert({
        where: {
          userId_topicId: {
            userId: studentId,
            topicId: attempt.topicId,
          },
        },
        update: {
          reviewCount: { increment: 1 },
          correctCount: { increment: correctCount },
          lastStudied: new Date(),
          accuracy: {
            set: ((correctCount / Math.max(totalQuestions, 1)) * 100),
          },
        },
        create: {
          userId: studentId,
          topicId: attempt.topicId,
          reviewCount: 1,
          correctCount: correctCount,
          accuracy: (correctCount / Math.max(totalQuestions, 1)) * 100,
          lastStudied: new Date(),
          masteryLevel: finalScore,
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
        totalQuestions,
        correctAnswers: correctCount,
        accuracy: totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0,
        answers: updatedAttempt.answers.map((answer) => ({
          id: answer.id,
          question: answer.question,
          selectedOption: answer.selectedOption,
          isCorrect: answer.isCorrect,
          points: answer.points,
          answeredAt: answer.answeredAt,
        })),
      },
    });
  } catch (error) {
    console.error('Error completing study attempt:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
