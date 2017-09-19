const csrf = require('csurf');
module.exports = function(req, res, next) {

  var csrfEnabled = true;
  var whiteList = new Array('/assert', '/api/models', '/api/upload-text-and-extract-entities');
  if (whiteList.indexOf(req.path) != -1) {
    csrfEnabled = false;
  }
  if (csrfEnabled) {
    csrf()(req, res, next);
  } else {
    next();
  }
}
