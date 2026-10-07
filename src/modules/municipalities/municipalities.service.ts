import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { UpdateMunicipalityBrandingDto } from './dto/update-municipality-branding.dto';
import { StorageService } from '../../core/storage/storage.service';

/** Fields returned for municipality settings / branding UI (GET me + PATCH branding). */
const MUNICIPALITY_PROFILE_SELECT = {
  id: true,
  name: true,
  nameAr: true,
  nameFr: true,
  description: true,
  descriptionAr: true,
  descriptionFr: true,
  code: true,
  logoUrl: true,
  bannerImageUrl: true,
  bannerOverlayColor: true,
  bannerOverlayOpacity: true,
  primaryColor: true,
  email: true,
  phone: true,
  whatsApp: true,
  address: true,
  addressAr: true,
  addressFr: true,
  openingHours: true,
  openingHoursAr: true,
  openingHoursFr: true,
  website: true,
  latitude: true,
  longitude: true,
  isActive: true,
  createdAt: true,
  adminUserId: true,
  admin: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      avatarUrl: true,
    },
  },
} as const;

@Injectable()
export class MunicipalitiesService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  async uploadMunicipalityImage(
    municipalityId: string,
    callerMunicipalityId: string,
    isSuperAdmin: boolean,
    field: 'logoUrl' | 'bannerImageUrl',
    file: Express.Multer.File,
  ) {
    if (!isSuperAdmin && callerMunicipalityId !== municipalityId) {
      throw new ForbiddenException('You can only manage your own municipality branding');
    }
    if (!file) throw new BadRequestException('No file provided');
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('Image must be a valid image file');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('Image must be smaller than 5MB');
    }

    const folder = field === 'logoUrl' ? 'municipalities/logo' : 'municipalities/banner';
    const url = await this.storage.saveFile(file, folder);
    return this.updateBranding(municipalityId, callerMunicipalityId, isSuperAdmin, {
      [field]: url,
    } as any);
  }

  async findAll() {
    const municipalities = await this.prisma.municipality.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        nameAr: true,
        nameFr: true,
        code: true,
        logoUrl: true,
        bannerImageUrl: true,
        bannerOverlayColor: true,
        bannerOverlayOpacity: true,
        primaryColor: true,
        description: true,
        descriptionAr: true,
        descriptionFr: true,
        email: true,
        phone: true,
        address: true,
        addressAr: true,
        addressFr: true,
        openingHours: true,
        openingHoursAr: true,
        openingHoursFr: true,
        website: true,
      },
      orderBy: { name: 'asc' },
    });

    return { data: municipalities };
  }

  async findByCode(code: string) {
    const municipality = await this.prisma.municipality.findUnique({
      where: { code: code.toUpperCase() },
      select: {
        id: true,
        name: true,
        nameAr: true,
        nameFr: true,
        code: true,
        logoUrl: true,
        bannerImageUrl: true,
        bannerOverlayColor: true,
        bannerOverlayOpacity: true,
        primaryColor: true,
        description: true,
        descriptionAr: true,
        descriptionFr: true,
        email: true,
        phone: true,
        whatsApp: true,
        address: true,
        addressAr: true,
        addressFr: true,
        openingHours: true,
        openingHoursAr: true,
        openingHoursFr: true,
        website: true,
        latitude: true,
        longitude: true,
        isActive: true,
        departments: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            nameAr: true,
            nameFr: true,
            categories: {
              where: { isActive: true },
              select: {
                id: true,
                name: true,
                nameAr: true,
                nameFr: true,
              },
            },
          },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!municipality || !municipality.isActive) {
      throw new NotFoundException('Municipality not found');
    }

    return municipality;
  }

  async findOne(id: string) {
    const municipality = await this.prisma.municipality.findUnique({
      where: { id },
      select: MUNICIPALITY_PROFILE_SELECT,
    });

    if (!municipality) {
      throw new NotFoundException('Municipality not found');
    }

    return municipality;
  }

  /**
   * Update municipality branding / multilingual names.
   * Municipality admins can only update their own municipality.
   * Super admins can update any.
   */
  async updateBranding(
    municipalityId: string,
    callerMunicipalityId: string,
    isSuperAdmin: boolean,
    dto: UpdateMunicipalityBrandingDto,
  ) {
    if (!isSuperAdmin && callerMunicipalityId !== municipalityId) {
      throw new ForbiddenException('You can only manage your own municipality branding');
    }

    const municipality = await this.prisma.municipality.findUnique({
      where: { id: municipalityId },
    });

    if (!municipality) {
      throw new NotFoundException('Municipality not found');
    }

    const updated = await this.prisma.municipality.update({
      where: { id: municipalityId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.nameAr !== undefined && { nameAr: dto.nameAr }),
        ...(dto.nameFr !== undefined && { nameFr: dto.nameFr }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.descriptionAr !== undefined && { descriptionAr: dto.descriptionAr }),
        ...(dto.descriptionFr !== undefined && { descriptionFr: dto.descriptionFr }),
        ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
        ...(dto.bannerImageUrl !== undefined && { bannerImageUrl: dto.bannerImageUrl }),
        ...(dto.bannerOverlayColor !== undefined && { bannerOverlayColor: dto.bannerOverlayColor }),
        ...(dto.bannerOverlayOpacity !== undefined && { bannerOverlayOpacity: dto.bannerOverlayOpacity }),
        ...(dto.primaryColor !== undefined && { primaryColor: dto.primaryColor }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.whatsApp !== undefined && { whatsApp: dto.whatsApp }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.addressAr !== undefined && { addressAr: dto.addressAr }),
        ...(dto.addressFr !== undefined && { addressFr: dto.addressFr }),
        ...(dto.openingHours !== undefined && { openingHours: dto.openingHours }),
        ...(dto.openingHoursAr !== undefined && { openingHoursAr: dto.openingHoursAr }),
        ...(dto.openingHoursFr !== undefined && { openingHoursFr: dto.openingHoursFr }),
        ...(dto.website !== undefined && { website: dto.website }),
        ...(dto.latitude !== undefined && { latitude: dto.latitude }),
        ...(dto.longitude !== undefined && { longitude: dto.longitude }),
      },
      select: MUNICIPALITY_PROFILE_SELECT,
    });

    return updated;
  }
}
