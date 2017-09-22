const express = require('express');
const router = express.Router(); // eslint-disable-line new-cap
const config = require('config');
const requireAuth = require('../middlewares/requireAuth');
const Skytap = require('node-skytap');
const logger = require('../lib/logging');
const _ = require('lodash');
const SKYTAPPOLL = 2500; // polling interval in milliseconds

// we have two Skytap environments
const watsonCred = config.get('skytap.watson.credentials');
const csideCred = config.get('skytap.cside.credentials');

const watsonSt = Skytap.init({
  username: process.env.watsonStUsername || watsonCred.username,
  password: process.env.watsonStPassword || watsonCred.password,
});

const csideSt = Skytap.init({
  username: process.env.csideStUsername || csideCred.username,
  password: process.env.csideStPassword || csideCred.password,
});

const watsonStApps = config.get('skytap.watson.envs');
const csideStApps = config.get('skytap.cside.envs');

const _envStatus = function _envStatus() {
  let _envs = [];
  const MyConstructor = function() {
    this.getEnvs = function() {
      return _envs;
    };
    this.getEnv = function(id) {
      return _envs.find((o) => o.id === id);
    };
    this.getSiteEnvs = function(site) {
      return _envs.filter((o) => o.site === site);
    };
    this.setEnvStatus = function(id, state) {
      let idx = _envs.findIndex((o) => o.id === id);
      let entry = _envs[idx];
      // logger.debug('setting ' + entry.id + ' to ' + state);
      entry.runstate = state;
      entry.update = Date.now();
      _envs[idx] = entry;
    };
    this.load = function() {
      watsonStApps.forEach((entry) => {
        let ne = _.clone(entry);
        delete ne.urls;
        ne.site = 'w';
        ne.runstate = 'unknown';
        ne.update = Date.now() - 60 * 1000; // make it a minute old
        _envs.push(ne);
      });
      csideStApps.forEach((entry) => {
        let ne = _.clone(entry);
        delete ne.urls;
        ne.site = 'c';
        ne.runstate = 'unknown';
        ne.update = Date.now() - 60 * 1000; // make it a minute old
        _envs.push(ne);
      });
    };
  };
  const _myInstance = new MyConstructor();
  _myInstance.load();
  return _myInstance;
};

let envStatus = _envStatus();

router.get('/status', function(req, res) {
  // logger.debug('Get Status');
  let allEnvs = envStatus.getEnvs();
  allEnvs.forEach((e) => {
    const now = Date.now();
    if ((now - e.update) < SKYTAPPOLL) // ping skytap only after 3 seconds
      return;
    let params = {
      configuration_id: e.env,
      keep_idle: true,
    };
    let numVms = 0;
    if (!_.isNil(e.vms)) {
      params.multiselect = e.vms;
      numVms = e.vms.length;
    }
    if (e.site === 'w') {
      // logger.debug('watsonSt call: ' + e.id);
      watsonSt.environments.get(params, function(err, env) {
        // logger.debug('watsonSt Response.' + e.id);
        if (err) {
          logger.warn('Skytap Watson error: ' + JSON.stringify(err));
          envStatus.setEnvStatus(e.id, 'unknown');
        } else {
          if (numVms === 0) {
            envStatus.setEnvStatus(e.id, env.runstate);
          } else {
            envStatus.setEnvStatus(e.id, calcEnvStatus(e, numVms, env));
          }
        }
      });
    }
    if (e.site === 'c') {
      // logger.debug('csideSt call: ' + e.id);
      csideSt.environments.get(params, function(err, env) {
        // logger.debug('csideSt Response: ' + e.id);
        if (err) {
          logger.warn('Skytap CSIDE error: ' + JSON.stringify(err));
          envStatus.setEnvStatus(e.id, 'unknown');
        } else {
          if (numVms === 0) {
            envStatus.setEnvStatus(e.id, env.runstate);
          } else {
            envStatus.setEnvStatus(e.id, calcEnvStatus(e, numVms, env));
          }
        }
      });
    }
  });
  res.status(200).send(envStatus.getEnvs());
});

