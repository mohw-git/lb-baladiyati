import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HelpRequestsService } from './help-requests.service';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { CurrentUserData } from '../../core/auth/types/jwt-payload';
import { RequirePermissions } from '../../core/rbac/require-permissions.decorator';
import { PERMISSIONS } from '../../core/rbac/permissions.constants';
import {
  AssignHelpRequestDto,
  CloseHelpRequestDto,
  CreateHelpRequestDto,
  HelpRequestQueryDto,
  RespondHelpRequestDto,
  SubmitHelpRequestDto,
} from './dto/help-request.dto';

@ApiTags('Help Requests (Cross-Department Collaboration)')
@ApiBearerAuth('JWT-auth')
@Controller('help-requests')
export class HelpRequestsController {
  constructor(private readonly help: HelpRequestsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.HELP_VIEW)
  @ApiOperation({
    summary:
      'List help requests (use ?inbox=true for incoming to my dept, ?outgoing=true for sent)',
  })
  async list(
    @CurrentUser() user: CurrentUserData,
    @Query() query: HelpRequestQueryDto,
  ) {
    return this.help.findAll(user.id, user.municipalityId, query);
  }

  @Get('pending-count')
  @RequirePermissions(PERMISSIONS.HELP_VIEW)
  @ApiOperation({
    summary: 'Number of pending help requests for the caller\'s department',
  })
  async pendingCount(@CurrentUser() user: CurrentUserData) {
    const count = await this.help.pendingCount(user.id, user.municipalityId);
    return { count };
  }

  @Get('complaint/:complaintId')
  @RequirePermissions(PERMISSIONS.HELP_VIEW)
  @ApiOperation({
    summary: 'Help-request history for a single complaint (timeline strip)',
  })
  async historyFor(
    @Param('complaintId') complaintId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.help.historyFor(complaintId, user.id, user.municipalityId);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.HELP_VIEW)
  @ApiOperation({ summary: 'Get a help request by id' })
  async getOne(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.help.findOne(id, user.id, user.municipalityId);
  }

  @Post('complaint/:complaintId')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(PERMISSIONS.HELP_REQUEST)
  @ApiOperation({
    summary:
      'Open a cross-department help request for a complaint (workers can do this)',
    description:
      'Unlike transfers, this does NOT change the complaint\'s department. It just borrows another team\'s expertise.',
  })
  async create(
    @Param('complaintId') complaintId: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateHelpRequestDto,
    @Req() req: Request,
  ) {
    return this.help.create(
      { id: user.id, email: user.email, municipalityId: user.municipalityId },
      complaintId,
      dto,
      req,
    );
  }

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.HELP_RESPOND)
  @ApiOperation({ summary: 'Helper-dept HOD accepts the request' })
  async accept(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: RespondHelpRequestDto,
    @Req() req: Request,
  ) {
    return this.help.accept(
      id,
      { id: user.id, email: user.email, municipalityId: user.municipalityId },
      dto,
      req,
    );
  }

  @Post(':id/decline')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.HELP_RESPOND)
  @ApiOperation({ summary: 'Helper-dept HOD declines the request' })
  async decline(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: RespondHelpRequestDto,
    @Req() req: Request,
  ) {
    return this.help.decline(
      id,
      { id: user.id, email: user.email, municipalityId: user.municipalityId },
      dto,
      req,
    );
  }

  @Post(':id/assign')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.HELP_RESPOND)
  @ApiOperation({
    summary: 'Helper-dept HOD assigns one of their staff to do the work',
  })
  async assign(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: AssignHelpRequestDto,
    @Req() req: Request,
  ) {
    return this.help.assign(
      id,
      { id: user.id, email: user.email, municipalityId: user.municipalityId },
      dto,
      req,
    );
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  // Submitting helper work requires *some* help-flow permission. The service
  // narrows further (must be assigned helper, helper HOD, helper-dept member,
  // or Admin) so this controller-level guard just keeps random authenticated
  // users with no help.* permission out of the endpoint.
  @RequirePermissions(
    PERMISSIONS.HELP_REQUEST,
    PERMISSIONS.HELP_RESPOND,
    PERMISSIONS.HELP_VIEW,
  )
  @ApiOperation({
    summary:
      'Helper worker (or helper HOD) submits proof of work for review by the requesting HOD',
  })
  async submit(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: SubmitHelpRequestDto,
    @Req() req: Request,
  ) {
    return this.help.submit(
      id,
      { id: user.id, email: user.email, municipalityId: user.municipalityId },
      dto,
      req,
    );
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.HELP_RESPOND)
  @ApiOperation({
    summary:
      'Original HOD approves helper contribution → marks help-request COMPLETED',
  })
  async approve(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CloseHelpRequestDto,
    @Req() req: Request,
  ) {
    return this.help.approve(
      id,
      { id: user.id, email: user.email, municipalityId: user.municipalityId },
      dto,
      req,
    );
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.HELP_RESPOND)
  @ApiOperation({
    summary: 'Original HOD rejects helper submission with a reason',
  })
  async reject(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CloseHelpRequestDto,
    @Req() req: Request,
  ) {
    return this.help.reject(
      id,
      { id: user.id, email: user.email, municipalityId: user.municipalityId },
      dto,
      req,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.HELP_REQUEST)
  @ApiOperation({
    summary:
      'Cancel an open help request (requester, original HOD, or Admin)',
  })
  async cancel(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    return this.help.cancel(
      id,
      { id: user.id, email: user.email, municipalityId: user.municipalityId },
      req,
    );
  }
}
