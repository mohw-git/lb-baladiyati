import { Logger, OnModuleInit } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Real-time gateway. Web + mobile clients connect to it on login and listen
 * for `entity:event` messages. Each socket joins a few rooms:
 *
 *   - `user:<id>`        — events targeted at one specific user
 *   - `muni:<id>`        — broadcasts visible to everyone in that municipality
 *   - `dept:<id>`        — broadcasts scoped to a department
 *   - `super-admin`      — platform-wide broadcasts (super admin dashboards)
 *
 * Events use a tiny generic envelope `{ type, payload }` so the client just
 * routes them to the right React Query / TanStack invalidation. The payload
 * is intentionally minimal — clients refetch the canonical data over HTTP
 * when they actually need it.
 */
@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: '/realtime',
  // The default ping settings (25s/20s) are fine for our latency budget.
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.logger.log('Realtime gateway initialized at /realtime');
  }

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        client.emit('error', { message: 'No auth token' });
        client.disconnect(true);
        return;
      }

      const payload = this.jwtService.verify(token);
      const userId = payload?.sub as string | undefined;
      if (!userId) {
        client.disconnect(true);
        return;
      }

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          isActive: true,
          isSuperAdmin: true,
          municipalityId: true,
          departmentId: true,
        },
      });

      if (!user || !user.isActive) {
        client.disconnect(true);
        return;
      }

      // Stash basic identity on the socket for later filtering
      (client.data as any).userId = user.id;
      (client.data as any).municipalityId = user.municipalityId;
      (client.data as any).departmentId = user.departmentId;
      (client.data as any).isSuperAdmin = user.isSuperAdmin;

      // Join the rooms relevant to this user
      await client.join(`user:${user.id}`);
      if (user.municipalityId) await client.join(`muni:${user.municipalityId}`);
      if (user.departmentId) await client.join(`dept:${user.departmentId}`);
      if (user.isSuperAdmin) await client.join('super-admin');

      client.emit('connected', { userId: user.id });
      this.logger.debug(`Socket ${client.id} connected as user ${user.id}`);
    } catch (err) {
      this.logger.warn(`Auth failure on socket ${client.id}: ${(err as Error).message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Socket ${client.id} disconnected`);
  }

  private extractToken(client: Socket): string | null {
    // Try in order: handshake.auth.token (recommended), Authorization header,
    // ?token=… query param. Mobile RN/Expo clients use the auth field.
    const auth = (client.handshake.auth as any)?.token;
    if (auth && typeof auth === 'string') return auth.replace(/^Bearer\s+/i, '');

    const header = client.handshake.headers.authorization;
    if (header && typeof header === 'string') {
      return header.replace(/^Bearer\s+/i, '');
    }

    const q = client.handshake.query?.token;
    if (q && typeof q === 'string') return q;

    return null;
  }
}
