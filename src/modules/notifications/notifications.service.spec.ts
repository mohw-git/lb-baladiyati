import { Test } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../../core/prisma/prisma.service';
import { FcmService } from '../../core/fcm/fcm.service';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { NotificationType } from '@prisma/client';

describe('NotificationsService.createAndSend', () => {
  const prisma = {
    notification: { create: jest.fn() },
    userNotification: {
      createMany: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  const fcm = { sendToUsers: jest.fn() };
  const realtime = { notificationNew: jest.fn() };

  let service: NotificationsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.notification.create.mockResolvedValue({ id: 'n1' });

    const module = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: FcmService, useValue: fcm },
        { provide: RealtimeService, useValue: realtime },
      ],
    }).compile();

    service = module.get(NotificationsService);
  });

  it('sends FCM by default', async () => {
    await service.createAndSend(
      'm1',
      ['u1'],
      NotificationType.NEWS_PUBLISHED,
      'Title',
      'Body',
      { deepLink: '/announcements/1' },
    );
    expect(fcm.sendToUsers).toHaveBeenCalledWith(
      ['u1'],
      'Title',
      'Body',
      expect.objectContaining({ type: NotificationType.NEWS_PUBLISHED }),
    );
  });

  it('skips FCM when push is false', async () => {
    await service.createAndSend(
      'm1',
      ['u1'],
      NotificationType.NEWS_PUBLISHED,
      'Title',
      'Body',
      { deepLink: '/announcements/1' },
      { push: false },
    );
    expect(fcm.sendToUsers).not.toHaveBeenCalled();
  });
});
