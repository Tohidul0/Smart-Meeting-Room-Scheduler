import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { MeetingsModule } from './meetings/meetings.module';

@Module({
  imports: [PrismaModule, SchedulerModule, MeetingsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
