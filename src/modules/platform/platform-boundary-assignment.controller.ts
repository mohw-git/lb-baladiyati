import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { SuperAdminGuard } from './super-admin.guard';
import { RequirePermissions } from '../../core/rbac/require-permissions.decorator';
import { PERMISSIONS } from '../../core/rbac/permissions.constants';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { CurrentUserData } from '../../core/auth/types/jwt-payload';
import { BoundaryAssignmentService } from './boundary-assignment.service';
import { BoundarySourceImportService } from './boundary-source-import.service';
import {
  BulkBoundarySourceFeaturesDto,
  CreateBoundarySourceImportDto,
  UpdateBoundaryAssignmentsDto,
  UpdateMunicipalityBoundaryColorDto,
} from './dto/boundary-source.dto';

@ApiTags('Platform (Super Admin)')
@ApiBearerAuth('JWT-auth')
@UseGuards(SuperAdminGuard)
@Controller('platform')
export class PlatformBoundaryAssignmentController {
  constructor(
    private readonly assignmentService: BoundaryAssignmentService,
    private readonly importService: BoundarySourceImportService,
  ) {}

  @Get('boundary-assignment/workspace')
  @RequirePermissions(PERMISSIONS.PLATFORM_MANAGE_MUNICIPALITIES)
  @ApiOperation({ summary: 'Boundary assignment workspace (active import, assignments, stats)' })
  getWorkspace() {
    return this.assignmentService.getWorkspace();
  }

  @Get('boundary-source-imports/active')
  @RequirePermissions(PERMISSIONS.PLATFORM_MANAGE_MUNICIPALITIES)
  @ApiOperation({ summary: 'Active Admin3 source import metadata' })
  async getActiveImport() {
    return this.importService.getActiveImport();
  }

  @Get('boundary-source-imports/active/features')
  @RequirePermissions(PERMISSIONS.PLATFORM_MANAGE_MUNICIPALITIES)
  @ApiOperation({ summary: 'All features for the active Admin3 import as GeoJSON' })
  getActiveFeatures() {
    return this.importService.getActiveFeatureCollection();
  }

  @Post('boundary-source-imports/import-default')
  @SkipThrottle()
  @RequirePermissions(PERMISSIONS.PLATFORM_MANAGE_MUNICIPALITIES)
  @ApiOperation({
    summary: 'Import the bundled default Admin3 source from disk (server-side, no upload)',
  })
  importDefaultSource(
    @Query('replace') replace: string | undefined,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.importService.importDefaultSource(user.id, {
      replace: replace === 'true',
    });
  }

  @Post('boundary-source-imports')
  @RequirePermissions(PERMISSIONS.PLATFORM_MANAGE_MUNICIPALITIES)
  @ApiOperation({ summary: 'Start a new Admin3 source import (IMPORTING status)' })
  createImport(
    @Body() dto: CreateBoundarySourceImportDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.importService.createImport(dto, user.id);
  }

  @Post('boundary-source-imports/:id/features')
  @RequirePermissions(PERMISSIONS.PLATFORM_MANAGE_MUNICIPALITIES)
  @ApiOperation({ summary: 'Upload features in chunks for an import' })
  addFeatures(@Param('id') id: string, @Body() dto: BulkBoundarySourceFeaturesDto) {
    return this.importService.addFeatures(id, dto);
  }

  @Post('boundary-source-imports/:id/activate')
  @RequirePermissions(PERMISSIONS.PLATFORM_MANAGE_MUNICIPALITIES)
  @ApiOperation({ summary: 'Activate import and archive previous ACTIVE import' })
  activateImport(@Param('id') id: string) {
    return this.importService.activateImport(id);
  }

  @Delete('boundary-source-imports/:id')
  @RequirePermissions(PERMISSIONS.PLATFORM_MANAGE_MUNICIPALITIES)
  @ApiOperation({ summary: 'Cancel and delete an incomplete IMPORTING source import' })
  cancelImport(@Param('id') id: string) {
    return this.importService.cancelImport(id);
  }

  @Put('boundary-assignments')
  @RequirePermissions(PERMISSIONS.PLATFORM_MANAGE_MUNICIPALITIES)
  @ApiOperation({ summary: 'Assign or unassign Admin3 features to a municipality' })
  updateAssignments(
    @Body() dto: UpdateBoundaryAssignmentsDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.assignmentService.updateAssignments(dto, user.id);
  }

  @Delete('boundary-assignments/municipality/:id')
  @RequirePermissions(PERMISSIONS.PLATFORM_MANAGE_MUNICIPALITIES)
  @ApiOperation({ summary: 'Revoke all active assignments for a municipality' })
  clearMunicipalityAssignments(
    @Param('id') id: string,
    @Query('confirmed') confirmed?: string,
    @CurrentUser() user?: CurrentUserData,
  ) {
    return this.assignmentService.clearMunicipalityAssignments(
      id,
      user!.id,
      confirmed === 'true',
    );
  }

  @Post('municipalities/:id/boundary/regenerate-from-source')
  @RequirePermissions(PERMISSIONS.PLATFORM_MANAGE_MUNICIPALITIES)
  @ApiOperation({ summary: 'Merge assigned Admin3 features into municipality boundary' })
  regenerateFromSource(
    @Param('id') id: string,
    @Query('confirmOverlap') confirmOverlap?: string,
    @Query('switchToSourceBased') switchToSourceBased?: string,
    @CurrentUser() user?: CurrentUserData,
  ) {
    return this.assignmentService.regenerateFromSource(id, user!.id, {
      confirmOverlap: confirmOverlap === 'true',
      switchToSourceBased: switchToSourceBased === 'true',
    });
  }

  @Patch('municipalities/:id/boundary-color')
  @RequirePermissions(PERMISSIONS.PLATFORM_MANAGE_MUNICIPALITIES)
  @ApiOperation({ summary: 'Set municipality map color for boundary assignment' })
  updateBoundaryColor(@Param('id') id: string, @Body() dto: UpdateMunicipalityBoundaryColorDto) {
    return this.assignmentService.updateBoundaryColor(id, dto.boundaryColor);
  }
}
