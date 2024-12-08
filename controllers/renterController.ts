import { newClient } from "../db_connection.ts";
import { createHash } from "crypto";
import { APIErrors } from "../entities/APIErrors.ts";
import { createUser, deleteUser, checkAuth } from "./usersController.ts";
import { Socket } from "socket.io";

export class renterController {
  operation: string;
  data: any;
  constructor(operation: string, data: string) {
    this.operation = operation;
    this.data = JSON.parse(data);
  }

  async cancelBooking(bookingId: number, notification: number) {
    const client = newClient();
    await client.connect();

    try {
      await client.query("BEGIN"); // Start transaction

      // Update the notifications table
      const notificationQuery = `
          UPDATE notifications
          SET seen = true
          WHERE id = $1;
        `;
      await client.query(notificationQuery, [notification]);

      // Update the rentals table
      const rentalQuery = `
          UPDATE rentals
          SET accepted = 2
          WHERE id = $1;
        `;
      await client.query(rentalQuery, [bookingId]);

      await client.query("COMMIT"); // Commit the transaction if both succeed
      return APIErrors.Success;
    } catch (error) {
      await client.query("ROLLBACK"); // Rollback on error
      return APIErrors.Failure;
    } finally {
      await client.end();
    }
  }

  async acceptBooking(bookingId: number, notification: number) {
    const client = newClient();
    await client.connect();

    try {
      await client.query("BEGIN"); // Start transaction

      // Update the notifications table
      const notificationQuery = `
          UPDATE notifications
          SET seen = true
          WHERE id = $1;
        `;
      await client.query(notificationQuery, [notification]);

      // Update the rentals table
      const rentalQuery = `
          UPDATE rentals
          SET accepted = 1
          WHERE id = $1;
        `;
      await client.query(rentalQuery, [bookingId]);

      await client.query("COMMIT"); // Commit the transaction if both succeed
      return APIErrors.Success;
    } catch (error) {
      await client.query("ROLLBACK"); // Rollback on error
      console.log(error);
      return APIErrors.Failure;
    } finally {
      await client.end();
    }
  }

  async checkExistence(
    email: string,
    phone: string,
    driver_license: string,
  ): Promise<any> {
    const client = newClient();
    await client.connect();
    const selectQuery = `
            Select count(email) as email from renters where email = $1 or phone = $2 or driver_license = $3`;
    const Values = [email, phone, driver_license];
    try {
      return parseInt(
        (await client.query(selectQuery, Values)).rows[0]["email"],
      );
    } catch (err) {
      console.error("Error selecting data:", err);
    } finally {
      await client.end();
    }
    return 0;
  }

  async createRenter(data: any) {
    if (
      (await this.checkExistence(
        data.email,
        data.phoneNumber,
        data.driverLicense,
      )) > 0
    )
      return APIErrors.renterExists;
    const client = newClient();
    await client.connect();
    const user_id = await createUser("renter");
    const insertQuery = `
            INSERT INTO renters (email, driver_license, password, phone, user_id, birth, name, address, image)
            VALUES ($1, $2, $3, $4, $5, $6, '', '', '')
            RETURNING *;`;
    const passHash = createHash("sha256").update(data.password).digest("hex");
    const Values = [
      data.email,
      data.driverLicense,
      passHash,
      data.phoneNumber,
      user_id,
      data.birthDate,
    ];
    try {
      const result = await client.query(insertQuery, Values);
      if (result.rowCount > 0) return APIErrors.Success;
      else {
        deleteUser(user_id);
        return APIErrors.somethingWentWrong;
      }
    } catch (err) {
      console.error("Error inserting data:", err);
    } finally {
      await client.end();
    }
  }

  async authenticate(user: any, data: any) {
    const token = createHash("sha256")
      .update(JSON.stringify(user) + Date.now().toString())
      .digest("hex");
    const id = user.user_id;
    const fingerprint = data.fingerprint;
    const start = new Date();
    const end = new Date(start);
    end.setMonth(start.getMonth() + 1);

    const client = newClient();
    await client.connect();

    const insertQuery = `
            INSERT INTO auth ("user", token, start, "end", fingerprint) VALUES ($1, $2, $3, $4, $5)
            RETURNING *`;
    const Values = [id, token, start, end, fingerprint];
    try {
      const res = await client.query(insertQuery, Values);
      if (res.rowCount > 0) return res.rows[0];
      else return APIErrors.somethingWentWrong;
    } catch (err) {
      console.error("Error inserting data:", err);
    } finally {
      await client.end();
    }
  }

