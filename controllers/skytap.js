const express = require('express');
const router = express.Router();
const config = require('config');
const requireAuth = require('../middlewares/requireAuth');
const Skytap = require('node-skytap');
const logger = require('../lib/logging');
const _ = require('lodash');

var skytapConf = config.get('skytap.credentials');
var csideConf = config.get('cside.credentials');

var params = {
  username: process.env.skytapUsername || skytapConf.username,
  password: process.env.skytapPassword || skytapConf.password,
};

var skytap = Skytap.init(params);

var skyApps = {
  reevoo: config.get('skytap.reevoo'),
  case: config.get('skytap.case'),
  nhtsa: config.get('skytap.nhtsa'),
};

params = {
  username: process.env.csideUsername || csideConf.username,
  password: process.env.csidePassword || csideConf.password,
};

var cside = Skytap.init(params);

var csideApps = {
  gdpr: config.get('cside.gdpr'),
};


router.get('/status/:skyApp', requireAuth, function(req, res) {
  if (!_.isNil(csideApps[req.params.skyApp])) {
    cside.environments.get({
      configuration_id: csideApps[req.params.skyApp].env,
      multiselect: csideApps[req.params.skyApp].vms,
      keep_idle: true
    }, function(err, env) {
      if (err) {
        res.status(200).send('Err: ' + err.error);
      } else {
        logger.debug("Cside: " + JSON.stringify(env));
        const cm = env.vms.find(o => o.id === csideApps[req.params.skyApp].vms[0]).runstate;
        const wex = env.vms.find(o => o.id === csideApps[req.params.skyApp].vms[1]).runstate;
        logger.debug("Cside: cm " + cm + ' wex: ' + wex);
        // aggregate states busy > stopped > suspended > running > unknown
        state = 'unknown';
        if (cm == 'running' && wex == 'running')
          state = 'running';
        if (cm == 'suspended' || wex == 'suspended')
          state = 'suspended';
        if (cm == 'stopped' || wex == 'stopped')
          state = 'stopped';
        if (cm == 'busy' || wex == 'busy')
          state = 'busy';
        res.status(200).send(state);
      }
    })
  } else if (!_.isNil(skyApps[req.params.skyApp])) {
    skytap.environments.get({
      configuration_id: skyApps[req.params.skyApp],
      keep_idle: true
    }, function(err, env) {
      if (err) {
        res.status(200).send('Err: ' + err.error);
      } else {
        res.status(200).send(env.runstate);
      }

    })
  } else {
    res.status(200).send('Err: no such app');
  }
});

router.get('/start/:skyApp', requireAuth, function(req, res) {
  logger.debug("start " + skyApps[req.params.skyApp]);
  if (req.user.admin == true || req.user._id.substr(req.user._id.length - 8) == '.ibm.com') {
    if (!_.isNil(csideApps[req.params.skyApp])) {
      logger.debug("start " + csideApps[req.params.skyApp].env);
      cside.environments.start({
        configuration_id: csideApps[req.params.skyApp].env,
        multiselect: csideApps[req.params.skyApp].vms,
      }, function(err, env) {
        res.status(200).send('ok');
      })
    } else if (!_.isNil(skyApps[req.params.skyApp])) {
      logger.debug("start " + skyApps[req.params.skyApp]);
      skytap.environments.start({
        configuration_id: skyApps[req.params.skyApp]
      }, function(err, env) {
        res.status(200).send('ok');
      })
    } else {
      res.status(200).send('Err: no such app');
    }
  } else {
    res.status(403).send('Forbidden');
  }
});

router.get('/pause/:skyApp', requireAuth, function(req, res) {
  if (req.user.admin == true || req.user._id.substr(req.user._id.length - 8) == '.ibm.com') {
    if (!_.isNil(csideApps[req.params.skyApp])) {
      logger.debug("suspend " + csideApps[req.params.skyApp].env);
      cside.environments.suspend({
        configuration_id: csideApps[req.params.skyApp].env,
        multiselect: csideApps[req.params.skyApp].vms,
      }, function(err, env) {
        res.status(200).send('ok');
      })
    } else if (!_.isNil(skyApps[req.params.skyApp])) {
      logger.debug("suspend " + skyApps[req.params.skyApp]);
      skytap.environments.suspend({
        configuration_id: skyApps[req.params.skyApp]
      }, function(err, env) {
        res.status(200).send('ok');
      })
    } else {
      res.status(200).send('Err: no such app');
    }
  } else {
    res.status(403).send('Forbidden');
  }
});

module.exports = router;
