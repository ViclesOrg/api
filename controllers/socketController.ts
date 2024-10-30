import {newClient} from "../db_connection.ts";
import {APIErrors} from "../entities/APIErrors.ts";

export class socketController
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
  
  async getUnseenNotifications(user_id:number)
  {
    const client = newClient();
    await client.connect();
    const selectQuery = `SELECT n.id AS notification_id, r.id AS rental_id, cl.phone, cl.name AS renter, cl.driver_license, r.start_date, r.end_date, ca.plate, br.name AS brand, mo.name AS model
      FROM notifications n
      INNER JOIN rentals r ON r.car = n.car
      INNER JOIN cars ca ON r.car = ca.id
      INNER JOIN models mo ON ca.model = mo.id
      INNER JOIN brands br ON mo.brand = br.id
      INNER JOIN renters cl ON r.renter = cl.id
      WHERE ca.agency = $1 and r.accepted = 0 and n.seen = false`;
    const values = [user_id]
    try
    {

        const result = await client.query(selectQuery, values)
        if (result.rowCount > 0)
            return result.rows
        else
            return APIErrors.somethingWentWrong
    }catch (err) {
        console.error('ERROR SELECTING DATA:', err);
        return APIErrors.somethingWentWrong
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