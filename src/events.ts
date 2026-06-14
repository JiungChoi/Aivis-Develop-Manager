import type { Request, Response } from 'express';

// Minimal SSE broker for desktop clients (dino pet). No extra runtime deps.
const clients = new Map<number, Response>();
let nextId = 1;

export type EventType = 'task:proposed' | 'task:decided' | 'info' | 'loop';

export const events = {
  /** Express handler: keeps the connection open and streams events. */
  handler(req: Request, res: Response): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(': connected\n\n');

    const id = nextId++;
    clients.set(id, res);

    // Heartbeat so proxies/tunnels don't drop the idle connection.
    const heartbeat = setInterval(() => res.write(': ping\n\n'), 25_000);
    req.on('close', () => {
      clearInterval(heartbeat);
      clients.delete(id);
    });
  },

  emit(type: EventType, data: unknown): void {
    const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of clients.values()) res.write(payload);
  },

  clientCount(): number {
    return clients.size;
  },
};
