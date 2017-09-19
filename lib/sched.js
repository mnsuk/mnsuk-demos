'use strict';
const LIVE = true;
const CronJob = require('cron').CronJob;
const fd = require('./football-data');
const logger = require('./logging');
const Promise = require('bluebird');
const _ = require('lodash');
const sendAlerts = require('./alert');
const UPDATE_INTERVAL = LIVE ? 120000 : 5000;
const season = '445'; // the premiership 2017/18

let messenger = null;
let socketio = null;

const init = function init(bm) {
  // Support alerts of match results through messenger
  messenger = bm.getBot({
    type: 'messenger',
  });
  socketio = bm.getBot({
    type: 'socketio',
  });

  logger.debug('Sched init');
  const jobAlert = new CronJob('06 06 06 * * *',
    function() {
      sched();
    },
    null,
    true, /* Start the job right now */
    null
  );
  jobAlert.start();
  sched();
  const endOfDay = new CronJob('59 59 23 * * *',
    function() {
      require('../models/alert').endOfDay((err, o) => {
        logger.debug('purge!');
      });
    },
    null,
    true, /* Start the job right now */
    null
  );
  endOfDay.start();
};

let teamsPlaying = [];
let i = 0;
/*
 * sched sets timer to the start of the first match, when that fires
 * an interval timer is set to poll for score changes and a further
 * timer is set to clear the interval timer when the games are
 * finished.
 */
const sched = function sched() {
  sendAlerts.reload();
  const now = new Date();
  if (!LIVE) {
    now.setFullYear(2017, 0, 14);
    now.setHours(12, 29, 55, 0);
    logger.debug('debug time: ' + now.toString());
  }
  logger.info('Sched cron: ' + now.toISOString());
  const todayStr = now.toISOString().substr(0, 10);
  const filters = {
    timeFrameStart: todayStr,
    timeFrameEnd: todayStr,
  };
  fd.getFixtures(season, filters).then(function(res) {
    if (res) {
      if (res.count > 0) {
        const spread = getStartStop(now, res.fixtures);
        logger.info('Match polling spread: ' + spread.start + ' to ' + spread.end);
        schedule(now, spread.start, filters)
          .then(function(intervalTimer) {
            return new Promise(function(resolve, reject) {
              const finishIn = LIVE ? spread.end - spread.start : 90000;
              logger.debug('Finish in: ' + (spread.end - spread.start) / 1000 + '(' +
                finishIn / 1000 + ') secs.');
              setTimeout(function() { // after the end of the last match
                resolve(intervalTimer);
              }, finishIn);
            });
          })
          .then(function(intTm) {
            logger.info('Cleared interval timer.');
            clearInterval(intTm);
          });
      } else {
        logger.debug('No games today.');
      }
    }
  }).catch(function(err) {
    logger.debug('Oops1.' + err);
  });
};

// eslint-disable-next-line
function schedule(now, time, filters) {
  const t = new Date(time);
  const diff = t - now;
  logger.debug('Set timer for: ' + diff / 1000 + ' seconds');
  return new Promise(function(resolve, reject) {
    setTimeout(
      function() {
        logger.debug('Timer fired, tick interval: ' + UPDATE_INTERVAL / 1000 + ' secs.');
        const tick = setInterval(() => {
          // check results on each tick.
          logger.debug('tick: ' + i);
          fd.getFixtures(season, filters).then(function(res) {
            if (res) {
              i = i + 1;
              let alerts = [];
              res.fixtures.forEach((item) => {
                let orig = _.find(teamsPlaying, {
                  'homeTeamName': item.homeTeamName,
                  'awayTeamName': item.awayTeamName,
                });
                // simulate some results for testing
                if (!LIVE) {
                  if (i > 2 && i < 11) {
                    item.status = 'IN_PLAY';
                  }
                  if (i > 2) {
                    item.result.goalsHomeTeam = 0;
                    item.result.goalsAwayTeam = 0;
                  }
                  if (i > 3 && item.homeTeamName == 'Burnley FC')
                    item.result.goalsHomeTeam = 1;
                  if (i > 5 && item.homeTeamName == 'Burnley FC')
                    item.result.goalsAwayTeam = 1;
                  if (i > 5 && item.awayTeamName == 'Arsenal FC')
                    item.result.goalsAwayTeam = 1;
                  if (i > 6 && item.homeTeamName == 'Burnley FC')
                    item.result.goalsAwayTeam = 2;
                  if (i > 8 && item.homeTeamName == 'Tottenham Hotspur FC')
                    item.status = 'FINISHED';
                  if (i > 9 && item.homeTeamName.length > 12)
                    item.status = 'FINISHED';
                  if (i > 10)
                    item.status = 'FINISHED';
                }
                if (item.status != orig.status) {
                  orig.status = item.status;
                  orig.result.goalsHomeTeam = item.result.goalsHomeTeam;
                  orig.result.goalsAwayTeam = item.result.goalsAwayTeam;
                  /* eslint-disable */
                  switch (item.status) {
                    case 'IN_PLAY':
                      alerts.push({
                        type: 3,
                        fixture: orig,
                      });
                      break;
                    case 'FINISHED':
                      alerts.push({
                        type: 1,
                        fixture: orig,
                      });
                      break;
                  }
                  /* eslint-enable */
                } else {
                  if ((item.result.goalsHomeTeam != orig.result.goalsHomeTeam) ||
                    (item.result.goalsAwayTeam != orig.result.goalsAwayTeam)) {
                    orig.result.goalsHomeTeam = item.result.goalsHomeTeam;
                    orig.result.goalsAwayTeam = item.result.goalsAwayTeam;
                    alerts.push({
                      type: 2,
                      fixture: orig,
                    });
                  }
                }
              });
              if (alerts.length > 0) {
                sendAlerts(messenger, alerts);
                sendAlerts(socketio, alerts);
              }
            }
          }).catch(function(err) {
            logger.debug('Oops2.' + err);
          });
        }, UPDATE_INTERVAL);
        resolve(tick);
      },
      diff);
  });
}

// eslint-disable-next-line require-jsdoc
function getStartStop(now, fs) {
  let startTm = new Date(fs[0].date);
  if (startTm - now < 0) {
    startTm = _.clone(now);
    startTm.setMinutes(startTm.getMinutes() + 1);
  }
  let endTm = _.clone(startTm, true);
  teamsPlaying = _.clone(fs);
  endTm.setMinutes(endTm.getMinutes() + 120);
  fs.forEach((f) => {
    const tm = new Date(f.date);
    if (tm > startTm) {
      endTm = tm;
      endTm.setMinutes(endTm.getMinutes() + 120);
    }
  });
  return ({
    start: startTm,
    end: endTm,
  });
}

module.exports = {
  init: init,
};
