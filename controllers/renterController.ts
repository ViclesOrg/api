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
		if (await this.checkExistence(data.email, data.phoneNumber, data.driverLicense) > 0)
            return APIErrors.renterExists
        const client = newClient();
        await client.connect();
        const user_id = await createUser('renter')
        const insertQuery = `
            INSERT INTO renters (email, driver_license, password, phone, user_id, birth, name, address, image)
            VALUES ($1, $2, $3, $4, $5, $6, '', '', '')
            RETURNING *;`;
        const passHash = createHash('sha256').update(data.password).digest('hex')
        const Values = [data.email, data.driverLicense, passHash, data.phoneNumber, user_id, data.birthDate]
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

    async authenticate(user: any, data: any)
    {
        const token= createHash('sha256').update(JSON.stringify(user)+Date.now().toString()).digest('hex')
        const id = user.user_id
        const fingerprint = data.fingerprint
        const start = new Date();
        const end = new Date(start);
        end.setMonth(start.getMonth() + 1);

        const client = newClient();
        await client.connect();

        const insertQuery = `
            INSERT INTO auth ("user", token, start, "end", fingerprint) VALUES ($1, $2, $3, $4, $5)
            RETURNING *`;
        const Values = [id, token, start, end, fingerprint];
        try
        {
            const res = await client.query(insertQuery, Values)
            if (res.rowCount > 0)
                return res.rows[0]
            else
                return APIErrors.somethingWentWrong
        }catch (err) {
            console.error('Error inserting data:', err);
        }
        finally {
            await client.end();
        }
    }

    async login(data: any)
    {   
        const email = data.email
        const passHash = createHash('sha256').update(data.password).digest('hex')

        const client = newClient();
        await client.connect();

        const selectQuery = `
            SELECT * FROM renters r Where r.email=$1 and r.password=$2`;
        const Values = [email, passHash]
        try
        {
            const res: any = await client.query(selectQuery, Values)
            if (res.rowCount === 0)
                return {user: {}, error: APIErrors.wrongCredentials}
            else
            {
                if (await this.authenticate(res.rows[0], data) !== APIErrors.somethingWentWrong)
                    return {user: res.rows[0], error: APIErrors.Success}
                return {user: {}, error: APIErrors.somethingWentWrong}
            }
        }catch (err) {
            console.error('Error selecting data:', err);
        }
        finally {
            await client.end();
        }
    }

    async getActiveCars()
    {   
        const client = newClient();
        await client.connect();

        const selectQuery = `
            SELECT ca.id, ca.price, ca.cover, mo.name as cmodel, br.name as cbrand 
            FROM cars ca 
            INNER JOIN models mo ON ca.model = mo.id 
            INNER JOIN brands br ON br.id = mo.brand
            WHERE ca.detached = false AND ca.sold = false`;
        try
        {
            const res: any = await client.query(selectQuery)
            if (res.rowCount === 0)
                return {cars: [], error: APIErrors.notFound}
            else
            {
                return {cars: res.rows, error: APIErrors.Success}
            }
        }catch (err) {
            console.error('Error selecting data:', err);
        }
        finally {
            await client.end();
        }
    }

	async resolve()
    {
		if (this.operation === 'create')
			return await this.createRenter(this.data)
        else if (this.operation === 'login')
            return await this.login(this.data)
        else if (this.operation === 'allCars')
            return await this.getActiveCars()
	}
}