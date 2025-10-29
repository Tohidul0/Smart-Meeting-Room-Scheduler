import { Injectable } from '@nestjs/common';
import { MeetingRequestDto } from 'src/meetings/dto/create-meeting.dto';


@Injectable()
export class SchedulerService {
  findOptimalMeeting(request: MeetingRequestDto, existingBookings: any[], availableRooms: any[]) {
    // Step 1: Filter rooms that meet capacity and equipment requirements
    const matchingRooms = availableRooms.filter(
      (room) =>
        room.capacity >= request.attendees.length &&
        request.requiredEquipment.every((eq) => room.equipment.includes(eq)),
    );

    if (matchingRooms.length === 0) {
      return { message: 'No rooms meet the requirements.' };
    }

    // Step 2: Sort rooms by cost
    const sortedRooms = matchingRooms.sort((a, b) => a.hourlyRate - b.hourlyRate);

    // Step 3: Find a time slot that doesn’t conflict
    const preferredStart = new Date(request.preferredStartTime);
    const preferredEnd = new Date(preferredStart.getTime() + request.duration * 60000);

    const isAvailable = (room) =>
      !existingBookings.some(
        (b) =>
          b.roomId === room.id &&
          ((preferredStart >= b.startTime && preferredStart < b.endTime) ||
            (preferredEnd > b.startTime && preferredEnd <= b.endTime)),
      );

    const availableRoom = sortedRooms.find(isAvailable);

    if (!availableRoom) {
      return { message: 'No available room at the requested time.' };
    }

    // Step 4: Calculate cost optimization
    const mostExpensive = Math.max(...availableRooms.map((r) => r.hourlyRate));
    const costOptimization = mostExpensive - availableRoom.hourlyRate;

    return {
      recommendedRoom: availableRoom,
      suggestedTime: preferredStart,
      alternativeOptions: sortedRooms
        .filter((r) => r.id !== availableRoom.id)
        .map((r) => ({ room: r, time: preferredStart })),
      costOptimization,
    };
  }
}
