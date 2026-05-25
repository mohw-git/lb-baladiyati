import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { HelpRequestStatus } from '@prisma/client';
import { PaginationDto } from '../../../core/common/dto/pagination.dto';

export class HelpAttachmentDto {
  @ApiProperty()
  @IsUrl({ require_tld: false })
  url!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  filename!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  mime!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  size?: number;
}

export class CreateHelpRequestDto {
  @ApiProperty({ description: 'Department being asked for help' })
  @IsUUID()
  toDepartmentId!: string;

  @ApiProperty({
    description:
      'Why the original team needs help from another department. Visible to both sides.',
    minLength: 5,
    maxLength: 1000,
  })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string;
}

export class RespondHelpRequestDto {
  @ApiPropertyOptional({
    description: 'Free-text note shown to the requester (e.g. why declined).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class AssignHelpRequestDto {
  @ApiProperty({
    description:
      'User in the helper department who will do the work. Must belong to the helper department.',
  })
  @IsUUID()
  helperAssigneeId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class SubmitHelpRequestDto {
  @ApiProperty({
    description: 'What was done (visible to both teams).',
    minLength: 5,
    maxLength: 2000,
  })
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  notes!: string;

  @ApiPropertyOptional({
    type: [HelpAttachmentDto],
    description: 'Proof photos / files (already uploaded; pass URLs).',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => HelpAttachmentDto)
  attachments?: HelpAttachmentDto[];
}

export class CloseHelpRequestDto {
  @ApiPropertyOptional({
    description: 'Reason for approving / rejecting helper work',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class HelpRequestQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: HelpRequestStatus })
  @IsOptional()
  @IsEnum(HelpRequestStatus)
  status?: HelpRequestStatus;

  @ApiPropertyOptional({
    description: 'Inbox view: requests sent TO my department (helper side)',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  inbox?: boolean;

  @ApiPropertyOptional({
    description: 'Outgoing view: requests I (or my department) raised',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  outgoing?: boolean;

  @ApiPropertyOptional({
    description:
      'With outgoing=true: only requests awaiting source Supervisor/HOD approval',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  sourceApproval?: boolean;

  @ApiPropertyOptional({
    description: 'Filter to a specific complaint',
  })
  @IsOptional()
  @IsUUID()
  complaintId?: string;

  /**
   * Workflow queue for the Help Requests hub. Prefer this over legacy
   * inbox/outgoing booleans when building tabbed UIs.
   */
  @ApiPropertyOptional({
    enum: [
      'sourceApproval',
      'incoming',
      'needsAssignment',
      'inProgress',
      'awaitingSourceReview',
      'myAssignments',
      'history',
    ],
  })
  @IsOptional()
  @IsString()
  queue?:
    | 'sourceApproval'
    | 'incoming'
    | 'needsAssignment'
    | 'inProgress'
    | 'awaitingSourceReview'
    | 'myAssignments'
    | 'history';
}
