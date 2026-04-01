const bcrypt = require('bcryptjs');

const password = 'Salman@134';

// Generate fresh hash
const hash = bcrypt.hashSync(password, 10);
console.log('Generated Hash:', hash);
console.log('Verify Generated:', bcrypt.compareSync(password, hash));

// Test the DB hash
const dbHash = '$2b$10$uoFe8BghBMRyjf5MOEv4ouC1Lze7zTEc7c3c.IPdXdupAlFw0Bqjq';
console.log('DB Hash:', dbHash);
console.log('Verify DB Hash:', bcrypt.compareSync(password, dbHash));

// Output the hash for SQL
console.log('\n--- Copy this hash for SQL update ---');
console.log(hash);
