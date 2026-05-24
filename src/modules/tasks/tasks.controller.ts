import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TasksService } from './tasks.service';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { CurrentUserData } from '../../core/auth/types/jwt-payload';
import { RequirePermissions } from '../../core/rbac/require-permissions.decorator';
import { PERMISSIONS } from '../../core/rbac/permissions.constants';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { ChangeTaskStatusDto, AssignTaskDto } from './dto/task-status.dto';

@ApiTags('Tasks (Internal)')
@ApiBearerAuth('JWT-auth')
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  @ApiOperation({ summary: 'List internal staff tasks (scoped by permissions)' })
  async list(
    @CurrentUser() user: CurrentUserData,
    @Query() query: TaskQueryDto,
  ) {
    return this.tasks.findAll(user.id, user.municipalityId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single task by id' })
  async getOne(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.tasks.findOne(id, user.id, user.municipalityId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(PERMISSIONS.TASK_CREATE)
  @ApiOperation({
    summary: 'Create an internal task',
    description:
      'Workers cannot create tasks (no task.create permission). Supervisors / HODs / Admins can.',
  })
  async create(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateTaskDto,
    @Req() req: Request,
  ) {
    return this.tasks.create(
      user.municipalityId,
      { id: user.id, email: user.email },
      dto,
      req,
    );
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.TASK_UPDATE)
  @ApiOperation({ summary: 'Update task fields (title, description, priority, dueDate)' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: UpdateTaskDto,
    @Req() req: Request,
  ) {
    return this.tasks.update(id, user.id, user.municipalityId, dto, req);
  }

  @Patch(':id/status')
  @RequirePermissions(PERMISSIONS.TASK_CHANGE_STATUS)
  @ApiOperation({ summary: 'Change task status' })
  async changeStatus(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: ChangeTaskStatusDto,
    @Req() req: Request,
  ) {
    return this.tasks.changeStatus(id, user.id, user.municipalityId, dto, req);
  }

  @Post(':id/assign')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.TASK_ASSIGN)
  @ApiOperation({
    summary: 'Assign task to a member of the SAME department',
    description:
      'Refuses cross-department assignments — the caller is told to use the transfer-request flow instead.',
  })
  async assign(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: AssignTaskDto,
    @Req() req: Request,
  ) {
    return this.tasks.assign(id, dto.assignedToId, user.id, user.municipalityId, req);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.TASK_DELETE)
  @ApiOperation({ summary: 'Soft-delete a task' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Req() req: Request,
  ) {
    return this.tasks.remove(id, user.id, user.municipalityId, req);
  }
}
