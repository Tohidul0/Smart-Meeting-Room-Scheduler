import { PartialType } from '@nestjs/mapped-types';
import { MeetingRequestDto } from './create-meeting.dto';


export class UpdateMeetingDto extends PartialType(MeetingRequestDto) {}
