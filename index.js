var LGControl = require('./lib/control.js');
var control = new LGControl('192.168.1.176');
control.requestCode(function() {
  control.auth('476132', function(a){
    control.sendCommand(26, function(a){
      console.log(a);
    })
  });
});
