
import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  SchedulerService,
  MeetingRequest,
  Booking,
} from '../scheduler/scheduler.service';
import { MeetingRequestDto } from './dto/create-meeting.dto';

@Controller('meetings')
export class MeetingsController {
  constructor(
    private prisma: PrismaService,
    private scheduler: SchedulerService,
  ) {}

  @Post('find-optimal')
  async findOptimal(@Body() body: MeetingRequestDto) {
    // fetch rooms and relevant bookings window (preferred +- flexibility + duration)
    const preferred = new Date(body.preferredStartTime);
    const windowStart = new Date(
      preferred.getTime() -
        Math.max(60, body.flexibility || 0) * 60 * 1000 -
        60 * 60 * 1000,
    ); 
    const windowEnd = new Date(
      preferred.getTime() +
        (Math.max(60, body.flexibility || 0) + body.duration + 60) * 60 * 1000,
    );

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
      startTime:
        b.startTime instanceof Date ? b.startTime.toISOString() : b.startTime,
      endTime: b.endTime instanceof Date ? b.endTime.toISOString() : b.endTime,
    }));

    return this.scheduler.findOptimalMeeting(
      body,
      normalizedBookings as Booking[],
      rooms,
    );
  }

  @Post()
  async createBooking(@Body() payload: any) {
    /**
     * We need to:
     * 1) Re-check availability within a transaction
     * 2) Create booking with status 'tentative'
     * 3) Return booking
     *
     * NOTE: Prisma doesn't support row-level SELECT ... FOR UPDATE across arbitrary sets easily.
     * For production use you may use:
     * - a locking table/row per room (UPDATE lock) or
     * - Redis lock (recommended)
     *
     * Here we do a transactional check->insert to reduce race window.
     */
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
      // check conflicts for this room considering buffer
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

      // capacity & equipment check on room
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
