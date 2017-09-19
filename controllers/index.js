const express = require('express');
const router = express.Router(); // eslint-disable-line new-cap
const requireAuth = require('../middlewares/requireAuth');
const config = require('config');
const logger = require('../lib/logging');
const getModels = require('../api/api').getModels
const uploadFileAndExtractEntitiesMW = require('../api/api').uploadFileAndExtractEntitiesMW
const uploadFileAndExtractEntitiesSampleMW = require('../api/api').uploadFileAndExtractEntitiesSampleMW
const uploadTextAndExtractEntities = require('../api/api').uploadTextAndExtractEntities

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

router.get('/launch', requireAuth, function(req, res) {
  res.render('launch', {
    csrfToken: req.csrfToken(),
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

router.post('/api/models', getModels)

//router.post('/api/upload-file-and-extract-entities', upload.single('file'), uploadFileAndExtractEntitiesMW)
router.post('/api/upload-file-and-extract-entities-sample', uploadFileAndExtractEntitiesSampleMW)
router.post('/api/upload-text-and-extract-entities', uploadTextAndExtractEntities)



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
