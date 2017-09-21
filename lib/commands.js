'use strict';
const logger = require('./logging');
const config = require('config');

const Cloudant = require('cloudant');
const cloudant = Cloudant({ // eslint-disable-line new-cap
  instanceName: 'ibmwatson-nlc-cloudant',
  vcapServices: global.appEnv.services,
});
const db = cloudant.db.use(config.get('botmasterDB'));
const utils = require('./utils');
const _ = require('lodash');

// provides an immediately executed named function
// (as opposed to usual anonymous) to support reload()
const wsLoad = (function() {
  let _wsById = {};
  let _wsByName = {};
  const MyConstructor = function() {
    this.getWsById = function() {
      return _wsById;
    };
    this.getWsByName = function() {
      return _wsByName;
    };
    this.load = function() {
      db.get('config', function(err, doc) {
        const ws = doc.workspaces;
        _wsById = {};
        _wsByName = {};
        for (let i = 0, len = ws.length; i < len; i++) {
          _wsById[ws[i].value] = ws[i];
          _wsByName[ws[i].name] = ws[i];
        }
        // start_workspace = wsById['Setup'];
      });
    };
  };
  const mc = new MyConstructor();
  mc.load();
  return mc;
})();


/**
 * Execute bot command
 *
 * @param {string} command
 * @param {object} sessions
 * @param {object} cb
 *
 */
module.exports = function(bot, update) {
  const sessions = update.sessions;
  const params = update.message.text.split(' ');
  /* eslint-disable indent */
  switch (params[0].toLowerCase()) {
    case '/status':
      status(sessions, (err, text) => {
        utils.sendMessage(bot, update, !err ? [text] : ['command error']);
      });
      break;
    case '/stop':
    case '/start':
    case '/end':
    case '/reset':
      reset(sessions, (err, text) => {
        utils.sendMessage(bot, update, !err ? [text] : ['command error']);
      });
      break;
    case '/forgetme':
      forgetme(sessions, (err, text) => {
        utils.sendMessage(bot, update, !err ? [text] : ['command error']);
      });
      break;
    case '/list':
      list(sessions, (err, text) => {
        utils.sendMessage(bot, update, !err ? [text] : ['command error']);
      });
      break;
    case '/xxx':
    case '/help':
      // utils.sendMessage(bot, update, ['status, reset, forgetme, list, use, reload, help']);
      help(sessions, (err, text) => {
        utils.sendMessage(bot, update, !err ? [text] : ['command error']);
      });
      break;
    case '/use':
      use(params[1], sessions, (err, text) => {
        utils.sendMessage(bot, update, !err ? [text] : ['command error']);
      });
      break;
    case '/reload':
      wsLoad.load();
      utils.sendMessage(bot, update, ['Applications loaded']);
      break;

    case '/version':
      utils.sendMessage(bot, update, [config.get('version')]);
      break;
    default:
      utils.sendMessage(bot, update, ['no such command']);
      break;
  }
  /* eslint-enable indent */
};

const status = function(sessions, cb) {
  if (_.has(sessions, 'current.workspace_id')) {
    const ws = sessions.current.workspace_id;
    if (ws.length > 1) {
      cb(null, 'You\'re currently in the ' + wsLoad.getWsById()[ws].name + ' conversation.');
    } else {
      cb(null, 'No conversation has started yet. Say hi.');
    }
  } else {
    cb(null, 'No conversation has started yet. Say hi.');
  }
};

// eslint-disable-next-line
const textList = function(sessions, cb) {
  let final = [];
  const wsl = Object.keys(wsLoad.getWsById());
  for (let i = 1; i <= wsl.length; i++) {
    if (wsLoad.getWsById()[wsl[i - 1]].visible) {
      final.push(i + '. ' + wsLoad.getWsById()[wsl[i - 1]].name);
    }
  }
  cb(null, final.join('<br>'));
};

const list = function(sessions, cb) {
  if (_.has(sessions, 'current.workspace_id')) {
    const ws = sessions.current.workspace_id;
    const context = sessions.contexts[ws] ? sessions.contexts[ws] : {};
    let final = [];
    const wsl = Object.keys(wsLoad.getWsById());
    for (let i = 1; i <= wsl.length; i++) {
      const wsi = wsLoad.getWsById()[wsl[i - 1]];
      if (wsi.visible) {
        final.push({
          title: wsi.name,
          payload: '/use ' + wsi.name,
        });
      }
    }
    context.buttons = final;
    cb(null, 'Available applications');
  } else {
    cb(null, 'I can\'t currently find any applications');
  }
};

const help = function(sessions, cb) {
  if (_.has(sessions, 'current.workspace_id')) {
    const ws = sessions.current.workspace_id;
    const context = sessions.contexts[ws] ? sessions.contexts[ws] : {};
    let urls = [];
    //url: global.appEnv.url.replace(/https/, 'http') + '/help',
    urls.push({
      title: 'Press to access',
      url: global.appEnv.url + '/help',
      view: 'tall',
    });
    context.urls = urls;
    cb(null, 'Help for The Imp');
  } else {
    cb(null, 'Can\'t find current application.');
  }
}

// check what gets persisted. Is context against correct ws id?
// nothing overridden?
const use = function(name, sessions, cb) {
  const newWs = wsLoad.getWsByName()[name];
  if (newWs) {
    sessions.current.workspace_id = newWs.value;
    cb(null, 'Switching to application ' + newWs.name);
  } else {
    cb(null, 'Application "' + name + '" not found. Staying put.');
  }
};

const reset = function(sessions, cb) {
  const ws = sessions.current.workspace_id;
  if (sessions.contexts[ws].env) {
    const tmp = sessions.contexts[ws].env;
    delete sessions.contexts[ws];
    sessions.contexts[ws] = {
      env: tmp,
    };
  } else {
    delete sessions.contexts[ws];
  }
  cb(null, 'Resetting conversation.');
};

const forgetme = function(sessions, cb) {
  const ws = sessions.current.workspace_id;
  sessions.contexts = {};
  sessions.current = {
    workspace_id: config.get('masterWorkspace'),
  };
  cb(null, 'You\'re forgotten.');
};
