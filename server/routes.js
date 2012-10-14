var db = require('./lib/db'),
    https = require('https'),
    qs = require('querystring');

exports.setup = function (app) {

app.get('/', function (req, res) {
    // currrentUser must be formatted for direct output in JS
    // so null or "alice@example.com"
    var cu = req.session.email ? '"' + req.session.email + '"' : "null";
    console.log(cu);
    var ctx = {
        currentUser: cu
    };
    console.log(req.session);
    res.render('home.html', ctx);

});

app.post('/create', function (req, res) {
  var subject = req.body.subject;
  var body = req.body.body;
  db.createRoom(req.session.email, subject, function (err, roomId) {
    if (err) {
        res.send(err, 500);
    } else {
        res.send(roomId);
    }
  });
});

app.post('/profile', function (req, res) {
    db.updateProfile(req.session.email, req.body.name, function (err) {
        if (err) {
            res.send('Unable to update profile: ' + err, 500);
        } else {
            res.send('OK');
        }
    });
});

// Persona Authentication
app.post('/auth/login', function (req, res) {
    var suc = function (email) {
        req.session.email = email;
        db.getProfile(email, function (err, profile) {
            if (err) {
                res.send('Auth okay, unable to talk to DB', 500);
            } else {
                res.contentType('json');
                res.send(JSON.stringify({
                    email: email,
                    name: profile.name
                }));
            }

        });

    };
    var sent = false;
    var fail = function () {
        if (! sent) res.send('FAIL', 401);
        sent = true;
    };
    var postBody = qs.stringify({
        assertion: req.body.assertion,
        audience: 'http://192.168.186.138:9714'
    });
    var opts = {
        host: 'verifier.login.persona.org',
        port: 443,
        path: '/verify',
        method: 'POST',
        headers: {
            'Content-Length': postBody.length,
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    };
    var d = '';
    var verifier = https.request(opts, function (res){
        if (200 === res.statusCode) {
            res.setEncoding('utf8');
            res.on('data', function(data) {
                d += data;
              });
            res.on('end', function (a, b, c) {
                var verified = JSON.parse(d);
                if ("okay" === verified.status &&
                    !! verified.email) {
                    suc(verified.email);
                } else {
                    fail();
                }
            });
        } else {
            console.log('STATUS: ' + res.statusCode);
            console.log('HEADERS: ' + JSON.stringify(res.headers));
            fail();
        }
    });
    verifier.write(postBody);
    verifier.on('error', function (e) {
        console.error(e);
        fail();
    });
    verifier.end();
});

app.post('/auth/logout', function (req, res) {
  console.log('Logging user out');
  req.session.reset();
  res.send('OK');
});

};// exports