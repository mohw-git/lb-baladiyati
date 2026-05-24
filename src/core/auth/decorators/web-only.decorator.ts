import { SetMetadata } from '@nestjs/common';
import { IS_WEB_ONLY } from '../guards/web-only.guard';

export const WebOnly = () => SetMetadata(IS_WEB_ONLY, true);
