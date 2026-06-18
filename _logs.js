const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec("journalctl -u blindtest-backend --since '5 min ago' --no-pager -n 30", (err, stream) => {
    if (err) throw err;
    stream.on('close', () => { conn.end(); })
      .on('data', d => process.stdout.write(d))
      .stderr.on('data', d => process.stderr.write(d));
  });
}).connect({ host: '192.168.1.49', port: 22, username: 'jalfaiat', password: 'Eelflpbqjv2003!' });
