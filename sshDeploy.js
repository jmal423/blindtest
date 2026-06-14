const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec('cd blindtest && git pull && cd frontend && npm install && npm run build && cd .. && echo Eelflpbqjv2003! | sudo -S systemctl restart blindtest-frontend.service blindtest-backend.service', (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).connect({
  host: '192.168.1.49',
  port: 22,
  username: 'jalfaiat',
  password: 'Eelflpbqjv2003!'
});
