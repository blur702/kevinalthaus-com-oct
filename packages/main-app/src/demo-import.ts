#!/usr/bin/env node

// This script demonstrates that the app can be imported without starting a server
import app from './index';

/* eslint-disable no-console */
console.log('✅ Successfully imported app without starting server');
console.log('🏷️  App type:', typeof app);
console.log('📊 Express app properties:', Object.getOwnPropertyNames(app).slice(0, 5));
console.log('🚀 App is ready for testing or programmatic use');

// Show that we can access app properties
interface ExpressRouter {
  stack: unknown[];
}

const router = app._router as ExpressRouter | undefined;
console.log('🛣️  App has', router?.stack?.length ?? 0, 'registered routes');
/* eslint-enable no-console */

process.exit(0);