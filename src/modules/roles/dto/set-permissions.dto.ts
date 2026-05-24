import { IsArray, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetPermissionsDto {
  @ApiProperty({ type: [String], description: 'Array of permission UUIDs to assign' })
  @IsArray()
  @IsUUID('4', { each: true })
  permissionIds: string[];
}
