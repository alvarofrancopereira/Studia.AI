import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { z } from "zod";

const questionSchema = z.object({
  topicId: z.string().uuid(),
  content: z.string().min(1, "Content is required"),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  questionType: z
    .enum([
      "multiple_choice",
      "true_false",
      "short_answer",
      "open_ended",
      "matching",
      "ordering",
    ])
    .default("multiple_choice"),
  explanation: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const topicId = searchParams.get("topicId");
    const difficulty = searchParams.get("difficulty");
    const questionType = searchParams.get("questionType");

    // Build ownership-aware query: questions belong to topics that belong to subjects owned by this teacher
    const where: {
      isActive?: boolean;
      topic?: {
        subject?: {
          teacherId?: string;
        };
      };
      topicId?: string;
      difficulty?: string;
      questionType?: string;
    } = { 
      isActive: true,
      topic: {
        subject: {
          teacherId: user.id
        }
      }
    };

    if (topicId) {
      where.topicId = topicId;
    }

    if (difficulty) {
      where.difficulty = difficulty;
    }

    if (questionType) {
      where.questionType = questionType;
    }

    const questions = await prisma.question.findMany({
      where,
      include: {
        topic: {
          select: {
            id: true,
            name: true,
            subject: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        options: {
          orderBy: { order: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Questions are already filtered by ownership via the where clause
    const sanitizedQuestions = questions.map((q) => ({
      id: q.id,
      topicId: q.topicId,
      content: q.content,
      difficulty: q.difficulty,
      questionType: q.questionType,
      explanation: q.explanation,
      tags: q.tags,
      topic: q.topic,
      options: q.options.map((opt) => ({
        id: opt.id,
        content: opt.content,
        order: opt.order,
      })),
    }));

    return NextResponse.json({ questions: sanitizedQuestions });
  } catch (error) {
    console.error("Error fetching questions:", error);
    return NextResponse.json(
      { error: "Failed to fetch questions" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const validation = questionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validation.error.errors },
        { status: 400 },
      );
    }

    const { topicId, content, difficulty, questionType, explanation, tags } =
      validation.data;

    // Verify topic exists and belongs to a subject owned by this teacher
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      include: {
        subject: {
          select: { teacherId: true },
        },
      },
    });

    if (!topic) {
      return NextResponse.json({ error: "Topic not found" }, { status: 404 });
    }

    // Verify ownership: the topic's subject must belong to this teacher
    if (topic.subject.teacherId !== user.id) {
      return NextResponse.json(
        { error: "Forbidden: You can only create questions in your own subjects" },
        { status: 403 },
      );
    }

    const question = await prisma.question.create({
      data: {
        topicId,
        content,
        difficulty,
        questionType,
        explanation,
        tags,
      },
      include: {
        topic: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ question }, { status: 201 });
  } catch (error) {
    console.error("Error creating question:", error);
    return NextResponse.json(
      { error: "Failed to create question" },
      { status: 500 },
    );
  }
}
