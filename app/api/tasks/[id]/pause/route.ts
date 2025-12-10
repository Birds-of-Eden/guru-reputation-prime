import { getAuthUser } from '@/lib/getAuthUser';
import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let taskId: string | undefined;
  try {
    const user = await getAuthUser();

    if (!user?.id) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    taskId = (await params).id;

    if (!taskId) {
      return new NextResponse('Task ID is required', { status: 400 });
    }

    const { reason, timestamp } = await request.json();

    if (!reason) {
      return new NextResponse('Pause reason is required', { status: 400 });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { pauseReasons: true },
    });

    if (!task) {
      return new NextResponse('Task not found', { status: 404 });
    }

    let currentPauseReasons: any[] = [];
    try {
      if (task.pauseReasons) {
        currentPauseReasons = Array.isArray(task.pauseReasons)
          ? task.pauseReasons
          : [];
      }

    } catch (error) {
      console.error('Error parsing pauseReasons:', error);
      currentPauseReasons = [];
    }

    const newPauseReason = {
      reason,
      timestamp: timestamp || new Date().toISOString(),
      durationInSeconds: 0,
      pausedBy: user.id
    };

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        pauseReasons: [...currentPauseReasons, newPauseReason] as any,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error('❌ Error pausing task:', {
      error: error instanceof Error ? error.message : error,
      taskId,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
