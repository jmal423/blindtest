'use client';

import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

function getServerUrl(): string {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL;
  }
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    return `http://${hostname}:3001`;
  }
  return 'http://localhost:3001';
}

export function getSocket(): Socket {
  if (!socket) {
    socket = io(getServerUrl(), { autoConnect: false });
  }
  return socket;
}

export function getApiUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    return `http://${hostname}:3001`;
  }
  return 'http://localhost:3001';
}
