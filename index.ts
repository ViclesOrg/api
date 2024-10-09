import { serve } from 'bun';
import { agencyController } from './controllers/agencyController';
import { renterController } from './controllers/renterController';
const PORT = 3000;

serve({
    port: PORT,
    fetch: async (request)=> {
        const url = new URL(request.url);
        const headers = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Content-Type": "application/json",
            "Access-Control-Allow-Credentials": "true",
        };

        if (request.method === "POST")
        {
            if (url.pathname.includes('/agency'))
            {
                const body = await request.formData();
                const operation = url.pathname.split("/")[2];
                const agency = new agencyController(operation, JSON.stringify(body));
                const result = await agency.resolve()
                return new Response(JSON.stringify(result),
                    {
                        headers: headers
                    });
            }
            else if (url.pathname.includes('/renters'))
            {   
                const body = await request.formData();
                const operation = url.pathname.split("/")[2];
                const renter = new renterController(operation, JSON.stringify(body));
                const result = await renter.resolve()
                return new Response(JSON.stringify(result),
                    {
                        headers: headers
                    });
            }
        }
        else if (request.method === "GET")
        {
            if (url.pathname.includes('/agency'))
            {

                let body = JSON.parse(JSON.stringify(url.searchParams));
                const operation = url.pathname.split("/")[2];
                const agency = new agencyController(operation, JSON.stringify(body));
                const result = await agency.resolve()
                return new Response(JSON.stringify(result),
                    {
                        headers: headers
                    });
            }
        }

        return new Response('Not Found', { status: 404 });
    },
});

console.log(`Listening on http://localhost:${PORT}`);
