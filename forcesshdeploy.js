const { Client } = require('ssh2');

const conn = new Client();

const remoteScript = `
cd blindtest || exit 1
echo "Pulling latest changes..."
git pull

echo "--> Force Updating Backend"
cd backend && npm install && cd ..

echo "--> Force Updating Frontend"
cd frontend && npm install && npm run build && cd ..

echo "--> Force Updating Bot (if exists)"
if [ -d "bot" ]; then
  cd bot && npm install && cd ..
fi

echo "--> Restarting all services..."
echo Eelflpbqjv2003! | sudo -S systemctl restart blindtest-frontend.service blindtest-backend.service blindtest-bot.service || true
echo "--> Force deployment complete!"
`;

conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec(remoteScript, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
      conn.end();
    }).on('data', (data) => {
      process.stdout.write('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      process.stderr.write('STDERR: ' + data);
    });
  });
}).connect({
  host: '192.168.1.49',
  port: 22,
  username: 'jalfaiat',
  password: 'Eelflpbqjv2003!'
});
