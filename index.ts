import { serve } from 'bun';
import { Server as SocketIOServer } from 'socket.io'; // Import Socket.IO
import { agencyController } from './controllers/agencyController';
import { renterController } from './controllers/renterController';
import { sockerController } from './controllers/socketController';

const PORT = 3000;

// Setup Socket.IO Server
const io = new SocketIOServer({
  cors: {
    origin: "http://localhost:8080",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  },
});

const sc = new sockerController()
// Handling Socket.IO connections
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  socket.on('establish', (data)=>{
    sc.establish(socket.id, data.user_id)
  })
  
  socket.on('disconnect', () => {
    sc.destroy(socket.id)
  });
});

// Start Bun HTTP Server
serve({
  port: PORT,
  fetch: async (request) => {
    const url = new URL(request.url);
    const headers = {
      "Access-Control-Allow-Origin": "http://localhost:8080",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
      "Access-Control-Allow-Credentials": "true",
    };

    if (request.method === "POST") {
      if (url.pathname.includes('/agency')) {
        const body = await request.formData();
        const operation = url.pathname.split("/")[2];
        const agency = new agencyController(operation, JSON.stringify(body));
        const result = await agency.resolve();
        return new Response(JSON.stringify(result), { headers });
      } else if (url.pathname.includes('/renters')) {
        const body = await request.formData();
        const operation = url.pathname.split("/")[2];
        const renter = new renterController(operation, JSON.stringify(body));
        const result = await renter.resolve();
        return new Response(JSON.stringify(result), { headers });
      }
    } else if (request.method === "GET") {
      if (url.pathname.includes('/agency')) {
        const body = JSON.parse(JSON.stringify(url.searchParams));
        const operation = url.pathname.split("/")[2];
        const agency = new agencyController(operation, JSON.stringify(body));
        const result = await agency.resolve();
        return new Response(JSON.stringify(result), { headers });
      } else if (url.pathname.includes('/renters')) {
        const body = JSON.parse(JSON.stringify(url.searchParams));
        const operation = url.pathname.split("/")[2];
        const renter = new renterController(operation, JSON.stringify(body));
        const result = await renter.resolve();
        return new Response(JSON.stringify(result), { headers });
      } else if (url.pathname.includes('/health')) {
        return new Response('OK', { status: 200 });
      }
    }

    return new Response('Not Found', { status: 404 });
  },
});

// Attach Socket.IO to the Bun server after it starts
console.log(`Listening on http://localhost:${PORT}`);
io.listen(PORT + 1); // Use a different port (3001) for WebSocket communication
