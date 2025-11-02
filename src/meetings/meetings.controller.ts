import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import {
  SchedulerService,
  MeetingRequest,
  Booking,
} from '../scheduler/scheduler.service';
import { MeetingRequestDto } from './dto/create-meeting.dto';

@ApiTags('Meetings')
@Controller('meetings')
export class MeetingsController {
  constructor(
    private prisma: PrismaService,
    private scheduler: SchedulerService,
  ) {}

  @Post('find-optimal')
  @ApiOperation({
    summary: 'Find the optimal meeting room and time slot',
    description:
      'Analyzes all available meeting rooms and existing bookings to recommend the best fit based on capacity, equipment, cost, and priority.',
  })
  @ApiBody({ type: MeetingRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Optimal meeting recommendation found successfully.',
  })
  @ApiResponse({ status: 400, description: 'Invalid input data.' })
  @ApiResponse({ status: 404, description: 'No suitable meeting room found.' })
  async findOptimal(@Body() body: MeetingRequestDto) {
    if (!body.preferredStartTime) {
      throw new HttpException(
        'preferredStartTime is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const preferred = new Date(body.preferredStartTime);
    if (isNaN(preferred.getTime())) {
      throw new HttpException(
        'Invalid preferredStartTime format. Must be ISO string (e.g. 2025-11-02T15:00:00Z)',
        HttpStatus.BAD_REQUEST,
      );
    }

    const flexibility = Math.max(60, body.flexibility || 0);
    const windowStart = new Date(preferred.getTime() - (flexibility + 60) * 60 * 1000);
    const windowEnd = new Date(preferred.getTime() + (flexibility + body.duration + 60) * 60 * 1000);

    const rooms = await this.prisma.meetingRoom.findMany();
    const bookings = await this.prisma.booking.findMany({
      where: {
        startTime: { lte: windowEnd },
        endTime: { gte: windowStart },
        status: { notIn: ['cancelled', 'released'] },
      },
    });

    const normalizedBookings = bookings.map((b) => ({
      ...b,
      startTime: b.startTime instanceof Date ? b.startTime.toISOString() : b.startTime,
      endTime: b.endTime instanceof Date ? b.endTime.toISOString() : b.endTime,
    }));

    return this.scheduler.findOptimalMeeting(
      body as unknown as MeetingRequest,
      normalizedBookings as Booking[],
      rooms,
    );
  }

  @Post()
  @ApiOperation({
    summary: 'Create a new meeting booking',
    description:
      'Creates a tentative meeting booking after validating conflicts, capacity, and equipment requirements.',
  })
  @ApiBody({
    schema: {
      example: {
        roomId: '53c00fc0-552d-4a19-b9c1-c0fed1e43604',
        startTime: '2025-11-02T16:00:00Z',
        endTime: '2025-11-02T17:00:00Z',
        duration: 60,
        attendees: ['alice', 'bob'],
        requiredEquip: ['projector'],
        organizer: 'd09eb116-c6a0-4b0f-b6f6-5d8b93e5d7cb',
        priority: 'high',
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Meeting booked successfully.' })
  @ApiResponse({
    status: 409,
    description: 'Room not available for requested time (conflict).',
  })
  async createBooking(@Body() payload: any) {
    const {
      roomId,
      startTime,
      endTime,
      duration,
      attendees,
      requiredEquip,
      organizer,
      priority,
    } = payload;

    const start = new Date(startTime);
    const end = new Date(endTime);
    const buf = 15 * 60 * 1000;

    return await this.prisma.$transaction(async (tx) => {
      const conflict = await tx.booking.findFirst({
        where: {
          roomId,
          NOT: { status: 'cancelled' },
          AND: [
            { startTime: { lt: new Date(end.getTime() + buf) } },
            { endTime: { gt: new Date(start.getTime() - buf) } },
          ],
        },
      });

      if (conflict) {
        throw new HttpException(
          'Room not available for requested time (buffer conflict)',
          HttpStatus.CONFLICT,
        );
      }

      const room = await tx.meetingRoom.findUnique({ where: { id: roomId } });
      if (!room)
        throw new HttpException('Room not found', HttpStatus.NOT_FOUND);
      if (room.capacity < (attendees?.length ?? 1)) {
        throw new HttpException('Room over-capacity', HttpStatus.BAD_REQUEST);
      }
      const hasAllEq = (requiredEquip || []).every((e: string) =>
        room.equipment.includes(e),
      );
      if (!hasAllEq)
        throw new HttpException(
          'Room missing required equipment',
          HttpStatus.BAD_REQUEST,
        );

      const created = await tx.booking.create({
        data: {
          organizerId: organizer,
          roomId,
          startTime: start,
          endTime: end,
          duration,
          attendees,
          requiredEquip,
          priority,
          status: 'tentative',
          bufferBefore: 15,
          bufferAfter: 15,
        },
      });

      return created;
    });
  }
}
