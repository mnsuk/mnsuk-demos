let request = require('request')
  // let envVars = require('../env/env').envVars
let NaturalLanguageUnderstandingV1 = require('watson-developer-cloud/natural-language-understanding/v1.js');



function nluCustomEntitiesPromise(text, username, password, model) {
  return new Promise((resolve, reject) => {
    try {
      var nlu = new NaturalLanguageUnderstandingV1({
        username: username,
        password: password,
        version_date: NaturalLanguageUnderstandingV1.VERSION_DATE_2017_02_27
      });
    } catch (e) {
      reject({
        "code": 401,
        "error": "Bad credentials."
      })
    }
    var parameters = {
      'text': text,
      'features': {
        'entities': {
          'model': model
        },
        "relations": {
          'model': model
        }
      }
    }

    try {
      nlu.analyze(parameters, function(err, response) {
        if (err) {
          reject(err)
        } else {
          resolve(response)
        }
      });
    } catch (e) {
      reject(e)
    }
  })
}

function nluModelsPromise(username, password) {
  return new Promise((resolve, reject) => {
    try {
      var nlu = new NaturalLanguageUnderstandingV1({
        username: username,
        password: password,
        version_date: NaturalLanguageUnderstandingV1.VERSION_DATE_2017_02_27
      });
    } catch (e) {
      reject({
        "code": 401,
        "error": "Bad credentials."
      })
    }

    try {
      nlu.listModels({}, function(err, response) {
        if (err)
          reject(err)
        else {
          resolve(response)
        }
      });
    } catch (e) {
      reject(e)
    }
  })
}

module.exports = {
  nluCustomEntitiesPromise,
  nluModelsPromise
}
