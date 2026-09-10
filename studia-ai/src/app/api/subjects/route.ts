import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/app/api/auth/[...nextauth]/route";

export async function GET() {
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

    // Buscar apenas matérias do usuário (teacher)
    const subjects = await prisma.subject.findMany({
      where: { 
        isActive: true,
        teacherId: user.id 
      },
      include: {
        topics: {
          where: {}, // Topic não tem isActive no schema atual
          select: { id: true },
        },
      },
      orderBy: { name: "asc" },
    });

    // Contar tópicos por matéria
    const subjectsWithCount = subjects.map((subject) => ({
      id: subject.id,
      name: subject.name,
      description: subject.description,
      color: subject.color,
      icon: subject.icon,
      topicCount: subject.topics.length,
    }));

    return NextResponse.json({ subjects: subjectsWithCount });
  } catch (error) {
    console.error("Error fetching subjects:", error);
    return NextResponse.json(
      { error: "Failed to fetch subjects" },
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
    const { name, description, color, icon } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const subject = await prisma.subject.create({
      data: {
        name,
        description: description || null,
        color: color || null,
        icon: icon || null,
        teacherId: user.id,
      },
    });

    return NextResponse.json({ subject }, { status: 201 });
  } catch (error) {
    console.error("Error creating subject:", error);
    return NextResponse.json(
      { error: "Failed to create subject" },
      { status: 500 },
    );
  }
}
