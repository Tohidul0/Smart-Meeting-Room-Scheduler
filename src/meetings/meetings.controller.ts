import { Body, Controller, Post } from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { SchedulerService } from '../scheduler/scheduler.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('meetings')
export class MeetingsController {
  constructor(
    private meetingsService: MeetingsService,
    private schedulerService: SchedulerService,
    private prisma: PrismaService
  ) {}

  @Post('find-optimal')
  async findOptimal(@Body() body: any) {
    const rooms = await this.prisma.meetingRoom.findMany();
    const from = new Date(body.preferredStartTime);
    const to = new Date(from.getTime() + (body.flexibility + body.duration) * 60 * 1000);
    const bookings = await this.meetingsService.getBookingsInWindow(from, to);

    return this.schedulerService.findOptimalMeeting(body, bookings, rooms);
  }

  @Post()
  async create(@Body() body: any) {
    return this.meetingsService.createBooking(body);
  }
}
