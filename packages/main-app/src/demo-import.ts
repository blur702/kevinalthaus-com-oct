#!/usr/bin/env node

// This script demonstrates that the app can be imported without starting a server
import app from './index';

console.log('✅ Successfully imported app without starting server');
console.log('🏷️  App type:', typeof app);
console.log('📊 Express app properties:', Object.getOwnPropertyNames(app).slice(0, 5));
console.log('🚀 App is ready for testing or programmatic use');

// Show that we can access app properties
console.log('🛣️  App has', app._router ? app._router.stack.length : 0, 'registered routes');

process.exit(0);