  async login(data: any) {
    const email = data.email;
    const passHash = createHash("sha256").update(data.password).digest("hex");

    const client = newClient();
    await client.connect();

    const selectQuery = `
            SELECT r.id, r.name, r.driver_license, r.email, r.phone, r.birth, r.address, r.image, r.user_id FROM renters r
            Where r.email=$1 and r.password=$2`;
    const Values = [email, passHash];
    try {
      const res: any = await client.query(selectQuery, Values);
      if (res.rowCount === 0)
        return { user: {}, error: APIErrors.wrongCredentials };
      else {
        if (
          (await this.authenticate(res.rows[0], data)) !==
          APIErrors.somethingWentWrong
        )
          return { user: res.rows[0], error: APIErrors.Success };
        return { user: {}, error: APIErrors.somethingWentWrong };
      }
    } catch (err) {
      console.error("Error selecting data:", err);
    } finally {
      await client.end();
    }
  }

  async getFuel() {
    const client = newClient();
    await client.connect();

    const selectQuery = `
            SELECT * FROM fuel`;

    try {
      const res: any = await client.query(selectQuery);
      if (res.rowCount === 0)
        return { fuel: [], error: APIErrors.somethingWentWrong };
      else {
        return { fuel: res.rows, error: APIErrors.Success };
      }
    } catch (err) {
      console.error("Error selecting data:", err);
    } finally {
      await client.end();
    }
  }

  async getCities() {
    const client = newClient();
    await client.connect();

    const selectQuery = `
      SELECT ci.id, ci.name FROM cities ci
      ORDER BY ci.name ASC`;

    try {
      const res: any = await client.query(selectQuery);
      if (res.rowCount === 0)
        return { cities: [], error: APIErrors.somethingWentWrong };
      else {
        return { cities: res.rows, error: APIErrors.Success };
      }
    } catch (err) {
      console.error("Error selecting data:", err);
    } finally {
      await client.end();
    }
  }

  async getBrands() {
    const client = newClient();
    await client.connect();

    const selectQuery = `SELECT * FROM brands`;

    try {
      const res: any = await client.query(selectQuery);
      if (res.rowCount === 0)
        return { fuel: [], error: APIErrors.somethingWentWrong };
      else {
        return { brands: res.rows, error: APIErrors.Success };
      }
    } catch (err) {
      console.error("Error selecting data:", err);
    } finally {
      await client.end();
    }
  }

  async getCarImages(carId: any) {
    const client = newClient();
    await client.connect();

    const selectQuery = `
            SELECT cim.link, cim.car FROM car_images cim
            INNER JOIN cars ca ON ca.id = cim.car
            WHERE ca.id = $1`;
    const values = [carId];
    try {
      const res: any = await client.query(selectQuery, values);
      if (res.rowCount === 0)
        return { links: [], error: APIErrors.somethingWentWrong };
      else {
        return { links: res.rows, error: APIErrors.Success };
      }
    } catch (err) {
      console.error("Error selecting data:", err);
    } finally {
      await client.end();
    }
  }

  async getModels(brand: any) {
    const client = newClient();
    await client.connect();

    const selectQuery = `
            SELECT * FROM models WHERE brand = $1`;
    const values = [brand];
    try {
      const res: any = await client.query(selectQuery, values);
      if (res.rowCount === 0)
        return { fuel: [], error: APIErrors.somethingWentWrong };
      else {
        return { brands: res.rows, error: APIErrors.Success };
      }
    } catch (err) {
      console.error("Error selecting data:", err);
    } finally {
      await client.end();
    }
  }

  async getRentalDates(carId: any) {
    const client = newClient();
    await client.connect();
    const selectQuery = `
            SELECT re.start_date, re.end_date FROM rentals re
            INNER JOIN cars ca
            ON ca.id = re.car
            WHERE ca.id = $1 and re.end_date > NOW()`;
    const values = [carId];
    try {
      const res: any = await client.query(selectQuery, values);
      return { dates: res.rows, error: APIErrors.Success };
    } catch (err) {
      console.error("Error selecting data:", err);
      return { dates: null, error: APIErrors.somethingWentWrong };
    } finally {
      await client.end();
    }
  }

  async getRenterNotifications(renterId: number) {
    const client = newClient();
    await client.connect();

    const selectQuery = `
      SELECT n.id AS notification, ag.name AS agency, r.accepted AS status, mo.name AS model, br.name AS brand
      FROM notifications n
      INNER JOIN rentals r ON n.rental = r.id
      INNER JOIN cars ca ON r.car = ca.id
      INNER JOIN agencies ag ON ca.agency = ag.id
      INNER JOIN models mo ON ca.model = mo.id
      INNER JOIN brands br ON mo.brand = br.id
      WHERE n.target = $1`;
    const values = [renterId];
    try {
      const res: any = await client.query(selectQuery, values);
      return { notifications: res.rows, error: APIErrors.Success };
    } catch (err) {
      console.error("Error selecting data:", err);
      return { notifications: [], error: APIErrors.Failure };
    } finally {
      await client.end();
    }
  }

