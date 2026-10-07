/* eslint-disable no-console */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { BoundarySourceImportService } from '../src/modules/platform/boundary-source-import.service';

/**
 * Server/admin CLI to import the bundled default Admin3 source from disk.
 *
 *   npm run boundaries:import-admin3            # import if no active source
 *   npm run boundaries:import-admin3 -- --replace   # replace active source
 */
async function main() {
  const replace = process.argv.includes('--replace');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const service = app.get(BoundarySourceImportService);
    console.log(`Importing default Admin3 source${replace ? ' (replace)' : ''}…`);
    const result = await service.importDefaultSource(null, { replace });
    console.log('Import complete:', JSON.stringify(result, null, 2));
  } catch (err) {
    const message =
      err && typeof err === 'object' && 'response' in err
        ? JSON.stringify((err as { response: unknown }).response)
        : err instanceof Error
          ? err.message
          : String(err);
    console.error('Import failed:', message);
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void main();
