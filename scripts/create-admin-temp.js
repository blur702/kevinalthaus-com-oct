// Temporary script to create admin user with hardcoded password for testing
process.env.ADMIN_PASSWORD = 'Admin123!';
require('./create-admin-user-db.js');
