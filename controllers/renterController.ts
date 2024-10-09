export class renterController
{
	operation: string
    data: string
    constructor(operation: string, data: string){
        this.operation = operation;
        this.data = JSON.parse(data);
    }

	async createRenter(data: any)
	{
		console.log(data);
		return data
	}

	async resolve()
    {
		if (this.operation === 'create')
			return await this.createRenter(this.data)
	}
}