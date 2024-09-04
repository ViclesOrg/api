import { Client } from 'pg';

export const newClient = ()=>{
    return  new Client({
        user: 'postgres',
        host: 'localhost',
        database: 'vicles_db',
        password: '@itf@sk@#98',
        port: 5432,
    });
}