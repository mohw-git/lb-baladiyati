import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse, ApiServiceUnavailableResponse } from '@nestjs/swagger';
import { Public } from '../../core/auth/decorators/public.decorator';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../../core/prisma/prisma.service';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Read package.json at module-load time so /version doesn't pay disk cost per
// request. We resolve from process.cwd() so the same code works under both
// ts-node (where the source path is `src/...`) and the compiled `dist/`
// build (where a relative require would otherwise miss the file).
function loadPkg(): { name?: string; version?: string } {
  try {
    const txt = readFileSync(resolve(process.cwd(), 'package.json'), 'utf8');
    return JSON.parse(txt);
  } catch {
    return {};
  }
}
const pkg = loadPkg();

const BOOTED_AT = new Date();
const COMMIT_SHA = process.env.GIT_COMMIT_SHA ?? process.env.SOURCE_VERSION ?? 'unknown';
const BUILD_ENV = process.env.NODE_ENV ?? 'development';

@ApiTags('Health')
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liveness probe. Cheap, no I/O — just confirms the process is up.
   * Use this from Docker / k8s livenessProbe.
   */
  @Public()
  @SkipThrottle()
  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiOkResponse({
    schema: {
      example: { status: 'ok', uptimeSeconds: 1234, bootedAt: '2026-05-20T03:00:00.000Z' },
    },
  })
  health() {
    return {
      status: 'ok',
      uptimeSeconds: Math.floor(process.uptime()),
      bootedAt: BOOTED_AT.toISOString(),
      now: new Date().toISOString(),
    };
  }

  /**
   * Readiness probe. Confirms the app can serve real traffic (DB reachable).
   * Use this from k8s readinessProbe / load balancer health checks.
   * Returns 503 if the database round-trip fails.
   */
  @Public()
  @SkipThrottle()
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Readiness probe (checks DB)' })
  @ApiOkResponse({
    schema: { example: { status: 'ready', database: 'up', latencyMs: 4 } },
  })
  @ApiServiceUnavailableResponse({
    schema: { example: { status: 'not-ready', database: 'down', error: 'connection refused' } },
  })
  async ready() {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ready',
        database: 'up',
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      throw new ServiceUnavailableException({
        status: 'not-ready',
        database: 'down',
        error: (err as Error).message,
      });
    }
  }

  /**
   * Build / version info. Safe to expose: only what an operator would put
   * on a release page. NEVER add commit messages or env vars here.
   */
  @Public()
  @SkipThrottle()
  @Get('version')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Build metadata' })
  @ApiOkResponse({
    schema: {
      example: {
        name: 'baladi-backend',
        version: '1.0.0',
        commit: 'a1b2c3d',
        environment: 'production',
        bootedAt: '2026-05-20T03:00:00.000Z',
      },
    },
  })
  version() {
    return {
      name: pkg.name ?? 'baladi-backend',
      version: pkg.version ?? '0.0.0',
      commit: COMMIT_SHA,
      environment: BUILD_ENV,
      bootedAt: BOOTED_AT.toISOString(),
    };
  }
}
