// src/scheduler/scheduler.service.ts
import { Injectable } from '@nestjs/common';
import { MeetingRequestDto } from 'src/meetings/dto/create-meeting.dto';

type Priority = 'low'|'normal'|'high'|'urgent';
export interface MeetingRoom {
  id: string;
  name?: string;
  capacity: number;
  equipment: string[];
  hourlyRate: number;
  location?: string;
}

export interface Booking {
  id?: string;
  roomId?: string;
  startTime: string; // ISO
  endTime: string;   // ISO
  organizerId?: string;
  priority?: Priority;
  status?: 'tentative'|'confirmed'|'cancelled'|'released';
  bufferBefore?: number;
  bufferAfter?: number;
}

export interface MeetingRequest {
  organizer: string;
  attendees: string[];
  duration: number; // minutes
  requiredEquipment: string[];
  preferredStartTime: string; // ISO
  flexibility: number; // minutes
  priority: Priority;
  organizerRole?: 'employee'|'ceo'|'admin';
}

@Injectable()
export class SchedulerService {
  private BUFFER_MINUTES = 15;
  private SEARCH_STEP_MINUTES = 5;
  private MAX_FURTHER_SEARCH_MINUTES = 120;

  private overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
    return aStart < bEnd && bStart < aEnd;
  }

  /**
   * Main algorithm:
   * - checks capacity & equipment
   * - enforces buffers in overlap checks
   * - prioritizes CEO/urgent (decreases score to favor them)
   * - returns recommendedRoom, suggestedTime, alternatives, costOptimization
   */
  public findOptimalMeeting(
    req: MeetingRequestDto,
    existingBookings: Booking[],
    rooms: MeetingRoom[]
  ) {
    const attendeeCount = Math.max(req.attendees.length, 1);
    const preferred = new Date(req.preferredStartTime);
    const durationMs = req.duration * 60 * 1000;

    // candidate times: within flexibility first, then expand
    const candidates: Date[] = [];
    const flex = Math.max(0, req.flexibility || 0);
    for (let offset = -flex; offset <= flex; offset += this.SEARCH_STEP_MINUTES) {
      candidates.push(new Date(preferred.getTime() + offset * 60 * 1000));
    }
    for (let offset = flex + this.SEARCH_STEP_MINUTES; offset <= this.MAX_FURTHER_SEARCH_MINUTES; offset += this.SEARCH_STEP_MINUTES) {
      candidates.push(new Date(preferred.getTime() + offset * 60 * 1000));
      candidates.push(new Date(preferred.getTime() - offset * 60 * 1000));
    }

    // Preprocess bookings by room for speed
    const bookingsByRoom = new Map<string, Booking[]>();
    for (const b of existingBookings) {
      if (!b.roomId) continue;
      if (!bookingsByRoom.has(b.roomId)) bookingsByRoom.set(b.roomId, []);
      bookingsByRoom.get(b.roomId)!.push(b);
    }

    type Candidate = { room: MeetingRoom; start: Date; score: number; shift: number; wasted: number; costPerMin: number };

    const scored: Candidate[] = [];

    for (const start of candidates) {
      const end = new Date(start.getTime() + durationMs);

      for (const room of rooms) {
        // capacity check
        if (room.capacity < attendeeCount) continue;
        // equipment check
        const eqOk = req.requiredEquipment.every(e => room.equipment.includes(e));
        if (!eqOk) continue;

        // check buffers and conflict
        const bufBefore = this.BUFFER_MINUTES;
        const bufAfter = this.BUFFER_MINUTES;
        const windowStart = new Date(start.getTime() - bufBefore * 60 * 1000);
        const windowEnd = new Date(end.getTime() + bufAfter * 60 * 1000);

        const roomBookings = bookingsByRoom.get(room.id) || [];
        let conflict = false;
        for (const b of roomBookings) {
          if (b.status === 'cancelled' || b.status === 'released') continue;
          const bStart = new Date(b.startTime);
          const bEnd = new Date(b.endTime);
          const bWindowStart = new Date(bStart.getTime() - (b.bufferBefore ?? bufBefore) * 60 * 1000);
          const bWindowEnd = new Date(bEnd.getTime() + (b.bufferAfter ?? bufAfter) * 60 * 1000);
          if (this.overlaps(windowStart, windowEnd, bWindowStart, bWindowEnd)) {
            // If incoming is higher priority and existing is lower, mark as "preemptable" (but do not auto-preempt)
            if (this.priorityValue(req.priority) > this.priorityValue(b.priority as Priority || 'normal')) {
              // we may still prefer this room but must return preemptionAdvice
              // For now treat as conflict but annotate later (we collect alternatives)
              conflict = true; // we'll still list alternatives and preemption suggestions separately
              break;
            } else {
              conflict = true;
              break;
            }
          }
        }
        if (conflict) continue;

        const wasted = room.capacity - attendeeCount;
        const costPerMin = room.hourlyRate / 60;
        const shift = Math.abs(start.getTime() - preferred.getTime()) / 60000;

        // scoring formula (lower better). We favor small wasted capacity, low cost, and low shift.
        // give large negative bonus for CEO/urgent to favor them
        const priorityBonus = (req.organizer === 'ceo' ? -100 : 0) + (req.priority === 'urgent' ? -60 : req.priority === 'high' ? -25 : 0);

        const score = wasted * 2 + costPerMin * 10 + shift * 1.5 + priorityBonus;

        scored.push({ room, start, score, shift, wasted, costPerMin });
      }
    }

    // Sort by score ascending
    scored.sort((a, b) => a.score - b.score);

    const recommended = scored[0] ?? null;

    // Build alternatives (distinct room/time combos)
    const alternatives: Array<{ room: MeetingRoom; time: string; note?: string }> = [];
    const seen = new Set<string>();
    for (let i = 0; i < Math.min(30, scored.length) && alternatives.length < 5; i++) {
      const c = scored[i];
      const key = `${c.room.id}-${c.start.toISOString()}`;
      if (recommended && key === `${recommended.room.id}-${recommended.start.toISOString()}`) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      alternatives.push({ room: c.room, time: c.start.toISOString() });
    }

    // Cost optimization vs largest room (naive: compare to largest capacity room's hourly rate)
    let costOptimization = 0;
    if (recommended) {
      const largest = rooms.reduce((p, r) => (r.capacity > p.capacity ? r : p), rooms[0]);
      const recCost = (recommended.room.hourlyRate / 60) * (req.duration);
      const largeCost = (largest.hourlyRate / 60) * (req.duration);
      costOptimization = parseFloat((largeCost - recCost).toFixed(2));
    }

    return {
      recommendedRoom: recommended ? recommended.room : null,
      suggestedTime: recommended ? recommended.start.toISOString() : null,
      alternativeOptions: alternatives,
      costOptimization,
      // extra metadata for UI/demo
      debug: {
        scoredCount: scored.length,
        topScores: scored.slice(0, 5).map(s => ({ roomId: s.room.id, score: s.score, start: s.start.toISOString() })),
      }
    };
  }

  private priorityValue(p?: Priority) {
    if (!p) return 0;
    switch (p) {
      case 'low': return 1;
      case 'normal': return 2;
      case 'high': return 3;
      case 'urgent': return 4;
    }
  }
}
