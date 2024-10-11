import {newClient} from "../db_connection.ts";
import { createHash } from 'crypto';
import {APIErrors} from "../entities/APIErrors.ts";
import {createUser, deleteUser, checkAuth} from "./usersController.ts";

export class renterController
{
	operation: string
    data: string
    constructor(operation: string, data: string){
        this.operation = operation;
        this.data = JSON.parse(data);
    }

	async checkExistence(email: string, phone: string, driver_license: string): Promise<any>{
        const client = newClient();
        await client.connect();
        const selectQuery = `
            Select count(email) as email from renters where email = $1 or phone = $2 or driver_license = $3`;
        const Values = [email, phone, driver_license]
        try
        {
            return parseInt((await client.query(selectQuery, Values)).rows[0]['email'])
        }catch (err) {
            console.error('Error selecting data:', err);
        }
        finally {
            await client.end();
        }
        return 0
    }

	async createRenter(data: any)
	{
		if (await this.checkExistence(data.email, data.phoneNumber) > 0)
            return APIErrors.renterExists
        const client = newClient();
        await client.connect();
        const user_id = await createUser('renter')
        const insertQuery = `
            INSERT INTO renters (email, driver_license, password, phone, user_id, birth, name, address, image)
            VALUES ($1, $2, $3, $4, $5, $6, '', '', '')
            RETURNING *;`;
        const passHash = createHash('sha256').update(data.password).digest('hex')
        const Values = [data.email, data.driverLicense, passHash, data.phoneNumber, user_id, new Date()]
        try
        {

            const result = await client.query(insertQuery, Values)
            if (result.rowCount > 0)
                return APIErrors.Success
            else
            {
                deleteUser(user_id)
                return APIErrors.somethingWentWrong
            }
        }catch (err) {
            console.error('Error inserting data:', err);
        }
        finally {
            await client.end();
        }
	}

	async resolve()
    {
		if (this.operation === 'create')
			return await this.createRenter(this.data)
	}
}