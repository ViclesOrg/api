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
					carData.agency, carData.plate, carData.price, "https://viclesimages-g6c0fhdagce4d8d4.z02.azurefd.net" + (new URL(cover)).pathname];
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
		  query.values = [img, carId];
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