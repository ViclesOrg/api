import {newClient} from "../db_connection.ts";
import {APIErrors} from "../entities/APIErrors.ts";

export async function createUser(role) {
    const client = newClient();
    await client.connect();

    const insertQuery = `
            INSERT INTO "users" ("role") VALUES ($1)
            RETURNING *`;
    const Values = [role];
    try
    {
        const res = await client.query(insertQuery, Values)
        if (res.rowCount > 0)
            return res.rows[0].id
        else
            return APIErrors.somethingWentWrong
    }catch (err) {
        console.error('Error inserting data:', err);
    }
    finally {
        await client.end();
    }
}

export async function deleteUser(id) {
    const client = newClient();
    await client.connect();

    const insertQuery = `
            DELETE FROM "users" WHERE id = $1
            RETURNING *`;
    const Values = [id];
    try
    {
        const res = await client.query(insertQuery, Values)
        if (res.rowCount > 0)
            return res.rows[0].id
        else
            return APIErrors.somethingWentWrong
    }catch (err) {
        console.error('Error inserting data:', err);
    }
    finally {
        await client.end();
    }
}