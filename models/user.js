const bcrypt = require('bcryptjs');
const logger = require('../lib/logging');
const Cloudant = require('cloudant');
const config = require('config');
const cloudant = Cloudant({ // eslint-disable-line new-cap
  instanceName: 'ibmwatson-nlc-cloudant',
  vcapServices: global.appEnv.services,
});
const db = cloudant.db.use(config.get('authenticationDB'));
const auditDB = cloudant.db.use(config.get('auditDB'));

// eslint-disable-next-line no-unused-vars
const User = module.exports = function(id, fn, ln, pw, tok) {
  this._id = id;
  this.firstName = fn;
  this.lastName = ln;
  this.password = pw;
  this.validationToken = tok;
};

module.exports.create = function(user, cb) {
  bcrypt.genSalt(10, function(err, salt) {
    bcrypt.hash(user.password, salt, function(err, hash) {
      user.password = hash;
      user.count = 1;
      user.lastLogin = new Date();
      user.admin = false;
      user.validated = false;
      db.insert(user, function(err, body) {
        if (err) {
          if (err.statusCode === 409) {
            err = new Error('That email is already taken');
          }
          cb(err);
        } else {
          cb(null, body.id);
        }
      });
    });
  });
};

module.exports.getById = function(id, cb) {
  db.get(id, function(err, doc) {
    if (!err)
      cb(null, doc);
    else {
      if (err.statusCode === 404)
        cb(null, null); // user not found
      else {
        cb(err);
      }
    }
  });
};



module.exports.creatIfNew = function(user, cb) {
  db.get(user._id, function(err, doc) {
    if (!err) {
      logger.debug('XXX doc: ' + JSON.stringify(doc));
      doc.count = doc.count + 1;
      doc.lastLogin = new Date();
      User.update(doc, function(err, doc) {});
      cb(null, doc);
    } else {
      if (err.statusCode === 404) {
        // user not found
        logger.debug('XXX No user');
        user.password = 'w3id';
        user.count = 1;
        user.lastLogin = new Date();
        user.admin = false;
        user.validated = true;
        db.insert(user, function(err, body) {
          if (err) {
            logger.debug('XXX err: ' + JSON.stringify(err));
            if (err.statusCode === 409) {
              err = new Error('That email is already taken');
            }
            cb(err);
          } else {
            logger.debug('XXX body: ' + JSON.stringify(body));
            //cb(null, body);  // returns id, rev, ok
            cb(null, user); // return original user
          }
        });
      } else {
        logger.debug('XXX 2err: ' + JSON.stringify(err));
        cb(err);
      }
    }
  });
};

module.exports.getPublicById = function(id, cb) {
  db.get(id, function(err, doc) {
    if (!err) {
      delete doc.password;
      cb(null, doc);
    } else {
      if (err.statusCode === 404)
        cb(null, null); // user not found
      else {
        cb(err);
      }
    }
  });
};

module.exports.update = function(user, cb) {
  db.insert(user, function(err, body) {
    if (err) {
      if (err.statusCode === 409) {
        err = new Error('That email is already taken');
      }
      cb(err);
    } else {
      user._rev = body.rev;
      cb(null, user);
    }
  });
};

module.exports.comparePassword = function(candidate, hash, cb) {
  bcrypt.compare(candidate, hash,
    function(err, isMatch) {
      if (err) {
        logger.debug('Match error:' + JSON.stringify(err));
        cb(err);
      } else {
        logger.debug('Match answered:' + isMatch);
        cb(null, isMatch);
      }
    });
};

module.exports.auditGet = function(id, cb) {
  logger.debug("User auditGet: " + id);
  auditDB.get(id, function(err, doc) {
    if (err) {
      logger.debug("User auditGet error: " + JSON.stringify(err));
      return cb(err);
    }
    logger.debug("User auditGet ok: " + JSON.stringify(doc));
    cb(null, doc);
  })
}

module.exports.auditUpdate = function(usage, cb) {
  auditDB.insert(usage, function(err, body) {
    if (err) {
      var error = 'something bad happened';
      if (err.statusCode === 409) {
        error = 'That app is already taken';
      }
      cb(error);
    } else {
      usage._rev = body.rev;
      cb(null, usage);
    }
  });
};
