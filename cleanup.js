const db = require('./database');

db.all("SELECT id, name, vendorName FROM food_listings", (err, rows) => {
    if (err) {
        console.error(err);
    } else {
        console.log("Current listings:", rows);
    }
    process.exit(0);
});
