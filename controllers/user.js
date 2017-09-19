const express = require('express');
const router = express.Router(); // eslint-disable-line
const bcrypt = require('bcryptjs');
const _ = require('lodash');
const config = require('config');
const nodemailer = require('nodemailer');
const requireAuth = require('../middlewares/requireAuth');
const User = require('../models/user');
const logger = require('../lib/logging');
const passport = require('passport');
const path = require('path');
const fs = require('fs');
const saml2 = require('saml2-js');
const Saml2js = require('saml2js');
const LocalStrategy = require('passport-local').Strategy;

passport.use(new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password',
}, function(username, password, done) {
  if (username.endsWith('ibm.com'))
    return done(null, false, {
      message: 'IBMers please login using the w3id button',
    });
  User.getById(username, function(err, user) {
    if (err) {
      logger.warn('User.getById database error: ' + JSON.stringify(err));
      return done(null, false, {
        message: 'Database error',
      });
    }
    if (!user) {
      setTimeout(function() { // timeouts discourage brute force attacks
        return done(null, false, {
          message: 'Unknown user',
        });
      }, 1500);
    } else {
      if (user.validated === false)
        return done(null, false, {
          message: 'Account has not been validated yet.',
        });
      User.comparePassword(password, user.password, function(err, isMatch) {
        if (err) {
          logger.warn('User.comparePassword error: ' + JSON.stringify(err));
          return done(null, false, {
            message: 'Application error',
          });
        }
        if (isMatch) {
          user.count = user.count + 1;
          user.lastLogin = new Date();
          User.update(user, function(err, doc) {});
          return done(null, user);
        } else {
          setTimeout(function() {
            return done(null, false, {
              message: 'Invalid passsword',
            });
          }, 1500);
        }
      });
    } // else !user
  });
}));

passport.serializeUser(function(user, done) {
  User.creatIfNew(user, function(err, user) {
    logger.debug('serializeUser: ' + JSON.stringify(user));
    done(null, user._id);
  });
});

passport.deserializeUser(function(id, done) {
  User.getPublicById(id, function(err, user) {
    done(err, user);
  });
});

// setup mailer for validation emails
const transporter = nodemailer.createTransport(config.get('mailer.url'));
const pleaseRegister = transporter.templateSender({
  bcc: config.get('mailer.admin'),
  subject: 'Please confirm your registration',
  html: 'Hello <strong>{{name}}</strong>,<br> Please click on the link to verify your email for access to The Imp.<br><a href={{link}}>Click here to verify</a>',
  from: 'sender@example.com',
});

router.get('/register', function(req, res) {
  res.render('register.jade', {
    csrfToken: req.csrfToken(),
  });
});

router.post('/register', function(req, res) {
  const disabled = config.get('disbableRegistrations');
  logger.debug("Disabled: " + disabled);
  if (disabled) {
    res.render('register.jade', {
      csrfToken: req.csrfToken(),
      info_msg: ['New registrations are currently disabled. Your details have not been saved.'],
    });
  } else {
    if (req.body.password1 !== req.body.password2)
      res.render('register.jade', {
        csrfToken: req.csrfToken(),
        error_msg: ['Passwords do not match'],
      });
    else {
      const id = req.body.email;
      const fn = req.body.firstName;
      const ln = req.body.lastName;
      const pw = req.body.password1;
      const vt = req.csrfToken(); // not really a csrfToken, just a random string for validation email

      const newUser = new User(id, fn, ln, pw, vt);
      const link = 'http://' + req.get('host') + '/verify?id=' + id + '&tk=' + vt;

      pleaseRegister({
          to: id,
        }, {
          name: fn,
          link: link,
        },
        function(error, response) {
          if (error) {
            logger.warn('Registration email error: ' + error.message);
            req.flash('error_msg', 'Failed to send registraion email.')
            res.redirect('/register')
          } else {
            User.create(newUser, function(err, id) {
              if (err) {
                res.render('register.jade', {
                  csrfToken: req.csrfToken(),
                  error_msg: [err.message],
                });
              } else {
                req.flash('success_msg', 'Registration email sent to ' + id);
                res.redirect('/prevalidate?email=' + id);
              }
            });
          }
        });
    }
  }
});

