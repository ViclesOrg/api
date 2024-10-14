import {newClient} from "../db_connection.ts";
import { createHash } from 'crypto';
import {APIErrors} from "../entities/APIErrors.ts";
import {createUser, deleteUser, checkAuth} from "./usersController.ts";

export class renterController
{
	operation: string
    data: any
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

    async getFuel()
    {   
        const client = newClient();
        await client.connect();

        const selectQuery = `
            SELECT * FROM fuel`;

        try
        {
            const res: any = await client.query(selectQuery)
            if (res.rowCount === 0)
                return {fuel: [], error: APIErrors.somethingWentWrong}
            else
            {
                return {fuel: res.rows, error: APIErrors.Success}
            }
        }catch (err) {
            console.error('Error selecting data:', err);
        }
        finally {
            await client.end();
        }
    }

    async getBrands()
    {   
        const client = newClient();
        await client.connect();

        const selectQuery = `
            SELECT * FROM brands`;

        try
        {
            const res: any = await client.query(selectQuery)
            if (res.rowCount === 0)
                return {fuel: [], error: APIErrors.somethingWentWrong}
            else
            {
                return {brands: res.rows, error: APIErrors.Success}
            }
        }catch (err) {
            console.error('Error selecting data:', err);
        }
        finally {
            await client.end();
        }
    }

    async getModels(brand: any)
    {   
        const client = newClient();
        await client.connect();

        const selectQuery = `
            SELECT * FROM models WHERE brand = $1`;
        const values = [brand]
        try
        {
            const res: any = await client.query(selectQuery, values)
            if (res.rowCount === 0)
                return {fuel: [], error: APIErrors.somethingWentWrong}
            else
            {
                return {brands: res.rows, error: APIErrors.Success}
            }
        }catch (err) {
            console.error('Error selecting data:', err);
        }
        finally {
            await client.end();
        }
    }

    async getActiveCars(
        page: number = 1,
        limit: number = 30,
        filters: {
            brand?: string;
            model?: string;
            minPrice?: number;
            maxPrice?: number;
            fuel?: string;
            agency?: string;
        } = {}
    ) {
        const client = newClient();
        await client.connect();
    
        const offset = (page - 1) * limit;
    
        // Dynamic filtering query
        const whereConditions = [];
        const params: any[] = [limit, offset];  // Parameters start with LIMIT and OFFSET
    
        if (filters.brand) {
            whereConditions.push(`br.id = $${params.length + 1}`);
            params.push(`%${filters.brand}%`);
        }
        if (filters.model) {
            whereConditions.push(`mo.id = $${params.length + 1}`);
            params.push(`%${filters.model}%`);
        }
        if (filters.minPrice) {
            whereConditions.push(`ca.price >= $${params.length + 1}`);
            params.push(filters.minPrice);
        }
        if (filters.maxPrice) {
            whereConditions.push(`ca.price <= $${params.length + 1}`);
            params.push(filters.maxPrice);
        }
        if (filters.fuel) {
            whereConditions.push(`ca.fuel = $${params.length + 1}`);
            params.push(`%${filters.fuel}%`);
        }
    
        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')} AND ca.detached = false AND ca.sold = false` : `WHERE ca.detached = false AND ca.sold = false`;
    
        const selectQuery = `
            SELECT ca.id, ca.price, ca.cover, mo.name AS cmodel, br.name AS cbrand, ag.name AS "owner"
            FROM cars ca
            INNER JOIN models mo ON ca.model = mo.id
            INNER JOIN brands br ON br.id = mo.brand
            INNER JOIN agencies ag ON ca.agency = ag.id
            ${whereClause}
            LIMIT $1 OFFSET $2`;
    
        try {
            const res: any = await client.query(selectQuery, params);
    
            if (res.rowCount === 0) {
                return { cars: [], error: APIErrors.notFound };
            } else {
                return { cars: res.rows, error: APIErrors.Success };
            }
        } catch (err) {
            console.error('Error selecting data:', err);
            return { cars: [], error: APIErrors.somethingWentWrong };
        } finally {
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
            return await this.getActiveCars(this.data.page, this.data.limit)
        else if (this.operation === 'fuel')
            return await this.getFuel()
        else if (this.operation === 'brands')
            return await this.getBrands()
        else if (this.operation === 'models')
            return await this.getModels(this.data.brand)
	}
}