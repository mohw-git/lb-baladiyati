import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class KycAttachmentDto {
  @ApiProperty() id: string;
  @ApiProperty() docType: string;
  @ApiProperty() mimeType: string;
  @ApiProperty() size: number;
  @ApiProperty() createdAt: Date;
}

export class KycReviewLogDto {
  @ApiProperty() id: string;
  @ApiProperty() action: string;
  @ApiPropertyOptional() reason?: string;
  @ApiProperty() performedBy: { id: string; firstName: string; lastName: string };
  @ApiProperty() createdAt: Date;
}

export class KycSubmissionDto {
  @ApiProperty() id: string;
  @ApiProperty() userId: string;
  @ApiProperty() status: string;
  @ApiProperty() submittedAt: Date;
  @ApiPropertyOptional() reviewedAt?: Date;
  @ApiPropertyOptional() rejectionReason?: string;
  @ApiProperty({ type: [KycAttachmentDto] }) attachments: KycAttachmentDto[];
  @ApiProperty() user: { id: string; firstName: string; lastName: string; email: string };
}

export class KycSubmissionDetailDto extends KycSubmissionDto {
  @ApiProperty({ type: [KycReviewLogDto] }) reviewLogs: KycReviewLogDto[];
}

export class KycStatusDto {
  @ApiProperty() verificationStatus: string;
  @ApiPropertyOptional() submittedAt?: Date;
  @ApiPropertyOptional() reviewedAt?: Date;
  @ApiPropertyOptional() rejectionReason?: string;
  @ApiPropertyOptional() hasActiveSubmission: boolean;
}

export class KycSubmitResponseDto {
  @ApiProperty({ example: true }) success: boolean;
  @ApiProperty({ type: KycSubmissionDto }) data: KycSubmissionDto;
}

export class KycStatusResponseDto {
  @ApiProperty({ example: true }) success: boolean;
  @ApiProperty({ type: KycStatusDto }) data: KycStatusDto;
}

export class KycListResponseDto {
  @ApiProperty({ example: true }) success: boolean;
  @ApiProperty({ type: [KycSubmissionDto] }) data: KycSubmissionDto[];
}

export class KycDetailResponseDto {
  @ApiProperty({ example: true }) success: boolean;
  @ApiProperty({ type: KycSubmissionDetailDto }) data: KycSubmissionDetailDto;
}
