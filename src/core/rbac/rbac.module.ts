import { Global, Module } from '@nestjs/common';
import { PermissionsResolver } from './permissions.resolver';
import { PermissionsGuard } from './permissions.guard';
import { HierarchyResolver } from './hierarchy.resolver';

@Global()
@Module({
  providers: [PermissionsResolver, PermissionsGuard, HierarchyResolver],
  exports: [PermissionsResolver, PermissionsGuard, HierarchyResolver],
})
export class RbacModule {}
