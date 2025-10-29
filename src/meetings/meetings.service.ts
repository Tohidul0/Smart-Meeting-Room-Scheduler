import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MeetingsService {
  constructor(private prisma: PrismaService) {}

  async getBookingsInWindow(from: Date, to: Date) {
    return this.prisma.booking.findMany({
      where: {
        startTime: { gte: from },
        endTime: { lte: to },
        status: { notIn: ['cancelled', 'released'] },
      },
    });
  }

  async createBooking(data: any) {
    return this.prisma.booking.create({ data });
  }
}
