import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/app/api/auth/[...nextauth]/route";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; topicId: string }> }
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

    const { id: subjectId, topicId } = await params;

    // Buscar o tópico com detalhes
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: {
        subject: true,
        questions: {
          where: { isActive: true },
          include: {
            options: {
              orderBy: { order: "asc" },
            },
          },
          orderBy: { createdAt: "asc" },
          take: 10, // Limitar para não sobrecarregar
        },
        quizzes: {
          include: {
            quiz: true,
          },
        },
        flashcards: {
          where: { isActive: true },
        },
        puzzles: {
          where: { isActive: true },
        },
      },
    });

    if (!topic) {
      return NextResponse.json(
        { error: "Topic not found" },
        { status: 404 }
      );
    }

    // Verificar se o tópico pertence à matéria especificada
    if (topic.subjectId !== subjectId) {
      return NextResponse.json(
        { error: "Topic does not belong to the specified subject" },
        { status: 400 }
      );
    }

    // Buscar registro de mastery do usuário para este tópico
    const masteryRecord = await prisma.userTopicMastery.findUnique({
      where: {
        userId_topicId: {
          userId: user.id,
          topicId: topic.id,
        },
      },
    });

    // Contar itens relacionados
    const questionCount = await prisma.question.count({
      where: { topicId: topic.id, isActive: true },
    });

    const quizCount = await prisma.quizQuestion.count({
      where: { topicId: topic.id },
    });

    const flashcardCount = await prisma.flashcard.count({
      where: { topicId: topic.id, isActive: true },
    });

    const puzzleCount = await prisma.puzzle.count({
      where: { topicId: topic.id, isActive: true },
    });

    return NextResponse.json({
      topic: {
        id: topic.id,
        name: topic.name,
        description: topic.description,
        subjectName: topic.subject.name,
        subjectId: topic.subject.id,
        questionCount,
        quizCount,
        flashcardCount,
        puzzleCount,
        masteryLevel: masteryRecord?.masteryLevel ?? null,
        lastStudied: masteryRecord?.lastStudied ?? null,
        questions: topic.questions.map((q) => ({
          id: q.id,
          content: q.content,
          difficulty: q.difficulty,
          questionType: q.questionType,
          options: q.options.map((opt) => ({
            id: opt.id,
            content: opt.content,
            isCorrect: opt.isCorrect,
            order: opt.order,
          })),
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching topic details:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