router.get('/verify', function(req, res) {
  if (req.query.id) {
    User.getPublicById(req.query.id, function(err, user) {
      if (!err && typeof user._id !== 'undefined') {
        if (user.validationToken !== 'undefined' &&
          req.query.tk === user.validationToken) {
          user.validated = true;
          delete user.validationToken;
          User.update(user, function(err, u2) {
            req.flash('success_msg', 'Email ' + user._id + ' has been verified');
            res.redirect('/login');
          });
        } else {
          req.flash('error_msg', 'Validation tokens do not match.');
          res.redirect('/fatal');
        }
      } else {
        req.flash('error_msg', 'Account email id verification failed.');
        res.redirect('/fatal');
      }
    });
  } else {
    req.flash('error_msg', 'Account email id verification failed.');
    res.redirect('/fatal');
  }
});

router.get('/prevalidate', function(req, res) {
  res.render('prevalidate.jade', {
    email: req.query.email
  });
});

router.get('/login', function(req, res) {
  res.render('login.jade', {
    csrfToken: req.csrfToken(),
  });
});

/*
openssl genrsa -out key.pem 2048
openssl req -new -key key.pem -out csr.pem
openssl x509 -req -days 9999 -in csr.pem -signkey key.pem -out cert.pem
*/

var myKey = path.join(path.dirname(require.main.filename), "cert", "key.pem");
var myCert = path.join(path.dirname(require.main.filename), "cert", "cert.pem");
var myKeyFile = fs.readFileSync(myKey);
var myCertFile = fs.readFileSync(myCert);

var serverURLb = "mnsuk-demos.eu-gb.mybluemix.net";
var serverURL = "http://" + serverURLb;
var serverURLs = "https://" + serverURLb;
var partnerIDURL = serverURLs + ":443/metadata";
var entityURL = partnerIDURL + ".xml";
var loginpage = serverURL + "/login";
var loginURL = "https://w3id.alpha.sso.ibm.com/auth/sps/samlidp/saml20/logininitial?RequestBinding=HTTPPost&PartnerId=" + partnerIDURL + "&NameIdFormat=email&Target=" + serverURLs;
var sp_options = {
  entity_id: entityURL,
  private_key: myKeyFile.toString(),
  certificate: myCertFile.toString(),
  assert_endpoint: serverURLs + ":443/assert"
};
var sp = new saml2.ServiceProvider(sp_options);
var idp_options = {
  sso_login_url: loginURL,
  certificates: fs.readFileSync("cert/w3id.sso.ibm.com").toString()
};
var idp = new saml2.IdentityProvider(idp_options);

router.post('/login', function(req, res, next) {
  if (req.body._domain == 'registered') {
    logger.debug('Registered User');
    return next(); // use the passport.
  } else {
    logger.debug('w3id login entered');
    sp.create_login_request_url(idp, {}, function(err, login_url, request_id) {
      if (err != null)
        return res.send(500);
      res.redirect(login_url);
    });
  }
}, passport.authenticate('local', {
  successRedirect: '/launch',
  failureRedirect: '/login',
  failureFlash: true
}));

// Endpoint to retrieve metadata
router.get('/metadata', function(req, res) {
  res.type('application/xml');
  res.send(sp.create_metadata());
});