  async getActiveCars(
    page = 1,
    limit = 30,
    brand?: number,
    model?: number,
    minPrice?: number,
    maxPrice?: number,
    fuel?: number,
    agency?: string,
  ) {
    const client = newClient();
    await client.connect();

    const offset = (page - 1) * limit;

    // Dynamic filtering query
    const whereConditions = [];
    const params: any[] = [limit, offset];

    // Check for brand and model

    if (brand !== undefined) {
      whereConditions.push(`br.id = $${params.length + 1}`);
      params.push(brand);
    }
    if (model !== undefined) {
      whereConditions.push(`mo.id = $${params.length + 1}`);
      params.push(model);
    }

    // Numeric comparisons for prices
    if (minPrice !== undefined && !isNaN(minPrice)) {
      whereConditions.push(`ca.price >= $${params.length + 1}`);
      params.push(minPrice);
    }
    if (maxPrice !== undefined && !isNaN(maxPrice)) {
      whereConditions.push(`ca.price <= $${params.length + 1}`);
      params.push(maxPrice);
    }

    // Fuel and agency filters
    if (fuel !== undefined) {
      whereConditions.push(`ca.fuel = $${params.length + 1}`);
      params.push(fuel);
    }
    if (agency) {
      whereConditions.push(`ag.name ILIKE $${params.length + 1}`);
      params.push(`%${agency}%`);
    }

    // Ensure basic conditions are always applied
    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(" AND ")} AND ca.detached = false AND ca.sold = false`
        : `WHERE ca.detached = false AND ca.sold = false`;

    const selectQuery = `
      SELECT ci.name AS city, ca.id, ca.price, ca.trunk_size AS trunkSize, ca.seats, ca.miles, gr.name AS gear, f.name AS fuel, mo.name AS cmodel, br.name AS cbrand, ag.name AS "owner", ca.cover
      FROM cars ca
      INNER JOIN models mo ON ca.model = mo.id
      INNER JOIN brands br ON br.id = mo.brand
      INNER JOIN agencies ag ON ca.agency = ag.id
      INNER JOIN fuel f ON f.id = ca.fuel
      INNER JOIN grears gr ON gr.id = ca.gear
      INNER JOIN cities ci ON ca.city = ci.id
            ${whereClause}
            LIMIT $1 OFFSET $2`;

    try {
      const res = await client.query(selectQuery, params);

      if (res.rowCount === 0) {
        return { cars: [], error: APIErrors.notFound };
      } else {
        return { cars: res.rows, error: APIErrors.Success };
      }
    } catch (err) {
      console.error("Error selecting data:", err);
      if (err instanceof Error) {
        console.error("Error message:", err.message);
        console.error("Error stack:", err.stack);
      }
      return { cars: [], error: APIErrors.somethingWentWrong };
    } finally {
      await client.end();
    }
  }

  async rentCar(carID: any, renterID: any, start: any, end: any) {
    const client = newClient();
    await client.connect();

    // Here I have to careate push notification event, to create a notification towards the agency
    const selectQuery = `
            INSERT INTO rentals (renter,"start_date", "end_date", car)
            VALUES ($1, $2, $3, $4)
            RETURNING *`;
    const values = [renterID, start, end, carID];
    try {
      const res: any = await client.query(selectQuery, values);
      if (res.rows.length > 0) return APIErrors.Success;
      else return APIErrors.somethingWentWrong;
    } catch (err) {
      console.error("Error Inserting data data:", err);
      return APIErrors.somethingWentWrong;
    } finally {
      await client.end();
    }
  }

  async resolve() {
    if (this.operation === "create") return await this.createRenter(this.data);
    else if (this.operation === "login") return await this.login(this.data);
    else if (this.operation === "allCars")
      return await this.getActiveCars(
        this.data.page,
        this.data.limit,
        this.data.brand,
        this.data.model,
        this.data.minPrice,
        this.data.maxPrice,
        this.data.fuel,
        this.data.agency,
      );
    else if (this.operation === "fuel") return await this.getFuel();
    else if (this.operation === "cities") return await this.getCities();
    else if (this.operation === "brands") return await this.getBrands();
    else if (this.operation === "models")
      return await this.getModels(this.data.brand);
    else if (this.operation === "CarImages")
      return await this.getCarImages(this.data.id);
    else if (this.operation === "rentalDates")
      return await this.getRentalDates(this.data.id);
    else if (this.operation === "rentCar")
      return await this.rentCar(
        this.data.car,
        this.data.renter,
        this.data.start,
        this.data.end,
      );
    else if (this.operation === "acceptBooking")
      return await this.acceptBooking(this.data.rental, this.data.notification);
    else if (this.operation === "cancelBooking")
      return await this.cancelBooking(this.data.rental, this.data.notification);
    else if (this.operation === "renterNotifications")
      return this.getRenterNotifications(this.data.renterId);
  }
}
