// Een heel kleine WebSocket-server zonder extra pakketten.
// Alleen wat de brug en de nagebouwde Trackman nodig hebben: verbindingen
// accepteren en tekstberichten sturen. Berichten van de browser negeren we,
// behalve 'sluiten' en 'ping'.

import { createServer } from "node:http";
import { createHash } from "node:crypto";

export function createWsServer(port, { onConnect } = {}) {
  const clients = new Set();
  const server = createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Dit is een WebSocket-server van Eigen Baan. Verbind vanuit de app.\n");
  });

  server.on("upgrade", (req, socket) => {
    const key = req.headers["sec-websocket-key"];
    if (!key) { socket.destroy(); return; }
    const accept = createHash("sha1").update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\nConnection: Upgrade\r\n" +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );
    clients.add(socket);
    socket.on("data", (buf) => {
      const opcode = buf[0] & 0x0f;
      if (opcode === 8) socket.end(); // sluiten
      if (opcode === 9) socket.write(Buffer.from([0x8a, 0x00])); // ping -> pong
    });
    socket.on("close", () => clients.delete(socket));
    socket.on("error", () => clients.delete(socket));
    onConnect?.(socket, clients.size);
  });

  server.listen(port);

  return {
    clients,
    /** Stuurt een object als JSON-tekst naar alle verbonden browsers. */
    send(obj) {
      const data = Buffer.from(JSON.stringify(obj));
      const len = data.length;
      let header;
      if (len < 126) header = Buffer.from([0x81, len]);
      else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 126; header.writeUInt16BE(len, 2); }
      else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2); }
      for (const c of clients) c.write(Buffer.concat([header, data]));
    },
    close() { for (const c of clients) c.end(); server.close(); },
  };
}
