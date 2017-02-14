var Avanza = require('avanza');
console.log(Avanza);
var avanza = new Avanza();

// NOTE: use .once and not .on
avanza.socket.once('connect', function()  {
  avanza.socket.subscribe('5479', ['quotes']); // Telia
});

avanza.socket.on('quotes', function(data) {
  console.info('Received quote: ', data);
});

avanza.authenticate({
    username: '1367341',
    password: 'xbtl165x'
}).then(function()  {

  avanza.socket.initialize();

})
