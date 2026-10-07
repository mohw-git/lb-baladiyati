import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/core/prisma/prisma.service';

describe('Baladiyati Backend (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let citizenToken: string;
  let municipalityId: string;
  let categoryId: string;
  let complaintId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Auth Flow', () => {
    it('should list municipalities (public)', async () => {
      const response = await request(app.getHttpServer())
        .get('/municipalities')
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      
      if (response.body.data.length > 0) {
        municipalityId = response.body.data[0].id;
      }
    });

    it('should login as admin', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'admin@beirut.gov.lb',
          password: 'admin123',
        })
        .expect(200);

      expect(response.body.token).toBeDefined();
      expect(response.body.roles).toContain('Admin');
      adminToken = response.body.token;
      municipalityId = response.body.municipalityId;
    });

    it('should register a citizen', async () => {
      const email = `citizen_${Date.now()}@example.com`;
      const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          municipalityCode: 'BEI',
          email,
          password: 'password123',
          firstName: 'Test',
          lastName: 'Citizen',
        })
        .expect(201);

      expect(response.body.token).toBeDefined();
      citizenToken = response.body.token;
    });

    it('should get profile', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.email).toBe('admin@beirut.gov.lb');
      expect(response.body.permissions).toBeDefined();
    });

    it('should reject invalid login', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'admin@beirut.gov.lb',
          password: 'wrongpassword',
        })
        .expect(401);
    });
  });

  describe('Categories & Departments', () => {
    it('should list categories', async () => {
      const response = await request(app.getHttpServer())
        .get('/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toBeDefined();
      if (response.body.data.length > 0) {
        categoryId = response.body.data[0].id;
      }
    });

    it('should create a department', async () => {
      const response = await request(app.getHttpServer())
        .post('/departments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `Test Department ${Date.now()}`,
          description: 'A test department',
        })
        .expect(201);

      expect(response.body.id).toBeDefined();
    });

    it('should deny department creation for citizen', async () => {
      await request(app.getHttpServer())
        .post('/departments')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({
          name: 'Unauthorized Department',
        })
        .expect(403);
    });
  });

  describe('Complaint Lifecycle', () => {
    it('should create a complaint', async () => {
      // Skip if no category found
      if (!categoryId) {
        console.log('Skipping: No category found');
        return;
      }

      const response = await request(app.getHttpServer())
        .post('/complaints')
        .set('Authorization', `Bearer ${citizenToken}`)
        .field('categoryId', categoryId)
        .field('title', 'Test Complaint')
        .field('description', 'This is a test complaint for e2e testing')
        .expect(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.referenceCode).toBeDefined();
      expect(response.body.status).toBe('SUBMITTED');
      complaintId = response.body.id;
    });

    it('should list complaints', async () => {
      const response = await request(app.getHttpServer())
        .get('/complaints')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(response.body.meta).toBeDefined();
    });

    it('should get complaint details', async () => {
      if (!complaintId) {
        console.log('Skipping: No complaint created');
        return;
      }

      const response = await request(app.getHttpServer())
        .get(`/complaints/${complaintId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.id).toBe(complaintId);
      expect(response.body.statusHistory).toBeDefined();
    });
  });

  describe('RBAC', () => {
    it('should list roles', async () => {
      const response = await request(app.getHttpServer())
        .get('/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should list permissions', async () => {
      const response = await request(app.getHttpServer())
        .get('/permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(response.body.data.length).toBe(28);
    });

    it('should deny roles listing for citizen', async () => {
      await request(app.getHttpServer())
        .get('/roles')
        .set('Authorization', `Bearer ${citizenToken}`)
        .expect(403);
    });
  });

  describe('News', () => {
    let newsId: string;

    it('should create news', async () => {
      const response = await request(app.getHttpServer())
        .post('/news')
        .set('Authorization', `Bearer ${adminToken}`)
        .field('title', 'Test News Article')
        .field('content', 'This is a test news article for e2e testing')
        .expect(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.isPublished).toBe(false);
      newsId = response.body.id;
    });

    it('should publish news', async () => {
      if (!newsId) return;

      const response = await request(app.getHttpServer())
        .post(`/news/${newsId}/publish`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.isPublished).toBe(true);
      expect(response.body.publishedAt).toBeDefined();
    });

    it('should list published news (public)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/news?municipalityId=${municipalityId}&published=true`)
        .expect(200);

      expect(response.body.data).toBeDefined();
    });
  });

  describe('Tenancy Isolation', () => {
    it('should only see own municipality data', async () => {
      const response = await request(app.getHttpServer())
        .get('/complaints')
        .set('Authorization', `Bearer ${citizenToken}`)
        .expect(200);

      // All complaints should belong to user's municipality
      response.body.data.forEach((complaint: any) => {
        expect(complaint.municipalityId === undefined || 
               complaint.municipalityId === municipalityId).toBe(true);
      });
    });
  });
});
