let nluCustomEntitiesPromise = require('./nlu').nluCustomEntitiesPromise;
let nluModelsPromise = require('./nlu').nluModelsPromise;
// let greedyChunkBySentence = require('../util/util').greedyChunkBySentence
let mammoth = require('mammoth');
let fs = require('fs');
const logger = require('../lib/logging');

// eslint-disable-next-line
async function uploadFileAndExtractEntitiesMW(req, res, next) {
  logger.debug('uploadFileAndExtractEntitiesMW');
  let text = 'x';
  try {
    if (req.file.originalname.match(/.*.txt$/)) {
      logger.debug('regex' + req.file.buffer);
      const buf = text = req.file.buffer;
      text = buf.toString();
      logger.debug('text: ' + text + 'XXX of length: ' + text.length);
    } else if (req.file.originalname.match(/(.*.docx$)/)) {
      logger.debug('mammoth');
      try {
        text = (await mammoth.extractRawText(req.file.buffer)).value;
        logger.debug('text length2: ') + text.length;
      } catch (e) {
        logger.debug('e1');
        res.status(500).send('Invalid Doc Type');
      }
    }
  } catch (e) {
    logger.debug('e2');
    res.status(500).send('Error Extracting Text');
  }
  logger.debug('text again: ' + text + 'XXX of length: ' + text.length);
  if (!text) {
    logger.debug('e3');
    res.status(500).send('No Text Received');
  }
  sendChunksToNLU(text, req.body.username, req.body.password, req.body.model, res);
}

async function uploadFileAndExtractEntitiesSampleMW(req, res, next) {
  logger.debug('uploadFileAndExtractEntitiesSampleMW');
  let filename = './samples/' + req.body.filename;
  let text = '';
  try {
    if (filename.match(/.*.txt$/)) {
      text = fs.readFileSync(filename).toString();
      logger.debug('text: ' + text);
    } else if (filename.match(/(.*.docx$)/)) {
      try {
        text = (await mammoth.extractRawText(fs.readFileSync(filename))).value;
      } catch (e) {
        res.status(500).send('Invalid Doc Type');
      }
    } else {
      res.status(500).send('File Not Found');
    }
  } catch (e) {
    res.status(500).send('Error Extracting Text');
  }

  if (!text) {
    res.status(500).send('No Text Received');
  }
  sendChunksToNLU(text, req.body.username, req.body.password, req.body.model, res);
}

async function uploadTextAndExtractEntities(req, res, next) {
  try {
    if (!req.body.text) {
      res.status(500).send('No Text Received');
    }
    sendChunksToNLU(req.body.text, req.body.username, req.body.password, req.body.model, res);
  } catch (e) {
    if (e.code == 401) {
      res.status(401).send('Unauthorized');
    } else {
      res.status(500).send('Cannot connect to NLU service');
    }
  }
}

async function getModels(req, res, next) {
  let models;
  try {
    models = await nluModelsPromise(req.body.username, req.body.password);
  } catch (e) {
    if (e.code == 401) {
      res.status(401).send('Unauthorized');
    } else if (e.code == 500) {
      res.status(500).send('Cannot connect to NLU service');
    }
  }
  if (!req.body.username || !req.body.password) {
    res.status(500).send('Bad credentials');
  } else {
    res.status(200).send(models);
  }
}

async function sendChunksToNLU(text, username, password, model, res) {
  logger.debug('NLU - username: ' + username + ' pw: ' + password + ' model: ' + model);
  try {
    let chunks = greedyChunkBySentence(text);
    logger.info('Text was chunked into ' + chunks.length + ' parts');
    logger.debug('Chunks: ' + JSON.stringify(chunks));
    let nluResponses = [];
    let ret = {
      entities: [],
      relations: [],
      text: '',
    };
    for (let chunk of chunks) {
      ret.text += chunk;
      nluResponses.push(await nluCustomEntitiesPromise(chunk, username, password, model));
    }
    logger.debug('chunk1');
    for (let response of nluResponses) {
      if (response.entities) {
        ret.entities.push(...response.entities);
      }

      if (response.relations) {
        ret.relations.push(...response.relations);
      }
    }
    logger.debug('chunk2');
    ret.entities = ret.entities.filter((entity, index, self) => self.findIndex((t) => {
      logger.debug('chunk3');
      return t.type === entity.type && t.text === entity.text;
    }) === index);
    logger.debug('chunk: ' + JSON.stringify(ret));
    res.status(200).send(ret);
  } catch (e) {
    logger.debug('chunk e: ' + JSON.stringify(e));
    if (e.code == 401) {
      res.status(401).send('Unauthorized');
    } else {
      res.status(500).send('Cannot connect to NLU service');
    }
  }
}

function greedyChunkBySentence(text) {
  let maxChunkChars = 9800;
  let splitBySentence = text.split('. ');
  let greedyChunks = [];

  for (let chunk of splitBySentence) {
    // Check if the sentence itself is too big to chunk. if so, break it up by space
    if (chunk.length > maxChunkChars) {
      let splitBySpace = chunk.split(' ');
      for (let subChunk of splitBySpace) {
        if (greedyChunks.length > 0 && greedyChunks[greedyChunks.length - 1].length + subChunk.length < maxChunkChars) {
          greedyChunks[greedyChunks.length - 1] += ' ' + subChunk;
        } else {
          if (greedyChunks.length > 0) {
            greedyChunks[greedyChunks.length - 1] += ' ';
            greedyChunks.push(subChunk);
          } else {
            greedyChunks.push(subChunk);
          }
        }
      }
      continue;
    }

    // Otherwise do it by sentence
    if (greedyChunks.length > 0 && greedyChunks[greedyChunks.length - 1].length + chunk.length < maxChunkChars) {
      greedyChunks[greedyChunks.length - 1] += '. ' + chunk;
    } else {
      if (greedyChunks.length > 0) {
        greedyChunks[greedyChunks.length - 1] += '. ';
        greedyChunks.push(chunk);
      } else {
        greedyChunks.push(chunk);
      }
    }
  }
  return greedyChunks;
}

module.exports = {
  uploadFileAndExtractEntitiesMW,
  uploadFileAndExtractEntitiesSampleMW,
  uploadTextAndExtractEntities,
  getModels,
};
