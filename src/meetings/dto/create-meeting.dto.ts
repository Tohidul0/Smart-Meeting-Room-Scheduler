export class MeetingRequestDto {
  organizer: string;
  attendees: string[];
  duration: number; // in minutes
  requiredEquipment: string[];
  preferredStartTime: Date;
  flexibility: number;
  priority: 'low' | 'normal' | 'high' | 'urgent';
}
