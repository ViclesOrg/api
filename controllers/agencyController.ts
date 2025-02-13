import Agency from "../entities/Agency.ts";
import {newClient} from "../db_connection.ts";
import { createHash } from 'crypto';
import {APIErrors} from "../entities/APIErrors.ts";
import {createUser, deleteUser, checkAuth} from "./usersController.ts";
import { createNewCar , updateExistingCar} from "./carController.ts";

export class agencyController
{
    operation: string
    data: any
    constructor(operation: string, data: string){
        this.operation = operation;
        this.data = JSON.parse(data);

        // console.log(operation, data)
    }

    async checkExistence(email: string, name: string, rc: string): Promise<any>{
        const client = newClient();
        await client.connect();
        const selectQuery = `
            Select count(email) as email from agencies where email = $1 or name = $2 or rc = $3`;
        const Values = [email, name, rc]
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

    async create()
    {
        if (await this.checkExistence(this.data.email, this.data.name, this.data.rc) > 0)
            return APIErrors.agencyExists
        const agency: any = new Agency(0, this.data.name, this.data.rc, this.data.email, this.data.password, this.data.address, '', '', '');
        const client = newClient();
        await client.connect();
        const user_id = await createUser('agency')
        const insertQuery = `
            INSERT INTO agencies (name, rc, email, password, address, user_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *;`;
        const passHash = createHash('sha256').update(agency.password).digest('hex')
        const Values = [agency.name, agency.comercialRegister, agency.email, passHash, agency.address, user_id]
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



    async authenticate(user: any)
    {
        const token= createHash('sha256').update(JSON.stringify(user)+Date.now().toString()).digest('hex')
        const id = user.user_id
        const fingerprint = this.data.fingerprint
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

    async login()
    {
        const email = this.data.email
        const passHash = createHash('sha256').update(this.data.password).digest('hex')

        const client = newClient();
        await client.connect();

        const selectQuery = `
            SELECT id, a.user_id, a.name, a.phone, a.address, a.logo, a.banner FROM agencies a Where a.email=$1 and a.password=$2`;
        const Values = [email, passHash]
        try
        {
            const res: any = await client.query(selectQuery, Values)
            if (res.rowCount === 0)
                return APIErrors.wrongCredentials
            else
            {
                if (await this.authenticate(res.rows[0]) !== APIErrors.somethingWentWrong)
                    return res.rows[0]
                return APIErrors.somethingWentWrong
            }
        }catch (err) {
            console.error('Error selecting data:', err);
        }
        finally {
            await client.end();
        }
    }

    async brands()
    {
        const client = newClient();
        await client.connect();

        const selectQuery = `SELECT * from brands`;
        try
        {
            const res = await client.query(selectQuery)
            if (res.rowCount === 0)
                return APIErrors.somethingWentWrong
            else
            {
                return res.rows
            }
        }catch (err) {
            console.error('Error selecting data:', err);
        }
        finally {
            await client.end();
        }
    }

    async models(brand: number)
    {
        const client = newClient();
        await client.connect();

        const selectQuery = `SELECT * from models m WHERE m.brand = $1`;
        const values = [brand]
        try
        {
            const res = await client.query(selectQuery, values)
            if (res.rowCount === 0)
                return APIErrors.somethingWentWrong
            else
            {
                return res.rows
            }
        }catch (err) {
            console.error('Error selecting data:', err);
        }
        finally {
            await client.end();
        }
    }

    async cities()
    {
        const client = newClient();
        await client.connect();

        const selectQuery = `SELECT * from cities WHERE country = 1 ORDER BY name ASC`;
        try
        {
            const res = await client.query(selectQuery)
            if (res.rowCount === 0)
                return APIErrors.somethingWentWrong
            else
            {
                return res.rows
            }
        }catch (err) {
            console.error('Error selecting data:', err);
        }
        finally {
            await client.end();
        }
    }
    
    async checkPlateExistence(plate: string)
    {
        const client = newClient();
        await client.connect();

        const selectQuery = `SELECT * FROM cars WHERE plate=$1`;
        const values = [plate]
        try
        {
            const res = await client.query(selectQuery, values)
            if (res.rowCount === 0)
                return APIErrors.Success
            else
                return APIErrors.Failure
        }catch (err) {
            console.error('Error selecting data:', err);
            return APIErrors.somethingWentWrong
        }
        finally {
            await client.end();
        }
    }

    async checkPlateExistenceException(plate: string, id: number)
    {
        const client = newClient();
        await client.connect();

        const selectQuery = `SELECT * FROM cars WHERE plate=$1 and id != $2`;
        const values = [plate, id]
        try
        {
            const res = await client.query(selectQuery, values)
            if (res.rowCount === 0)
                return APIErrors.Success
            else
                return APIErrors.Failure
        }catch (err) {
            console.error('Error selecting data:', err);
            return APIErrors.somethingWentWrong
        }
        finally {
            await client.end();
        }
    }

    async getCarImages(id: number)
    {
        const client = newClient();
        await client.connect();

        const selectQuery = `SELECT link FROM car_images WHERE car=$1`;
        const values = [id]
        try
        {
            const res = await client.query(selectQuery, values)
            return res.rows
        }catch (err) {
            console.error('Error selecting data:', err);
            return APIErrors.somethingWentWrong
        }
        finally {
            await client.end();
        }
    }

    async getAllCars(agency: number, page: number = 1, pageSize: number = 10, searchTerm='') {
        const client = newClient();
        await client.connect();
    
        const offset = (page - 1) * pageSize;
        let selectQuery = `
            SELECT ca.*, mo.id as moid, mo.name as cmodel, br.id as brid, br.name as cbrand 
            FROM cars ca 
            INNER JOIN models mo ON ca.model = mo.id 
            INNER JOIN brands br ON br.id = mo.brand
            WHERE ca.agency=$1 AND ca.detached = false AND ca.sold = false`;
        let countQuery = `
            SELECT COUNT(*) 
            FROM cars ca 
            INNER JOIN models mo ON ca.model = mo.id 
            INNER JOIN brands br ON br.id = mo.brand
            WHERE ca.agency=$1 AND ca.detached = false AND ca.sold = false
        `;
        const values: any[] = [agency, pageSize, offset];
        const countValues: any[] = [agency]

        if (searchTerm !== '') {
            const searchValue = `%${searchTerm}%`;
            selectQuery += ` AND (ca.plate LIKE $4 OR mo.name LIKE $4 OR br.name LIKE $4)`;
            countQuery += ` AND (ca.plate LIKE $2 OR mo.name LIKE $2 OR br.name LIKE $2)`;
    
            values.push(searchValue);  // Push the search term to values array for select query
            countValues.push(searchValue);  // Push the search term to values array for count query
        }
        selectQuery += ` LIMIT $2 OFFSET $3`
        
        try {
            const [resData, resCount] = await Promise.all([
                client.query(selectQuery, values),
                client.query(countQuery, countValues)
            ]);
    
            if (resData.rowCount === 0) {
                return APIErrors.emptyArray;
            } else {
                const totalCount = parseInt(resCount.rows[0].count);
                const totalPages = Math.ceil(totalCount / pageSize);
    
                for (const row of resData.rows) {
                    row.images = await this.getCarImages(row.id);
                }
    
                return {
                    cars: resData.rows,
                    pagination: {
                        currentPage: page,
                        pageSize: pageSize,
                        totalCount: totalCount,
                        totalPages: totalPages
                    }
                };
            }
        } catch (err) {
            console.error('Error selecting data:', err);
            return APIErrors.somethingWentWrong;
        } finally {
            await client.end();
        }
    }

    async addCar()
    {   if (this.data === undefined || this.data === null)
            return new Response('Not Found', { status: 404 })
        this.data.plate = this.data.plate.toUpperCase()
        if (await this.checkPlateExistence(this.data.plate) === APIErrors.Success)
            return await createNewCar(this.data);
        return APIErrors.carExists
    }

    async deleteCar(id: number)
    {
        const client = newClient();
        await client.connect();

        const selectQuery = `UPDATE cars c SET detached = true where id=$1`;
        const values = [id]
        try
        {
            const res = await client.query(selectQuery, values)
            if (res.rowCount === 0)
                return APIErrors.emptyArray
            else
            {
                return res.rows
            }
        }catch (err) {
            console.error('Error selecting data:', err);
            return APIErrors.somethingWentWrong
        }
        finally {
            await client.end();
        }
    }

    async updateCar()
    {
        if (this.data === undefined || this.data === null)
            return new Response('Not Found', { status: 404 })
        this.data.plate = this.data.plate.toUpperCase()
        if (await this.checkPlateExistenceException(this.data.plate, this.data.id) === APIErrors.Success)
            return await updateExistingCar(this.data.id, this.data);
        return APIErrors.carExists
    }

    async resolve()
    {
        if (this.operation === 'create')
            return await this.create()
        else if (this.operation === 'login')
            return await this.login()
        else if (this.operation === 'checkauth')
            return await checkAuth(this.data.fingerprint)
        else if (this.operation === 'brands')
            return await this.brands()
        else if (this.operation === 'models')
            return await this.models(this.data.brand)
        else if (this.operation === 'addCar')
            return await this.addCar()
        else if (this.operation === 'getAllCars')
            return await this.getAllCars(this.data.agency, this.data.page, this.data.pageSize, this.data.searchTerm)
        else if (this.operation === 'deleteCar')
            return await this.deleteCar(this.data.id)
        else if (this.operation === 'updateCar')
            return await this.updateCar()
        else if (this.operation === 'cities')
            return await this.cities()

    }

}