let calcEnvStatus = function(myEnv, numVMs, envRes) {
  /*
     mfrom and mto map between state ids and numbers
     this allows for easy creation of a priority hierarchy.
     busy > stopped > suspended > running > unknown
     This in turn allows status from multiple vms to be aggregated
     to one highest priority value.
  */
  const mto = {
    running: 1,
    suspended: 2,
    stopped: 3,
    busy: 4,
  };
  const mfrom = ['unknown', 'running', 'suspended', 'stopped', 'busy'];
  if (numVMs === 0)
    return envRes.runstate;
  else {
    let rsi = 0;
    let maxrsi = 0;
    for (let i = 0; i < numVMs; i++) {
      const rs = envRes.vms.find((o) => o.id === myEnv.vms[i]).runstate;
      rsi = mto[rs];
      if (rsi > maxrsi)
        maxrsi = rsi;
    }
    return mfrom[maxrsi];
  }
};


router.get('/start/:skyApp', requireAuth, function(req, res) {
  // logger.debug('start' + req.params.skyApp);
  if (req.user.admin == true || req.user._id.substr(req.user._id.length - 8) == '.ibm.com') {
    const myApp = envStatus.getEnv(req.params.skyApp);
    if (!_.isNil(myApp)) {
      // logger.debug('start ' + myApp.id + '@' + myApp.env);
      let params = {
        configuration_id: myApp.env,
      };
      if (!_.isNil(myApp.vms))
        params.multiselect = myApp.vms;
      if (myApp.site === 'w') {
        watsonSt.environments.start(params, function(err, env) {
          if (err) {
            logger.warn('Skytap Watson error: ' + JSON.stringify(err));
            envStatus.setEnvStatus(myApp.id, 'Err: start');
            res.status(200).send('Err: start');
          } else {
            res.status(200).send('ok');
          }
        });
      }
      if (myApp.site === 'c') {
        csideSt.environments.start(params, function(err, env) {
          if (err) {
            logger.warn('Skytap CSIDE error: ' + JSON.stringify(err));
            envStatus.setEnvStatus(myApp.id, 'Err: start');
            res.status(200).send('Err: start');
          } else {
            res.status(200).send('ok');
          }
        });
      }
      envStatus.setEnvStatus(myApp.id, 'busy');
    } else {
      res.status(200).send('Err: no such app');
    }
  } else {
    res.status(403).send('Forbidden');
  }
});

router.get('/pause/:skyApp', requireAuth, function(req, res) {
  // logger.debug('start' + req.params.skyApp);
  if (req.user.admin == true || req.user._id.substr(req.user._id.length - 8) == '.ibm.com') {
    const myApp = envStatus.getEnv(req.params.skyApp);
    if (!_.isNil(myApp)) {
      // logger.debug('start ' + myApp.id + '@' + myApp.env);
      let params = {
        configuration_id: myApp.env,
      };
      if (!_.isNil(myApp.vms))
        params.multiselect = myApp.vms;
      if (myApp.site === 'w') {
        watsonSt.environments.suspend(params, function(err, env) {
          if (err) {
            logger.warn('Skytap Watson error: ' + JSON.stringify(err));
            envStatus.setEnvStatus(myApp.id, 'Err: suspend');
            res.status(200).send('Err: start');
          } else {
            res.status(200).send('ok');
          }
        });
      }
      if (myApp.site === 'c') {
        csideSt.environments.suspend(params, function(err, env) {
          if (err) {
            logger.warn('Skytap CSIDE error: ' + JSON.stringify(err));
            envStatus.setEnvStatus(myApp.id, 'Err: suspend');
            res.status(200).send('Err: start');
          } else {
            res.status(200).send('ok');
          }
        });
      }
      envStatus.setEnvStatus(myApp.id, 'busy');
    } else {
      res.status(200).send('Err: no such app');
    }
  } else {
    res.status(403).send('Forbidden');
  }
});

module.exports = router;
