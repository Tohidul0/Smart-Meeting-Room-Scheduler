import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MeetingRequestDto {
  @ApiProperty({ example: 'john.doe', description: 'Organizer ID or name' })
  @IsString()
  organizer: string;

  @ApiProperty({
    example: ['alice', 'bob'],
    description: 'List of attendees (user IDs or names)',
  })
  @IsArray()
  attendees: string[];

  @ApiProperty({
    example: 60,
    description: 'Duration of the meeting in minutes',
  })
  @IsNumber()
  duration: number;

  @ApiProperty({
    example: ['projector', 'whiteboard'],
    description: 'Equipment required for the meeting',
  })
  @IsArray()
  requiredEquipment: string[];

  @ApiProperty({
    example: '2025-11-02T16:00:00Z',
    description: 'Preferred meeting start time (ISO 8601 format)',
  })
  @IsDateString()
  preferredStartTime: string;

  @ApiProperty({
    example: 30,
    required: false,
    description:
      'Flexibility in minutes (how much earlier or later the start time can shift)',
  })
  @IsOptional()
  @IsNumber()
  flexibility?: number;

  @ApiProperty({
    example: 'normal',
    enum: ['low', 'normal', 'high', 'urgent'],
    description: 'Priority of the meeting request',
  })
  @IsEnum(['low', 'normal', 'high', 'urgent'])
  priority: 'low' | 'normal' | 'high' | 'urgent';
}
