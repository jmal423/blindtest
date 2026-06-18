import net from 'node:net';
import { Client } from 'ssh2';

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH connected');
  const server = net.createServer((localSocket) => {
    conn.forwardOut('localhost', 5433, 'localhost', 5432, (err, remoteStream) => {
      if (err) { console.error('forward error:', err.message); localSocket.destroy(); return; }
      localSocket.pipe(remoteStream).pipe(localSocket);
    });
  });
  server.listen(5433, '127.0.0.1', () => {
    console.log('Tunnel: localhost:5433 -> remote:5432');
    // Update .env to use tunnel port
    process.env.DATABASE_URL = 'postgresql://blindtest_user:blindtest_pass@localhost:5433/blindtest';
    // Run classifier
    import('./src/index.js');
  });
});
conn.connect({ host: '192.168.1.49', port: 22, username: 'jalfaiat', password: 'Eelflpbqjv2003!' });
