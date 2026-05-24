import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TransferStatus, TransferTargetType } from '@prisma/client';
import { PaginationDto } from '../../../core/common/dto/pagination.dto';

export class CreateTransferRequestDto {
  @ApiProperty({ enum: TransferTargetType })
  @IsEnum(TransferTargetType)
  targetType!: TransferTargetType;

  @ApiProperty({ description: 'UUID of the complaint or task being transferred' })
  @IsUUID()
  targetId!: string;

  @ApiProperty({ description: 'UUID of the receiving department' })
  @IsUUID()
  toDepartmentId!: string;

  @ApiProperty({
    description: 'Why the work belongs in the other department',
    minLength: 5,
    maxLength: 1000,
  })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string;
}

export class AcceptTransferRequestDto {
  @ApiProperty({
    description:
      'User in the receiving department who will own the work. Must belong to the receiving department.',
  })
  @IsUUID()
  newAssigneeId!: string;

  @ApiPropertyOptional({ description: 'Optional internal note' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class RejectTransferRequestDto {
  @ApiProperty({ description: 'Why the receiving HOD is refusing the work' })
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reason!: string;
}

export class TransferQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: TransferStatus })
  @IsOptional()
  @IsEnum(TransferStatus)
  status?: TransferStatus;

  @ApiPropertyOptional({ description: 'Inbox view: requests sent TO my department' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  inbox?: boolean;

  @ApiPropertyOptional({ description: 'Outgoing view: requests I (or my department) sent' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  outgoing?: boolean;

  @ApiPropertyOptional({ enum: TransferTargetType })
  @IsOptional()
  @IsEnum(TransferTargetType)
  targetType?: TransferTargetType;
}
