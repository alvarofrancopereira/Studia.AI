import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const submitAnswerSchema = z.object({
  questionId: z.string().uuid(),
  answerText: z.string().optional(),
  selectedOptionId: z.string().uuid().optional(),
});

/**
 * POST /api/study/attempts/[attemptId]/answers
 * Submit an answer to a question in a study attempt
 * Server-side correction is performed - client cannot determine correctness
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
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
    const { attemptId } = await params;
    const body = await request.json();
    
    const validation = submitAnswerSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { questionId, answerText, selectedOptionId } = validation.data;

    // Verify the attempt belongs to the authenticated student
    const attempt = await prisma.studyAttempt.findFirst({
      where: {
        id: attemptId,
        studentId,
      },
      include: {
        topic: true,
      },
    });

    if (!attempt) {
      return NextResponse.json(
        { error: 'Study attempt not found or access denied' },
        { status: 404 }
      );
    }

    // Check if attempt is still in progress
    if (attempt.status !== 'IN_PROGRESS') {
      return NextResponse.json(
        { error: 'Cannot submit answers to a completed or abandoned attempt' },
        { status: 400 }
      );
    }

    // Verify the question belongs to the same topic as the attempt
    const question = await prisma.question.findFirst({
      where: {
        id: questionId,
        topicId: attempt.topicId,
        isActive: true,
      },
      include: {
        options: true,
      },
    });

    if (!question) {
      return NextResponse.json(
        { error: 'Question not found or does not belong to this topic' },
        { status: 404 }
      );
    }

    // Check if answer already exists for this question in this attempt
    const existingAnswer = await prisma.answer.findFirst({
      where: {
        attemptId,
        questionId,
      },
    });

    if (existingAnswer) {
      return NextResponse.json(
        { error: 'Answer already submitted for this question' },
        { status: 400 }
      );
    }

    // SERVER-SIDE CORRECTION
    // The client NEVER sends isCorrect or points - server calculates them
    let isCorrect = false;
    let points = 0;
    let finalSelectedOptionId: string | null = null;

    if (question.questionType === 'multiple_choice' || question.questionType === 'true_false') {
      if (!selectedOptionId) {
        return NextResponse.json(
          { error: 'selectedOptionId is required for multiple choice questions' },
          { status: 400 }
        );
      }

      // Find the selected option and verify it belongs to this question
      const selectedOption = await prisma.questionOption.findFirst({
        where: {
          id: selectedOptionId,
          questionId,
        },
      });

      if (!selectedOption) {
        return NextResponse.json(
          { error: 'Invalid option selected' },
          { status: 400 }
        );
      }

      finalSelectedOptionId = selectedOptionId;
      
      // Server determines correctness based on the option's isCorrect flag
      isCorrect = selectedOption.isCorrect;
      
      // Points: 1 for correct, 0 for incorrect (can be adjusted based on difficulty)
      points = isCorrect ? 1 : 0;
    } else if (question.questionType === 'short_answer' || question.questionType === 'open_ended') {
      if (!answerText) {
        return NextResponse.json(
          { error: 'answerText is required for open-ended questions' },
          { status: 400 }
        );
      }

      // For open-ended questions, we mark as pending review
      // In a real system, this might trigger AI grading or teacher review
      // For M6, we'll do simple exact match if there's a reference answer
      // Since we don't have reference answers stored yet, mark as requiring review
      isCorrect = false; // Pending review
      points = 0; // Pending review
    }

    // Create the answer record with server-calculated values
    const answer = await prisma.answer.create({
      data: {
        attemptId,
        questionId,
        answerText: answerText || null,
        selectedOptionId: finalSelectedOptionId,
        isCorrect,
        points,
      },
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
    });

    // Calculate running score for the attempt
    const allAnswers = await prisma.answer.findMany({
      where: { attemptId },
      select: {
        isCorrect: true,
        points: true,
      },
    });

    const totalQuestions = allAnswers.length;
    const correctCount = allAnswers.filter((a) => a.isCorrect).length;
    const totalPoints = allAnswers.reduce((sum, a) => sum + a.points, 0);
    
    // Score percentage based on correct answers
    const score = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

    return NextResponse.json({
      answer: {
        id: answer.id,
        question: answer.question,
        selectedOption: answer.selectedOption,
        isCorrect: answer.isCorrect,
        points: answer.points,
        answeredAt: answer.answeredAt,
      },
      attemptStats: {
        totalQuestions: totalQuestions,
        correctAnswers: correctCount,
        score: score,
        totalPoints: totalPoints,
      },
    });
  } catch (error) {
    console.error('Error submitting answer:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
