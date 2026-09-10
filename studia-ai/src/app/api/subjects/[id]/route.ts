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

    const { id: subjectId } = await params;

    // Buscar matéria com tópicos - verificar ownership
    const subject = await prisma.subject.findUnique({
      where: { 
        id: subjectId,
        teacherId: user.id 
      },
      include: {
        topics: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!subject) {
      return NextResponse.json({ error: "Subject not found" }, { status: 404 });
    }

    // Contar itens por tópico
    const topicsWithCount = await Promise.all(
      subject.topics.map(async (topic) => {
        const [questionCount, quizCount, flashcardCount, puzzleCount] =
          await Promise.all([
            prisma.question.count({
              where: { topicId: topic.id, isActive: true },
            }),
            prisma.quizQuestion.count({
              where: { topicId: topic.id },
            }),
            prisma.flashcard.count({
              where: { topicId: topic.id, isActive: true },
            }),
            prisma.puzzle.count({
              where: { topicId: topic.id, isActive: true },
            }),
          ]);

        // Buscar mastery do usuário
        const masteryRecord = await prisma.userTopicMastery.findUnique({
          where: {
            userId_topicId: {
              userId: user.id,
              topicId: topic.id,
            },
          },
        });

        return {
          id: topic.id,
          name: topic.name,
          description: topic.description,
          order: topic.order,
          questionCount,
          quizCount,
          flashcardCount,
          puzzleCount,
          masteryLevel: masteryRecord?.masteryLevel || null,
        };
      }),
    );

    return NextResponse.json({
      subject: {
        id: subject.id,
        name: subject.name,
        description: subject.description,
        color: subject.color,
        topicCount: subject.topics.length,
        topics: topicsWithCount,
      },
    });
  } catch (error) {
    console.error("Error fetching subject:", error);
    return NextResponse.json(
      { error: "Failed to fetch subject" },
      { status: 500 },
    );
  }
}
