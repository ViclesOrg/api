import {newClient} from "../db_connection.ts";
import { createHash } from 'crypto';
import {APIErrors} from "../entities/APIErrors.ts";
import { uploadImages } from "./azureBlob.ts";

export interface car
{
	agency: number,
	cover: string,
	images: string,
	model: number,
	gear: number,
	ac: number,
	fuel: number,
	price: number,
	miles: number,
	trunc: number,
	plate: string,
	model_year: number,
	seats: number;
}

async function insertCar(carData: car, cover: string)
{
	const client = newClient();
	await client.connect();

	const insertQuery = `
		INSERT INTO cars ("year", seats, miles, ac, gear, "trunk_size", model, fuel, agency, plate, price, "cover") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING *`;
	const Values = [carData.model_year, carData.seats, carData.miles, carData.ac, 
					carData.gear, carData.trunc, carData.model, carData.fuel, 
					carData.agency, carData.plate, carData.price, "https://cdn.vicles.com/" + (new URL(cover)).pathname];
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

async function addImages(images: string[], carId: number) {
	if (!images.length) {
	  return APIErrors.emptyArray;
	}
  
	const client = newClient();
  
	try {
	  await client.connect();
  
	  const query = {
		text: 'INSERT INTO car_images (link, car) VALUES ($1, $2)',
		values: [] as (string | number)[]
	  };
  
	  for (const img of images) {
		try {
		  query.values = ["https://cdn.vicles.com/" + (new URL(img)).pathname, carId];
		  await client.query(query);
		} catch (rowError) {
		  console.error(`Error inserting image: ${img} for car: ${carId}`, rowError);
		  return APIErrors.Success;
		}
	  }
  
	  return APIErrors.Success;
  
	} catch (error) {
	  console.error('Error in addImages function:', error);
	  return APIErrors.somethingWentWrong;
	} finally {
	  try {
		await client.end();
	  } catch (closeError) {
		console.error('Error closing database connection:', closeError);
		return APIErrors.somethingWentWrong;
	  }
	}
}

export async function createNewCar(carData: car)
{
	const pack = {cover: carData.cover, images: JSON.parse(carData.images)}
    const images = await uploadImages(pack, createHash('sha256').update(carData.plate + (new Date()).toString()).digest('hex'))

	const createdCar = await insertCar(carData, images.coverUrl)
	
	if (createdCar === APIErrors.somethingWentWrong)
		return APIErrors.somethingWentWrong
	else
	{
		const res = await addImages(images.imageUrls, JSON.parse(JSON.stringify(createdCar)).id)
		if (res === APIErrors.somethingWentWrong)
			return APIErrors.somethingWentWrong
		return createdCar
	}
}

async function updateCar(carId: number, carData: Partial<car>) {
    const client = newClient();
    await client.connect();

    const updateQuery = `
        UPDATE cars
        SET "year" = $1, seats = $2, miles = $3, ac = $4, gear = $5, "trunk_size" = $6,
            model = $7, fuel = $8, agency = $9, plate = $10, price = $11
        WHERE id = $12
        RETURNING *`;

    const values = [
        carData.model_year, carData.seats, carData.miles, carData.ac,
        carData.gear, carData.trunc, carData.model, carData.fuel,
        carData.agency, carData.plate, carData.price, carId
    ];

    try {
        const res = await client.query(updateQuery, values);
        if (res.rowCount > 0) {
            const updatedCar = res.rows[0];

            // Handle cover image update if it's a base64 string
            if (carData.cover && typeof carData.cover === 'string' && carData.cover.startsWith('data:image')) {
                const pack = { cover: carData.cover, images: [] };
                const images = await uploadImages(pack, createHash('sha256').update(updatedCar.plate + (new Date()).toString()).digest('hex'));
                const coverUpdateQuery = 'UPDATE cars SET cover = $1 WHERE id = $2';
                await client.query(coverUpdateQuery, ["https://cdn.vicles.com/" + (new URL(images.coverUrl)).pathname, carId]);
            }

            // Handle images array update if it contains base64 strings
            if (carData.images) {
                let imagesArray: any[];
                try {
                    imagesArray = JSON.parse(carData.images);
                } catch (error) {
                    console.error('Error parsing images JSON:', error);
                    return APIErrors.invalidInput;
                }

                if (Array.isArray(imagesArray) && imagesArray.some(img => typeof img === 'string' && img.startsWith('data:image'))) {
                    const pack = { cover: '', images: imagesArray };
                    const images = await uploadImages(pack, createHash('sha256').update(updatedCar.plate + (new Date()).toString()).digest('hex'));
                    await deleteCarImages(carId);
                    await addImages(images.imageUrls, carId);
                }
            }

            return updatedCar;
        } else {
            return APIErrors.notFound;
        }
    } catch (err) {
        console.error('Error updating car:', err);
        return APIErrors.somethingWentWrong;
    } finally {
        await client.end();
    }
}

async function deleteCarImages(carId: number) {
    const client = newClient();
    await client.connect();

    try {
        await client.query('DELETE FROM car_images WHERE car = $1', [carId]);
    } catch (err) {
        console.error('Error deleting car images:', err);
    } finally {
        await client.end();
    }
}

export async function updateExistingCar(carId: number, carData: Partial<car>) {
    const updatedCar = await updateCar(carId, carData);
    if (updatedCar === APIErrors.notFound || updatedCar === APIErrors.somethingWentWrong) {
        return updatedCar;
    }
    return updatedCar;
}