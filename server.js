require("dotenv").config();
const express = require("express");
const next = require("next");
const { createServer } = require("http");
const { WebSocketServer } = require("ws");
const { createProxyMiddleware } = require("http-proxy-middleware");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();
const NEXT_PUBLIC_NEXT_PORT =
  parseInt(process.env.NEXT_PUBLIC_NEXT_PORT) || 3000;

const NEXT_PUBLIC_FASTAPI_PORT = process.env.NEXT_PUBLIC_FASTAPI_PORT || 8000;
const NEXT_PUBLIC_FASTAPI_URL = `${process.env.NEXT_PUBLIC_FASTAPI_IP}:${NEXT_PUBLIC_FASTAPI_PORT}`;
// const FASTAPI_WS_URL = `ws://${NEXT_PUBLIC_FASTAPI_URL}/ws`;

app.prepare().then(() => {
  const server = express();
  const httpServer = createServer(server);

  // 🌍 Proxy requests to FastAPI (if needed)
  server.use(
    "/proxy",
    createProxyMiddleware({
      target: `http://${NEXT_PUBLIC_FASTAPI_URL}`, // Your FastAPI backend
      changeOrigin: true,
    })
  );

  // // 🔌 Create WebSocket server
  // const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  // wss.on("connection", (clientSocket) => {
  //   console.log("🔌 WebSocket client connected");
  //   let retryDelay = 1000;
  //   let stayAliveInterval;
  //   const connectToFastAPI = () => {
  //     console.log("🔗 Connecting to FastAPI WebSocket...");
  //     clearInterval(stayAliveInterval); // Clear any existing interval
  //     // Connect to FastAPI WebSocket
  //     const fastapiSocket = new WebSocket(FASTAPI_WS_URL);

  //     fastapiSocket.on("open", () => {
  //       console.log("✅ Connected to FastAPI WebSocket");
  //       retryDelay = 1000; // Reset retry delay on successful connection
  //     });

  //     fastapiSocket.on("message", (message) => {
  //       //console.log("📩 Message from FastAPI:", message.toString());

  //       // Relay FastAPI response to the Next.js client
  //       if (clientSocket.readyState === WebSocket.OPEN) {
  //         clientSocket.send(message.toString());
  //       }
  //     });

  //     //if python closed connection...we need to try to reconnect
  //     fastapiSocket.on("close", () => {
  //       // console.log("❌ FastAPI WebSocket closed");
  //       if (clientSocket.readyState === WebSocket.OPEN) {
  //         clientSocket.send({
  //           type: "status",
  //           error:
  //             "❌ FastAPI WebSocket connection closed. Try to reconnect...",
  //         });
  //         clientSocket.close();
  //         // setTimeout(() => {
  //         //   console.log("🔄 Reconnecting to FastAPI WebSocket...");
  //         //   connectToFastAPI(); // Attempt to reconnect
  //         // }, retryDelay);
  //         // retryDelay = Math.min(retryDelay * 2, 30000); // max 30s
  //       }
  //     });

  //     fastapiSocket.on("error", (error) => {
  //       console.error("⚠️ FastAPI WebSocket Error:", error);
  //       //fastapiSocket.close(); //to try reconnect
  //     });

  //     stayAliveInterval = setInterval(() => {
  //       if (fastapiSocket.readyState === WebSocket.OPEN) {
  //         fastapiSocket.send("ping"); // Send a ping to keep the connection alive
  //       }
  //     }, 30000); // Ping every 30 seconds

  //     clientSocket.on("message", (message) => {
  //       //console.log("📤 Forwarding message to FastAPI:", message.toString());
  //       if (fastapiSocket.readyState === WebSocket.OPEN) {
  //         fastapiSocket.send(message.toString());
  //       }
  //     });

  //     //browser probably closed
  //     clientSocket.on("close", () => {
  //       //console.log("❌ WebSocket client disconnected");
  //       fastapiSocket.close();
  //     });

  //     clientSocket.on("error", (error) => {
  //       console.error("⚠️ Client WebSocket Error:", error);
  //     });
  //   };
  //   connectToFastAPI();
  // });

  // 📌 Handle Next.js requests
  server.all("*", (req, res) => {
    return handle(req, res);
  });

  // 🚀 Start server on port 3000
  httpServer.listen(NEXT_PUBLIC_NEXT_PORT, () => {
    console.log(
      `🚀 Server running at http://localhost:${NEXT_PUBLIC_NEXT_PORT}`
    );
    // console.log(
    //   `🔌 WebSocket listening at ws://localhost:${NEXT_PUBLIC_NEXT_PORT}/ws`
    // );
    console.log("🌍 FastAPI :", NEXT_PUBLIC_FASTAPI_URL);
  });
});
