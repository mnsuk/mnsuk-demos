let nluCustomEntitiesPromise = require('./nlu').nluCustomEntitiesPromise
let nluModelsPromise = require('./nlu').nluModelsPromise
  // let greedyChunkBySentence = require('../util/util').greedyChunkBySentence
let mammoth = require('mammoth')
let fs = require('fs')

async function uploadFileAndExtractEntitiesMW(req, res, next) {
  let text = ''
  try {
    if (req.file.originalname.match(/.*.txt$/)) {
      text = req.file.buffer.toString()
    } else if (req.file.originalname.match(/(.*.docx$)/)) {
      try {
        text = (await mammoth.extractRawText(req.file.buffer)).value
      } catch (e) {
        res.status(500).send('Invalid Doc Type')
      }
    }
  } catch (e) {
    res.status(500).send('Error Extracting Text')
  }

  if (!text) {
    res.status(500).send('No Text Received')
  }
  sendChunksToNLU(text, req.body.username, req.body.password, req.body.model, res)
}

async function uploadFileAndExtractEntitiesSampleMW(req, res, next) {
  console.log(req.body.model)
  let filename = './samples/' + req.body.filename
  let text = ''
  try {
    if (filename.match(/.*.txt$/)) {
      text = fs.readFileSync(filename).toString()
    } else if (filename.match(/(.*.docx$)/)) {
      try {
        text = (await mammoth.extractRawText(fs.readFileSync(filename))).value
      } catch (e) {
        res.status(500).send('Invalid Doc Type')
      }
    } else {
      res.status(500).send('File Not Found')
    }
  } catch (e) {
    res.status(500).send('Error Extracting Text')
  }

  if (!text) {
    res.status(500).send('No Text Received')
  }
  sendChunksToNLU(text, req.body.username, req.body.password, req.body.model, res)
}

async function uploadTextAndExtractEntities(req, res, next) {
  try {
    if (!req.body.text) {
      res.status(500).send('No Text Received')
    }
    sendChunksToNLU(req.body.text, req.body.username, req.body.password, req.body.model, res)
  } catch (e) {
    if (e.code == 401) {
      res.status(401).send('Unauthorized')
    } else {
      res.status(500).send('Cannot connect to NLU service')
    }
  }
}

async function getModels(req, res, next) {
  var models;
  try {
    models = await nluModelsPromise(req.body.username, req.body.password);
  } catch (e) {
    if (e.code == 401) {
      res.status(401).send('Unauthorized')
    } else if (e.code == 500) {
      res.status(500).send('Cannot connect to NLU service')
    }
  }
  if (!req.body.username || !req.body.password) {
    res.status(500).send('Bad credentials')
  } else {
    res.status(200).send(models);
  }
}

async function sendChunksToNLU(text, username, password, model, res) {
  try {
    let chunks = greedyChunkBySentence(text)
    console.log('Text was chunked into ' + chunks.length + ' parts')
    let nluResponses = []
    let ret = {
      entities: [],
      relations: [],
      text: ''
    }
    for (let chunk of chunks) {
      ret.text += chunk
      nluResponses.push(await nluCustomEntitiesPromise(chunk, username, password, model))
    }
    for (let response of nluResponses) {
      if (response.entities) {
        ret.entities.push(...response.entities)
      }

      if (response.relations) {
        ret.relations.push(...response.relations)
      }
    }
    ret.entities = ret.entities.filter((entity, index, self) => self.findIndex((t) => {
      return t.type === entity.type && t.text === entity.text;
    }) === index)

    res.status(200).send(ret)
  } catch (e) {
    if (e.code == 401) {
      res.status(401).send('Unauthorized')
    } else {
      res.status(500).send('Cannot connect to NLU service')
    }
  }
}

function greedyChunkBySentence(text) {
  let maxChunkChars = 9800
  let splitBySentence = text.split('. ')
  let greedyChunks = []

  for (let chunk of splitBySentence) {
    // Check if the sentence itself is too big to chunk. if so, break it up by space
    if (chunk.length > maxChunkChars) {
      let splitBySpace = chunk.split(' ')
      for (let subChunk of splitBySpace) {
        if (greedyChunks.length > 0 && greedyChunks[greedyChunks.length - 1].length + subChunk.length < maxChunkChars) {
          greedyChunks[greedyChunks.length - 1] += ' ' + subChunk
        } else {
          if (greedyChunks.length > 0) {
            greedyChunks[greedyChunks.length - 1] += ' '
            greedyChunks.push(subChunk)
          } else {
            greedyChunks.push(subChunk)
          }
        }
      }
      continue
    }

    // Otherwise do it by sentence
    if (greedyChunks.length > 0 && greedyChunks[greedyChunks.length - 1].length + chunk.length < maxChunkChars) {
      greedyChunks[greedyChunks.length - 1] += '. ' + chunk
    } else {
      if (greedyChunks.length > 0) {
        greedyChunks[greedyChunks.length - 1] += '. '
        greedyChunks.push(chunk)
      } else {
        greedyChunks.push(chunk)
      }
    }
  }
  return greedyChunks
}

module.exports = {
  uploadFileAndExtractEntitiesMW,
  uploadFileAndExtractEntitiesSampleMW,
  uploadTextAndExtractEntities,
  getModels
}
