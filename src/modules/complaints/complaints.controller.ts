import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  Res,
  Header,
  UseInterceptors,
  UploadedFiles,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { FilesInterceptor } from '@nestjs/platform-express';
import { toCsv } from '../../core/common/utils/csv';
import { SkipTransform } from '../../core/common/interceptors/transform-response.interceptor';
import {
  ApiTags,
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { ComplaintsService } from './complaints.service';
import { AssignmentsService } from './assignments.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { ComplaintQueryDto } from './dto/complaint-query.dto';
import { AssignComplaintDto } from './dto/assign-complaint.dto';
import { ChangeStatusDto } from './dto/change-status.dto';
import { UploadAttachmentDto } from './dto/upload-attachment.dto';
import { SetPriorityDto } from './dto/set-priority.dto';
import { RejectComplaintDto } from './dto/reject-complaint.dto';
import { SubmitFeedbackDto } from './dto/submit-feedback.dto';
import {
  ComplaintsListResponseDto,
  ComplaintResponseDto,
  ComplaintCreatedResponseDto,
  AssignmentResponseDto,
  StatusChangeResponseDto,
  DeleteResponseDto,
} from './dto/complaint-response.dto';
import { ApiErrorResponseDto } from '../../core/common/dto/api-response.dto';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { CurrentUserData } from '../../core/auth/types/jwt-payload';
import { RequirePermissions } from '../../core/rbac/require-permissions.decorator';
import { PERMISSIONS } from '../../core/rbac/permissions.constants';
import { multerConfig } from '../../core/storage/multer.config';

@ApiTags('Complaints')
@ApiBearerAuth('JWT-auth')
@Controller('complaints')
export class ComplaintsController {
  constructor(
    private readonly complaintsService: ComplaintsService,
    private readonly assignmentsService: AssignmentsService,
  ) {}

  /**
   * List complaints (filtered by user permissions)
   */
  @Get()
  @ApiOperation({
    summary: 'List complaints',
    description: 'Returns paginated list of complaints. Results are filtered based on user permissions (own, assigned, or all)',
  })
  @ApiOkResponse({
    description: 'Paginated list of complaints',
    type: ComplaintsListResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ApiErrorResponseDto })
  @RequirePermissions(
    PERMISSIONS.COMPLAINT_VIEW_OWN,
    PERMISSIONS.COMPLAINT_VIEW_ALL,
    PERMISSIONS.COMPLAINT_VIEW_ASSIGNED,
    PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT,
  )
  async findAll(
    @CurrentUser() user: CurrentUserData,
    @Query() query: ComplaintQueryDto,
  ) {
    return this.complaintsService.findAll(
      user.id,
      user.municipalityId,
      query,
    );
  }

  /**
   * Get complaint statistics (role-based)
   * NOTE: This must be defined before :id route to avoid path collision
   */
  @Get('stats/summary')
  @ApiOperation({
    summary: 'Get complaint statistics',
    description: 'Returns complaint statistics filtered by user role/department.',
  })
  @ApiOkResponse({
    description: 'Statistics retrieved successfully',
    schema: {
      example: {
        success: true,
        data: {
          total: 150,
          byStatus: {
            SUBMITTED: 20,
            UNDER_REVIEW: 15,
            ASSIGNED: 30,
            IN_PROGRESS: 40,
            PENDING_APPROVAL: 10,
            COMPLETED: 25,
            REJECTED: 5,
            CLOSED: 5,
          },
          byPriority: {
            LOW: 30,
            MEDIUM: 70,
            HIGH: 40,
            URGENT: 10,
          },
          overdue: 8,
        },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  @RequirePermissions(
    PERMISSIONS.COMPLAINT_VIEW_OWN,
    PERMISSIONS.COMPLAINT_VIEW_ALL,
    PERMISSIONS.COMPLAINT_VIEW_ASSIGNED,
    PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT,
  )
  async getStats(@CurrentUser() user: CurrentUserData) {
    return this.complaintsService.getStats(user.id, user.municipalityId);
  }

  /**
   * Bucket counts for the staff "Inbox" UX. Returns:
   *  - needsAttention: unassigned open complaints in the user's scope
   *  - assignedToMe:   complaints actively assigned to the caller
   *  - myDepartment:   everything in the caller's department
   *  - all:            everything in the municipality (admins only)
   *  - overdue:        overdue open complaints in the caller's scope
   *  - myReports:      complaints the caller created (citizens)
   */
  @Get('stats/buckets')
  @ApiOperation({
    summary: 'Bucket counts for the staff "what should I work on?" inbox',
  })
  @RequirePermissions(
    PERMISSIONS.COMPLAINT_VIEW_OWN,
    PERMISSIONS.COMPLAINT_VIEW_ALL,
    PERMISSIONS.COMPLAINT_VIEW_ASSIGNED,
    PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT,
  )
  async getBuckets(@CurrentUser() user: CurrentUserData) {
    return this.complaintsService.getBuckets(user.id, user.municipalityId);
  }

  @Get('stats/department-workload')
  @ApiOperation({
    summary: 'Active complaint workload per department (dashboard)',
  })
  @RequirePermissions(
    PERMISSIONS.COMPLAINT_VIEW_ALL,
    PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT,
  )
  async getDepartmentWorkload(@CurrentUser() user: CurrentUserData) {
    return this.complaintsService.getDepartmentWorkload(user.municipalityId);
  }

  /**
   * Dashboard charts data (complaints over time, by category, by priority)
   */
  @Get('stats/charts')
  @ApiOperation({
    summary: 'Get dashboard chart data',
    description: 'Returns time-series and breakdown data for dashboard charts.',
  })
  @RequirePermissions(
    PERMISSIONS.COMPLAINT_VIEW_OWN,
    PERMISSIONS.COMPLAINT_VIEW_ALL,
    PERMISSIONS.COMPLAINT_VIEW_ASSIGNED,
    PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT,
  )
  async getCharts(@CurrentUser() user: CurrentUserData) {
    return this.complaintsService.getDashboardCharts(user.id, user.municipalityId);
  }

  /**
   * Export complaints as CSV. Filters are identical to GET /complaints
   * (so the user only exports what they’re already allowed to see) but
   * pagination is replaced with a hard cap to protect the server.
   */
  @Get('export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @SkipTransform()
  @ApiOperation({
    summary: 'Export complaints as CSV',
    description:
      'Returns up to 50,000 rows matching the same filters as GET /complaints, scoped by the caller’s permissions.',
  })
  @RequirePermissions(
    PERMISSIONS.COMPLAINT_VIEW_OWN,
    PERMISSIONS.COMPLAINT_VIEW_ALL,
    PERMISSIONS.COMPLAINT_VIEW_ASSIGNED,
    PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT,
  )
  async exportCsv(
    @CurrentUser() user: CurrentUserData,
    @Query() query: ComplaintQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const rows = await this.complaintsService.exportAll(
      user.id,
      user.municipalityId,
      query,
    );
    const filename = `complaints-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return toCsv(
      [
        'referenceCode',
        'title',
        'status',
        'priority',
        'category',
        'department',
        'dueDate',
        'isOverdue',
        'createdAt',
      ],
      rows,
    );
  }

  /**
   * Get complaint details with full history
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get complaint details',
    description: 'Returns full complaint details including attachments, status history, and current assignment',
  })
  @ApiOkResponse({
    description: 'Complaint details',
    type: ComplaintResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Complaint not found', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ApiErrorResponseDto })
  @RequirePermissions(
    PERMISSIONS.COMPLAINT_VIEW_OWN,
    PERMISSIONS.COMPLAINT_VIEW_ALL,
    PERMISSIONS.COMPLAINT_VIEW_ASSIGNED,
    PERMISSIONS.COMPLAINT_VIEW_DEPARTMENT,
  )
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.complaintsService.findOne(id, user.id, user.municipalityId);
  }

  /**
   * Create a new complaint
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new complaint',
    description: 'Creates a new complaint with optional file attachments (up to 5 files)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiCreatedResponse({
    description: 'Complaint created successfully',
    type: ComplaintCreatedResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Validation error', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  @RequirePermissions(PERMISSIONS.COMPLAINT_CREATE)
  @UseInterceptors(FilesInterceptor('attachments', 5, multerConfig))
  async create(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateComplaintDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.complaintsService.create(
      user.id,
      user.municipalityId,
      dto,
      files,
    );
  }

  /**
   * List staff members eligible to be assigned to this complaint, with each
   * candidate's current active workload — used by the Assign modal to enable
   * informed manual load balancing.
   */
  @Get(':id/assignable-users')
  @ApiOperation({
    summary: 'List candidates eligible for assignment to a complaint, with workload',
  })
  @RequirePermissions(PERMISSIONS.COMPLAINT_ASSIGN)
  async listAssignableUsers(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.assignmentsService.listAssignableUsers(
      id,
      user.id,
      user.municipalityId,
    );
  }

  /**
   * Assign complaint to a worker
   */
  @Post(':id/assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Assign complaint to a worker',
    description: 'Assigns a complaint to a specific user (worker/staff) and changes status to ASSIGNED',
  })
  @ApiOkResponse({
    description: 'Complaint assigned successfully',
    type: AssignmentResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Complaint or user not found', type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid assignment', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ApiErrorResponseDto })
  @RequirePermissions(PERMISSIONS.COMPLAINT_ASSIGN)
  async assign(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: AssignComplaintDto,
  ) {
    return this.assignmentsService.assignComplaint(
      id,
      dto.assignedToId,
      user.id,
      user.municipalityId,
      dto.notes,
    );
  }

  /**
   * Change complaint status
   */
  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change complaint status',
    description: 'Changes complaint status. Some transitions require proof attachments (e.g., COMPLETED requires proof photos)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiOkResponse({
    description: 'Status changed successfully',
    type: StatusChangeResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Complaint not found', type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid status transition', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ApiErrorResponseDto })
  @RequirePermissions(PERMISSIONS.COMPLAINT_CHANGE_STATUS)
  @UseInterceptors(FilesInterceptor('attachments', 5, multerConfig))
  async changeStatus(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: ChangeStatusDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.complaintsService.changeStatus(
      id,
      user.id,
      user.municipalityId,
      dto,
      files,
    );
  }

  /**
   * Upload additional attachments
   */
  @Post(':id/attachments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Upload attachments',
    description: 'Upload additional attachments to an existing complaint (up to 5 files per request)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiCreatedResponse({
    description: 'Attachments uploaded successfully',
    schema: {
      example: {
        success: true,
        data: {
          message: 'Attachments uploaded successfully',
          count: 3,
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Complaint not found', type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid file type or size', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ApiErrorResponseDto })
  @RequirePermissions(PERMISSIONS.COMPLAINT_UPLOAD_ATTACHMENT)
  @UseInterceptors(FilesInterceptor('attachments', 5, multerConfig))
  async addAttachments(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: UploadAttachmentDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.complaintsService.addAttachments(
      id,
      user.id,
      user.municipalityId,
      dto.stage,
      files,
    );
  }

  /**
   * Set complaint priority and SLA (HOD/Supervisor only)
   */
  @Patch(':id/priority')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Set complaint priority',
    description: 'Sets priority level and SLA deadline for a complaint. Only HOD/Supervisors can set priority.',
  })
  @ApiOkResponse({
    description: 'Priority set successfully',
    schema: {
      example: {
        success: true,
        data: {
          id: 'uuid',
          priority: 'HIGH',
          dueDate: '2026-02-12T18:00:00Z',
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Complaint not found', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ApiErrorResponseDto })
  @RequirePermissions(PERMISSIONS.COMPLAINT_SET_PRIORITY)
  async setPriority(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: SetPriorityDto,
  ) {
    return this.complaintsService.setPriority(
      id,
      user.id,
      user.municipalityId,
      dto.priority,
      dto.dueDate ? new Date(dto.dueDate) : undefined,
    );
  }

  /**
   * Reject a complaint with reason
   */
  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject complaint',
    description: 'Rejects a complaint with a specific reason. Only HOD/Supervisors can reject complaints.',
  })
  @ApiOkResponse({
    description: 'Complaint rejected successfully',
    schema: {
      example: {
        success: true,
        data: {
          id: 'uuid',
          status: 'REJECTED',
          rejectionReason: 'DUPLICATE',
          rejectionNotes: 'This duplicates ticket #BEI-240211-001234',
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Complaint not found', type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid status transition', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ApiErrorResponseDto })
  @RequirePermissions(PERMISSIONS.COMPLAINT_REJECT)
  async rejectComplaint(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: RejectComplaintDto,
  ) {
    return this.complaintsService.rejectComplaint(
      id,
      user.id,
      user.municipalityId,
      dto.reason,
      dto.notes,
    );
  }

  /**
   * Submit feedback for a completed complaint (citizen only)
   */
  @Post(':id/feedback')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Submit feedback',
    description: 'Citizens can submit feedback (1-5 rating) for their completed complaints.',
  })
  @ApiCreatedResponse({
    description: 'Feedback submitted successfully',
    schema: {
      example: {
        success: true,
        data: {
          id: 'uuid',
          complaintId: 'uuid',
          rating: 4,
          comment: 'Great service!',
          createdAt: '2026-02-11T18:00:00Z',
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Complaint not found', type: ApiErrorResponseDto })
  @ApiBadRequestResponse({ description: 'Feedback already submitted or complaint not completed', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Only complaint creator can submit feedback', type: ApiErrorResponseDto })
  @RequirePermissions(PERMISSIONS.COMPLAINT_VIEW_OWN)
  async submitFeedback(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: SubmitFeedbackDto,
  ) {
    return this.complaintsService.submitFeedback(
      id,
      user.id,
      user.municipalityId,
      dto.rating,
      dto.comment,
    );
  }

  /**
   * Soft delete a complaint
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete complaint',
    description: 'Soft deletes a complaint (marks as deleted but retains data)',
  })
  @ApiOkResponse({
    description: 'Complaint deleted successfully',
    type: DeleteResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Complaint not found', type: ApiErrorResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized', type: ApiErrorResponseDto })
  @ApiForbiddenResponse({ description: 'Forbidden', type: ApiErrorResponseDto })
  @RequirePermissions(PERMISSIONS.COMPLAINT_VIEW_ALL)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.complaintsService.remove(id, user.municipalityId);
  }
}
