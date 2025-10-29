import { Module } from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { MeetingsController } from './meetings.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { SchedulerService } from 'src/scheduler/scheduler.service';

@Module({
  imports: [PrismaModule],
  controllers: [MeetingsController],
  providers: [MeetingsService,SchedulerService , PrismaService],
})
export class MeetingsModule {}
