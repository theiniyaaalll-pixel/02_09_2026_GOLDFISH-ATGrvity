import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";
import os from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const httpServer = http.createServer(app);

const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, "..", "public");

app.use(express.static(publicDir));

const wss = new WebSocketServer({ server: httpServer });

const clients = new Set();

wss.on("connection", (socket) => {
  clients.add(socket);
  socket.send(JSON.stringify({ type: "connected", message: "Dream VR link ready" }));

  socket.on("message", (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }

    // Broadcast gesture commands to every other connected client.
    for (const client of clients) {
      if (client !== socket && client.readyState === 1) {
        client.send(JSON.stringify(message));
      }
    }
  });

  socket.on("close", () => clients.delete(socket));
});

function getLanAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const item of interfaces[name] || []) {
      if (item.family === "IPv4" && !item.internal) addresses.push(item.address);
    }
  }
  return addresses;
}

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log("\nDREAM VR Scene 1 is running.");
  console.log(`Laptop: http://localhost:${PORT}`);
  for (const ip of getLanAddresses()) {
    console.log(`Phone:  http://${ip}:${PORT}`);
  }
  console.log("\nKeep laptop and phone on the same Wi-Fi.\n");
});