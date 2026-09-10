import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/app/api/auth/[...nextauth]/route";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; optionId: string }> },
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

    const { optionId } = await params;
    const body = await request.json();
    const { content, isCorrect, order, explanation } = body;

    // Verify option exists
    const existingOption = await prisma.questionOption.findUnique({
      where: { id: optionId },
    });

    if (!existingOption) {
      return NextResponse.json({ error: "Option not found" }, { status: 404 });
    }

    const updateData: {
      content?: string;
      isCorrect?: boolean;
      order?: number;
      explanation?: string;
    } = {};
    if (content !== undefined) updateData.content = content;
    if (isCorrect !== undefined) updateData.isCorrect = isCorrect;
    if (order !== undefined) updateData.order = order;
    if (explanation !== undefined) updateData.explanation = explanation;

    const option = await prisma.questionOption.update({
      where: { id: optionId },
      data: updateData,
    });

    return NextResponse.json({ option });
  } catch (error) {
    console.error("Error updating option:", error);
    return NextResponse.json(
      { error: "Failed to update option" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; optionId: string }> },
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

    const { optionId } = await params;

    // Verify option exists
    const existingOption = await prisma.questionOption.findUnique({
      where: { id: optionId },
    });

    if (!existingOption) {
      return NextResponse.json({ error: "Option not found" }, { status: 404 });
    }

    await prisma.questionOption.delete({
      where: { id: optionId },
    });

    return NextResponse.json({ message: "Option deleted successfully" });
  } catch (error) {
    console.error("Error deleting option:", error);
    return NextResponse.json(
      { error: "Failed to delete option" },
      { status: 500 },
    );
  }
}
