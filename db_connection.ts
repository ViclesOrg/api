import { Client } from 'pg';

export const newClient = ()=>{
    return  new Client({
        user: 'postgres',
        host: 'viclesdev.postgres.database.azure.com',
        database: 'vicles_db',
        password: 'AitF@sk@#98',
        port: 5432,
        ssl: {
            rejectUnauthorized: false, // Set to true if you want to enforce strict SSL checks
            // You can also include other SSL options here if needed, such as:
            // ca: fs.readFileSync('path_to_ca_certificate').toString(),
            // key: fs.readFileSync('path_to_client_key').toString(),
            // cert: fs.readFileSync('path_to_client_certificate').toString(),
          }
    });
}