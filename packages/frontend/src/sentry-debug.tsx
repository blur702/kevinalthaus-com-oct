// Temporary debug file to check Sentry configuration
console.log('=== SENTRY DEBUG ===');
console.log('VITE_SENTRY_DSN:', import.meta.env.VITE_SENTRY_DSN);
console.log('VITE_APP_VERSION:', import.meta.env.VITE_APP_VERSION);
console.log('MODE:', import.meta.env.MODE);
console.log('PROD:', import.meta.env.PROD);
console.log('DEV:', import.meta.env.DEV);
console.log('All env:', import.meta.env);
console.log('===================');

export {};
