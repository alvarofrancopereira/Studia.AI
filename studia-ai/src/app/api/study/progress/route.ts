import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/study/progress
 * Get study progress and statistics for the authenticated student
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      );
    }

    const studentId = session.user.id;
    const { searchParams } = new URL(request.url);
    const topicId = searchParams.get('topicId');

    // Get overall statistics
    const [attemptStats, masteryRecords] = await Promise.all([
      // Attempt statistics
      prisma.studyAttempt.groupBy({
        by: ['status'],
        where: { studentId },
        _count: true,
        _avg: {
          score: true,
        },
      }),
      // Mastery records for all topics studied
      prisma.userTopicMastery.findMany({
        where: { userId: studentId },
        include: {
          topic: {
            include: {
              subject: true,
            },
          },
        },
        orderBy: { lastStudied: 'desc' },
      }),
    ]);

    // Get recent attempts
    const recentAttempts = await prisma.studyAttempt.findMany({
      where: { studentId },
      take: 10,
      include: {
        topic: {
          include: {
            subject: true,
          },
        },
      },
      orderBy: { startedAt: 'desc' },
    });

    // Format statistics
    const stats = {
      totalAttempts: attemptStats.reduce((sum, s) => sum + s._count, 0),
      inProgress: attemptStats.find((s) => s.status === 'IN_PROGRESS')?._count || 0,
      completed: attemptStats.find((s) => s.status === 'COMPLETED')?._count || 0,
      abandoned: attemptStats.find((s) => s.status === 'ABANDONED')?._count || 0,
      averageScore: attemptStats.find((s) => s.status === 'COMPLETED')?._avg.score || 0,
      topicsStudied: masteryRecords.length,
    };

    // If topicId is provided, get detailed progress for that topic
    let topicProgress = null;
    if (topicId) {
      const topicAttempts = await prisma.studyAttempt.findMany({
        where: {
          studentId,
          topicId,
        },
        include: {
          answers: {
            select: {
              isCorrect: true,
              points: true,
            },
          },
        },
        orderBy: { startedAt: 'desc' },
      });

      const completedAttempts = topicAttempts.filter((a) => a.status === 'COMPLETED');
      
      topicProgress = {
        topicId,
        totalAttempts: topicAttempts.length,
        completedAttempts: completedAttempts.length,
        bestScore: completedAttempts.length > 0 
          ? Math.max(...completedAttempts.map((a) => a.score || 0)) 
          : 0,
        averageScore: completedAttempts.length > 0
          ? completedAttempts.reduce((sum, a) => sum + (a.score || 0), 0) / completedAttempts.length
          : 0,
        lastAttemptDate: topicAttempts[0]?.startedAt || null,
      };
    }

    return NextResponse.json({
      stats,
      recentAttempts: recentAttempts.map((attempt) => ({
        id: attempt.id,
        topic: attempt.topic,
        startedAt: attempt.startedAt,
        completedAt: attempt.completedAt,
        score: attempt.score,
        status: attempt.status,
      })),
      masteryRecords: masteryRecords.map((record) => ({
        topic: record.topic,
        masteryLevel: record.masteryLevel,
        accuracy: record.accuracy,
        reviewCount: record.reviewCount,
        correctCount: record.correctCount,
        lastStudied: record.lastStudied,
      })),
      topicProgress,
    });
  } catch (error) {
    console.error('Error fetching study progress:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
