import {newClient} from "../db_connection.ts";
import {APIErrors} from "../entities/APIErrors.ts";

export class sockerController
{
  constructor()
  {
  }
  
  async establish(sid: string, user_id: number)
  {
    const client = newClient();
    await client.connect();
    const insertQuery = `
        INSERT INTO realtime (user_id, sockid)
        VALUES ($1, $2)
        RETURNING *;`;
    const Values = [user_id, sid]
    try
    {

        const result = await client.query(insertQuery, Values)
        if (result.rowCount > 0)
            return APIErrors.Success
        else
            return APIErrors.somethingWentWrong
    }catch (err) {
        console.error('Error inserting data:', err);
    }
    finally {
        await client.end();
    }
  }
  
  async destroy(sid: string)
  {
    const client = newClient();
    await client.connect();
    const insertQuery = `
        DELETE FROM realtime WHERE sockid = $1
        RETURNING *;`;
    const Values = [sid]
    try
    {

        const result = await client.query(insertQuery, Values)
        if (result.rowCount > 0)
            return APIErrors.Success
        else
            return APIErrors.somethingWentWrong
    }catch (err) {
        console.error('Error inserting data:', err);
    }
    finally {
        await client.end();
    }
  }
}