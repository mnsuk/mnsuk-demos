const express = require('express');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const session = require('client-sessions');
// const csrf = require('csurf');
const usecsrf = require('../middlewares/usecsrf');
const cfenv = require('cfenv');
const config = require('config');
const passport = require('passport');
const flash = require('connect-flash');
const version = config.get('version');


module.exports = function(app) {
  // set appEnv as global (including vcap_services) from cf or local as appropriate
  const vcapServices = config.get('VCAP_SERVICES');
  const envOptions = {
    vcap: {
      services: vcapServices,
    },
  };
  global.appEnv = cfenv.getAppEnv(envOptions);

  /**
  app.configure('development', function(){
   app.use(express.errorHandler({dumpExceptions: true, showStack: true}))
  });
  app.configure('production', function(){
   app.use(express.errorHandler())
  });
  **/
  app.use(helmet());
  app.use(bodyParser.urlencoded({
    extended: true,
  }));

  // need to get the domain from the appEnv url to set the cookie to allow two websites
  const sessionEnv = {
    cookieName: 'session',
    secret: 'gsjdhhslfhflhlkhlfyuiufr',
    duration: 30 * 60 * 1000,
    activeDuration: 5 * 60 * 1000,
    cookie: {
      httpOnly: true,
      ephemeral: true,
      secure: false, // needs to be true when we setup https
    },
  };
  if (!global.appEnv.isLocal) {
    sessionEnv.cookie.domain = '.eu-gb.mybluemix.net';
  }
  app.use(session(sessionEnv));
  // app.use(csrf()); // new middleware selectively disables it.
  app.use(usecsrf);

  app.use(express.static(__dirname + '/../public'));
  app.set('view engine', 'jade');
  app.locals.pretty = true;
  app.use(passport.initialize());
  app.use(passport.session());

  // global variables
  app.use(flash());
  app.use(function(req, res, next) {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.info_msg = req.flash('info_msg');
    res.locals.warn_msg = req.flash('warn_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error'); // flash messages from passport
    res.locals.user = req.user || null;
    res.locals.version = version;
    res.locals.path = req.path;
    next();
  });

  // Routing
  app.use(require('../controllers'));
  app.get('*', function(req, res, next) {
    const err = new Error();
    err.status = 404;
    next(err);
  });
  app.use(function(err, req, res, next) {
    if (err.status !== 404) return next(err);
    res.status(404);
    res.send(err.message || 'Couldn\t find that page.');
  });
  app.use(function(err, req, res, next) {
    if (err.code !== 'EBADCSRFTOKEN') return next(err);
    // handle CSRF token errors here
    res.status(403);
    res.send('This page has expired, please login again.');
  });
  app.use(function(err, req, res, next) {
    res.status(500);
    res.send(err.message || 'Internal application error.');
  });
};
