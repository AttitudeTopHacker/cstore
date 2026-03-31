const bcrypt = require('bcryptjs');
const password = 'Salman@134';
const saltRounds = 10;

bcrypt.hash(password, saltRounds, function(err, hash) {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    console.log('HASH_START');
    console.log(hash);
    console.log('HASH_END');
});