// Assert endpoint for when login completes
router.post('/assert', function(req, res) {
  //logger.debug('assert entered');
  var options = {
    request_body: req
  };
  var response = new Buffer(req.body.SAMLResponse || req.body.SAMLRequest, 'base64');
  var parser = new Saml2js(response);
  var userFromW3 = parser.toObject();
  logger.debug("w3user: " + JSON.stringify(userFromW3));
  var email = userFromW3.emailaddress;
  /*res.cookie('authenticated', email, {
    maxAge: 43200,
    httpOnly: true,
    signed: true
  });
  res.cookie('email', email, {
    maxAge: 43200
  }); */
  logger.debug('assert1 req.session: ' + JSON.stringify(req.session));
  logger.debug('assert1 req.user: ' + JSON.stringify(req.user));
  logger.debug('assert1 authenticated: ' + req.isAuthenticated());

  var newUser = new User(userFromW3.emailaddress, userFromW3.firstName, userFromW3.lastName, 'w3id', 'w3id');
  req.login(newUser, function(err) {
    if (err) {
      logger.debug('assert login err' + JSON.stringify(err));
      res.redirect('/login');
    }
    logger.debug('assert2 req.session: ' + JSON.stringify(req.session));
    logger.debug('assert2 req.user: ' + JSON.stringify(req.user));
    logger.debug('assert2 authenticated: ' + req.isAuthenticated());
    res.status(302).redirect('/launch');
    //res.redirect('/debug');
  });
});

router.get('/password', requireAuth, function(req, res) {
  res.render('password.jade', {
    csrfToken: req.csrfToken()
  });
});

router.post('/password', requireAuth, function(req, res) {
  if (req.body.newpassword1 !== req.body.newpassword2)
    res.render('password.jade', {
      csrfToken: req.csrfToken(),
      error_msg: ['New passwords do not match'],
    });
  else {
    User.getById(req.user._id, function(err, usr) {
      if (!err) {
        if (bcrypt.compareSync(req.body.existingpassword, usr.password)) {
          var salt = bcrypt.genSaltSync(10);
          var hash = bcrypt.hashSync(req.body.newpassword1, salt);
          req.user.password = hash;
          User.update(req.user, function(err, id) {});
          req.flash('success_msg', 'Password updated');
          res.redirect('/chat');
        } else {
          res.render('password.jade', {
            csrfToken: req.csrfToken(),
            error_msg: ['Invalid existing password'],
          });
        }
      }
    });
  }
});

router.get('/logout', requireAuth, function(req, res) {
  req.logout();
  req.session.reset();
  res.redirect('/');
});

router.get('/audit', requireAuth, function(req, res) {
  logger.debug("/Audit");
  User.auditGet(req.query.app, function(err, usage) {
    if (usage) {
      logger.debug("AuditGet: " + JSON.stringify(usage));
      if (usage[req.user._id]) {
        usage[req.user._id] = {
          count: usage[req.user._id].count + 1,
          first: usage[req.user._id].first,
          last: new Date()
        };
      } else {
        usage[req.user._id] = {
          count: 1,
          first: new Date(),
          last: new Date()
        };
      }
      if (_.isNil(usage.count))
        usage.count = 1;
      else
        usage.count = usage.count + 1;
      User.auditUpdate(usage, function(err, usage) {
        res.status(200).send('ok');
      })
    } else {
      logger.debug("AuditGet: no usage");
    }
  });
});

router.get('/auditRedirect', requireAuth, function(req, res) {
  logger.debug("/Audit");
  User.auditGet(req.query.app, function(err, usage) {
    if (usage) {
      logger.debug("AuditGet: " + JSON.stringify(usage));
      if (usage[req.user._id]) {
        usage[req.user._id] = {
          count: usage[req.user._id].count + 1,
          first: usage[req.user._id].first,
          last: new Date()
        };
      } else {
        usage[req.user._id] = {
          count: 1,
          first: new Date(),
          last: new Date()
        };
      }
      if (_.isNil(usage.count))
        usage.count = 1;
      else
        usage.count = usage.count + 1;
      User.auditUpdate(usage, function(err, usage) {
        // res.status(200).send('ok');
      })
    } else {
      logger.debug("AuditGet: no usage");
    }
  });
  res.redirect(req.query.route);
});

module.exports = router;
