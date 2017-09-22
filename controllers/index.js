const express = require('express');
const router = express.Router(); // eslint-disable-line new-cap
const requireAuth = require('../middlewares/requireAuth');
const config = require('config');
const logger = require('../lib/logging');
const _ = require('lodash');
const getModels = require('../api/api').getModels;
// eslint-disable-next-line max-len
const uploadFileAndExtractEntitiesMW = require('../api/api').uploadFileAndExtractEntitiesMW; // eslint-disable-line max-len
const uploadFileAndExtractEntitiesSampleMW = require('../api/api').uploadFileAndExtractEntitiesSampleMW; // eslint-disable-line max-len
const uploadTextAndExtractEntities = require('../api/api').uploadTextAndExtractEntities; // eslint-disable-line max-len
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
});

router.get('/', function(req, res) {
  res.render('index');
});

router.use('/', require('./user'));
router.use('/skytap', require('./skytap'));

router.get('/chat', requireAuth, function(req, res) {
  res.render('chat', {
    csrfToken: req.csrfToken(),
    impsvc: config.get('imp-svc'),
  });
});

//const targets = _.extend(config.get('skytap.watson.envs'), config.get('skytap.cside.envs'));
const targets = [];
config.get('skytap.cside.envs').forEach((entry) => {
  targets.push(entry);
});
config.get('skytap.watson.envs').forEach((entry) => {
  targets.push(entry);
});

logger.debug('targets:' + targets.length + ' ' + JSON.stringify(targets));
router.get('/launch', requireAuth, function(req, res) {
  res.render('launch', {
    csrfToken: req.csrfToken(),
    targets: targets,
  });
});

router.get('/wksnlu', requireAuth, function(req, res) {
  res.render('wksnlu');
});

router.get('/privacy', function(req, res) {
  res.render('privacy');
});

// Fix to allow bluemix to iFrame https in http and avoid X-Frame-Options errors.
router.get('/help',
  function(req, res, next) {
    res.setHeader('X-Frame-Options', 'ALLOW-FROM ' + global.appEnv.url);
    next();
  },
  function(req, res) {
    res.render('help');
  });

router.post('/api/models', getModels);

// eslint-disable-next-line max-len
router.post('/api/upload-file-and-extract-entities', upload.single('file'), uploadFileAndExtractEntitiesMW);
router.post('/api/upload-file-and-extract-entities-sample', uploadFileAndExtractEntitiesSampleMW); // eslint-disable-line max-len
router.post('/api/upload-text-and-extract-entities', uploadTextAndExtractEntities);

router.get('/debug', function(req, res) {
  logger.debug('debug req.session: ' + JSON.stringify(req.session));
  logger.debug('debug req.user: ' + JSON.stringify(req.user));
  logger.debug('debug authenticated: ' + req.isAuthenticated());
  res.render('debug', {
    csrfToken: req.csrfToken(),
    info_msg: ['req.user: ' + JSON.stringify(req.user)],
    warn_msg: ['req.session: ' + JSON.stringify(req.session)],
    success_msg: ['authenticated: ' + (req.isAuthenticated() ? 'TRUE' : 'FALSE')],
  });
});


router.get('/fatal', function(req, res) {
  res.render('fatal');
});

module.exports = router;
