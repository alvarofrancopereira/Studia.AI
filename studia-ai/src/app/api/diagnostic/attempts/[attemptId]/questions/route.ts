import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const submitAnswerSchema = z.object({
  diagnosticQuestionId: z.string().uuid(),
  selectedOptionId: z.string().uuid(),
  timeSpent: z.number().int().min(0).default(0),
});

/**
 * POST /api/diagnostic/attempts/[attemptId]/questions
 * Submit an answer to a diagnostic question
 */
export async function POST(
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
    const body = await request.json();

    const validation = submitAnswerSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.errors },
        { status: 400 },
      );
    }

    const { diagnosticQuestionId, selectedOptionId, timeSpent } =
      validation.data;

    // Verify the attempt belongs to the authenticated student
    const attempt = await prisma.diagnosticAttempt.findFirst({
      where: {
        id: attemptId,
        studentId,
      },
    });

    if (!attempt) {
      return NextResponse.json(
        { error: "Diagnostic attempt not found or access denied" },
        { status: 404 },
      );
    }

    // Check if attempt is still in progress
    if (attempt.status !== "IN_PROGRESS") {
      return NextResponse.json(
        { error: "Cannot submit answers to a completed diagnostic" },
        { status: 400 },
      );
    }

    // Get the diagnostic question record
    const diagnosticQuestion = await prisma.diagnosticQuestion.findFirst({
      where: {
        id: diagnosticQuestionId,
        attemptId,
      },
      include: {
        question: {
          include: {
            options: true,
          },
        },
      },
    });

    if (!diagnosticQuestion) {
      return NextResponse.json(
        { error: "Question not found in this diagnostic attempt" },
        { status: 404 },
      );
    }

    // Find the selected option and verify it belongs to this question
    const selectedOption = await prisma.questionOption.findFirst({
      where: {
        id: selectedOptionId,
        questionId: diagnosticQuestion.questionId,
      },
    });

    if (!selectedOption) {
      return NextResponse.json(
        { error: "Invalid option selected" },
        { status: 400 },
      );
    }

    // SERVER-SIDE CORRECTION
    // The client NEVER sends isCorrect - server determines it
    const isCorrect = selectedOption.isCorrect;

    // Update the diagnostic question with the answer
    const updatedDiagnosticQuestion = await prisma.diagnosticQuestion.update({
      where: { id: diagnosticQuestionId },
      data: {
        selectedOptionId,
        isCorrect,
        timeSpent,
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

    // Calculate running statistics for the attempt
    const allQuestions = await prisma.diagnosticQuestion.findMany({
      where: { attemptId },
      select: {
        isCorrect: true,
      },
    });

    const totalAnswered = allQuestions.length;
    const correctCount = allQuestions.filter((q) => q.isCorrect).length;
    const score = totalAnswered > 0 ? (correctCount / totalAnswered) * 100 : 0;

    return NextResponse.json({
      question: {
        id: updatedDiagnosticQuestion.id,
        question: updatedDiagnosticQuestion.question,
        selectedOption: updatedDiagnosticQuestion.selectedOption,
        isCorrect: updatedDiagnosticQuestion.isCorrect,
        timeSpent: updatedDiagnosticQuestion.timeSpent,
        answeredAt: updatedDiagnosticQuestion.answeredAt,
      },
      attemptStats: {
        totalQuestions: attempt.totalQuestions,
        answeredQuestions: totalAnswered,
        correctAnswers: correctCount,
        score: score,
      },
    });
  } catch (error) {
    console.error("Error submitting diagnostic answer:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
