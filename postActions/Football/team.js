'use strict';
const fd = require('../../lib/football-data');
const _ = require('lodash');
const Promise = require('bluebird');
const logger = require('../../lib/logging');

module.exports = {
  controller: function(params, cb) {
    fd.getTeamByName(params.content).then(function(res1) {
      if (res1 != null) {
        let idx = 0;
        if (res1.count > 1) // getTeamByName is fuzzy, do exact match on results set
          idx = _.findIndex(res1.teams, (o) => {
          return o.name === params.content;
        });
        const ws = params.context.current.workspace_id;
        const context = params.context.contexts[ws];
        context.app.Season = res1.teams[idx].currentCompetition;
        context.app.League = res1.teams[idx].currentLeague;
        let b = fd.getCompetitionById(res1.teams[idx].currentCompetition);
        let c = fd.getTeamById(res1.teams[idx].id);
        return Promise.join(b, c, function(resultB, resultC) {
          return {
            caption: resultB.caption,
            crest: resultC.crestUrl,
          };
        });
      } else {
        return cb(null, 'Sorry I can\'t tell at the moment.');
      }
    }).then(function(res2) {
      const ws = params.context.current.workspace_id;
      const context = params.context.contexts[ws];
      // res2.crest
      const a = res2.crest.lastIndexOf('/') + 1;
      const b = res2.crest.lastIndexOf('.');
      const team = res2.crest.substring(a, b);
      context.image = {
        url: 'http://theimp.eu-gb.mybluemix.net/images/crests/' + team + '.png',
      };
      return cb(null, 'Ok, From now on I\'ll take it that when you say things like ' +
        '"us", "our" and "we" you mean ' + params.content + ' in the ' + res2.caption);
    }).catch(function(err) {
      return cb(err);
    });
  },
};
