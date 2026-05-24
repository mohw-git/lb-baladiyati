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
import { TransfersService } from './transfers.service';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { CurrentUserData } from '../../core/auth/types/jwt-payload';
import { RequirePermissions } from '../../core/rbac/require-permissions.decorator';
import { PERMISSIONS } from '../../core/rbac/permissions.constants';
import {
  AcceptTransferRequestDto,
  CreateTransferRequestDto,
  RejectTransferRequestDto,
  TransferQueryDto,
} from './dto/transfer.dto';

@ApiTags('Transfers (Cross-Department)')
@ApiBearerAuth('JWT-auth')
@Controller('transfers')
export class TransfersController {
  constructor(private readonly transfers: TransfersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.TRANSFER_VIEW)
  @ApiOperation({
    summary: 'List transfer requests (use ?inbox=true for HOD inbox, ?outgoing=true for sent)',
  })
  async list(
    @CurrentUser() user: CurrentUserData,
    @Query() query: TransferQueryDto,
  ) {
    return this.transfers.findAll(user.id, user.municipalityId, query);
  }

  @Get('pending-count')
  @RequirePermissions(PERMISSIONS.TRANSFER_VIEW)
  @ApiOperation({
    summary: 'Number of pending transfers for the caller\'s department (badge count)',
  })
  async pendingCount(@CurrentUser() user: CurrentUserData) {
    const count = await this.transfers.pendingCount(user.id, user.municipalityId);
    return { count };
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.TRANSFER_VIEW)
  @ApiOperation({ summary: 'Get a transfer request by id' })
  async getOne(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.transfers.findOne(id, user.id, user.municipalityId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(PERMISSIONS.TRANSFER_REQUEST)
  @ApiOperation({
    summary: 'Open a cross-department transfer request',
    description:
      'Workers cannot do this (no transfer.request permission). Supervisors / HODs / Admins of the source department can.',
  })
  async create(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateTransferRequestDto,
    @Req() req: Request,
  ) {
    return this.transfers.create(
      { id: user.id, email: user.email, municipalityId: user.municipalityId },
      dto,
      req,
    );
  }

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.TRANSFER_RESPOND)
  @ApiOperation({
    summary: 'Accept a transfer request and pick the new assignee',
    description:
      'Only the HOD of the receiving department (or Admin) can accept. Atomically moves the target into the dept and assigns it.',
  })
  async accept(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: AcceptTransferRequestDto,
    @Req() req: Request,
  ) {
    return this.transfers.accept(
      id,
      { id: user.id, email: user.email, municipalityId: user.municipalityId },
      dto,
      req,
    );
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.TRANSFER_RESPOND)
  @ApiOperation({ summary: 'Reject a transfer request with reason' })
  async reject(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: RejectTransferRequestDto,
    @Req() req: Request,
  ) {
    return this.transfers.reject(
      id,
      { id: user.id, email: user.email, municipalityId: user.municipalityId },
      dto,
      req,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.TRANSFER_REQUEST)
  @ApiOperation({ summary: 'Cancel an outgoing transfer request (only by the original requester)' })
  async cancel(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    return this.transfers.cancel(id, user.id, user.municipalityId, req);
  }
}
