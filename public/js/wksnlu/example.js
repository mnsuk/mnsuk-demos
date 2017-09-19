username = "";
password = "";
graph = {
    'nodes': [],
    'links': []
  }
  /* global Dropzone annotate $ */
  // Only accept .txt, .doc, and .docx
  /*var acceptFunction = function (file, done) {
    if (!file.name.match(/(.*.docx$|.*.txt$)/)) {
      window.alert('Please use a .docx, or .txt file')
      done('badfile')
    } else {
      done()
    }
  }
  // Configure dropzone and add the page element
  var currentFile = null;
  var dropzone = new Dropzone('div#example-dropzone', {
    url: '/api/upload-file-and-extract-entities',
    clickable: true,
    maxFiles: 1,
    accept: acceptFunction,
    init: function() {
      this.on("addedfile", function(file) {
        if (currentFile) {
          this.removeFile(currentFile);
        }
        currentFile = file;
      });
    }
  })
  //Handle sending credentials
  dropzone.on("sending", function(file, xhr, data) {
    model=$( ".model option:selected" ).text();
    data.append("username", username);
    data.append("password", password);
    data.append("model", model);
  });
  // Handle errors in upload
  dropzone.on('error', function (file, error) {
    if (error === 'badfile') {
      return
    }
    window.alert('Error uploading ' + file.name)
  })
  // Handle sucessful upload
  dropzone.on('success', processResponseFromAnnotator)

  function sendExampleToAnnotator (filename) {
    if($( ".model option:selected" ).text() === "Default"){
          model="";
        } else {
          model=$(".model option:selected").text();
        }
    $.post(
      '/api/upload-file-and-extract-entities-sample',
      {
        filename: filename,
        username: username,
        password: password,
        model: model
      },
      function (data) {
        processResponseFromAnnotator(filename, data)
      }
    )
  }
*/
function processResponseFromAnnotator(file, response) {
  entities = []
  nodes = []
  var relations = []
  response.relations.forEach(function(entry) {
    item = {}
    item.relation = entry.type;
    item.source = entry.arguments[0].entities[0].text;
    item.target = entry.arguments[1].entities[0].text;
    group = entities.indexOf(entry.arguments[0].entities[0].type)
    if (group === -1) {
      entities.push(entry.arguments[0].entities[0].type);
    }
    nodes.push({
      'id': entry.arguments[0].entities[0].text,
      'group': entities.indexOf(entry.arguments[0].entities[0].type)
    })

    group = entities.indexOf(entry.arguments[1].entities[0].type)
    if (group === -1) {
      entities.push(entry.arguments[1].entities[0].type);
    }
    nodes.push({
      'id': entry.arguments[1].entities[0].text,
      'group': entities.indexOf(entry.arguments[1].entities[0].type)
    })
    relations.push(item);
  });
  relations = relations.filter((entity, index, self) => self.findIndex((t) => {
    return t.source === entity.source && t.target === entity.target;
  }) === index)
  nodes = nodes.filter((entity, index, self) => self.findIndex((t) => {
    return t.id === entity.id
  }) === index)

  try {
    var entities = response.entities
    var text = response.text
    var annotation = annotate(entities, text)
    $('#resultsJSON').empty()
    $('#resultsJSON').append('<pre>' + JSON.stringify(response, null, 2) + '</pre>')
    $('#results').empty()
    $('#results').append('<p>' + annotation.entities + '</p>')
    $('#results').append('<p>' + annotation.text + '</p>')
    $('#services').show();
    graph = {
        'nodes': nodes,
        'links': relations
      }
      //loadd3();
  } catch (e) {
    $('#services').hide();
    window.alert('Error occurred while annotating.')
  }
}

// Apply dropzone formatting
$(document).ready(function() {
  //$('div#example-dropzone').addClass('dropzone')
  //$('#send-example-demo').on('click', function() {
  //sendExampleToAnnotator('demo.txt')
  //})
  console.log("MNS example");
})

$('.getModels').click(function() {
  hideAllConnection();
  $("div.model-loading").show();
  username = $.trim($("#nluusername").val());
  password = $.trim($("#nlupassword").val());
  var $model = $('select.model');
  if (username != "" && username != "") {
    $.post('/api/models', {
        username: username,
        password: password
      },
      function(data) {
        if (data.models.length > 0) {
          $model.empty().append(function() {
            var output = '';
            output += '<option>Default</option>';
            $.each(data.models, function(key, value) {
              if (value.description.length > 1)
                displayValue = value.description;
              else
                displayValue = value.model_id;
              output += '<option value=\"' + value.model_id + '\" >' + value.model_id + '</option>';
            });
            return output;
          });
          $(".modelSelection").show();
          $('#nluStatus').text('connected');
          $('#nluStatus').removeClass('label-warning');
          $('#nluStatus').addClass('label-success');
        }
        hideErrorConnection();
      }).fail(function(err) {
      alert("Not connected to the NLU service. ")
      $(".modelSelection").hide();
      checkErrorConnection(err);
    }).always(function() {
      $("div.model-loading").hide()
    })
  } else {
    alert('Username or password is blank.');
  }
});

//show error messages when cannot connect
function checkErrorConnection(err) {
  $(".connected").hide();
  $(".notConnected").show();
  $(".responseMessage").show();
  if (err.status == 401) {
    $(".responseMessage").text("Incorrect service credentials.");
  } else {
    $(".responseMessage").text("Internal server error.");
  }
}

//hide error messages when connected
function hideErrorConnection(err) {
  $(".connected").show();
  $(".notConnected").hide();
  $(".responseMessage").hide();
}

//hide error messages when connected
function hideAllConnection() {
  $(".connected").hide();
  $(".notConnected").hide();
  $(".responseMessage").hide();
}

//preventing hiding of service credential dropdown after click
$('.dropdown-menu').on("click.bs.dropdown", function(e) {
  e.stopPropagation();
  e.preventDefault();
});

function loadd3() {
  d3.selectAll("svg > *").remove();
  let centerSvg = 300;
  $('.relations-tab').scrollLeft(centerSvg);
  $('.relations-tab').scrollTop(centerSvg);
  var svg = d3.select("svg"),
    width = +svg.attr("width"),
    height = +svg.attr("height");
  var color = d3.scaleOrdinal(d3.schemeCategory20);

  var nd;
  for (var i = 0; i < graph.nodes.length; i++) {
    nd = graph.nodes[i];
    nd.rx = nd.id.length * 4.5;
    nd.ry = 12;
  }

  var simulation = d3.forceSimulation()
    .force("link", d3.forceLink().id(function(d) {
      return d.id;
    }).distance(150))
    .force("collide", d3.ellipseForce(6, 0.5, 5))
    .force("center", d3.forceCenter(width / 2, height / 2));

  var link = svg.append("g")
    .attr("class", "link")
    .selectAll("line")
    .data(graph.links)
    .enter().append("line")
    .attr("stroke-width", function(d) {
      return Math.sqrt(10);
    });

  var node = svg.append("g")
    .attr("class", "node")
    .selectAll("ellipse")
    .data(graph.nodes)
    .enter().append("ellipse")
    .attr("rx", function(d) {
      return d.rx;
    })
    .attr("ry", function(d) {
      return d.ry;
    })
    .attr("fill", function(d) {
      return color(d.group);
    })
    .call(d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended));

  var text = svg.append("g")
    .attr("class", "labels")
    .selectAll("text")
    .data(graph.nodes)
    .enter().append("text")
    .attr("dy", 2)
    .attr("text-anchor", "middle")
    .text(function(d) {
      return d.id
    })
    .attr("fill", "black");

  var textLinks = svg.append("g")
    .attr("class", "labelslink")
    .selectAll("text")
    .data(graph.links)
    .enter().append("text")
    .attr("dy", 2)
    .attr("text-anchor", "start")
    .text(function(d) {
      return d.relation
    })
    .attr("fill", "black");

  simulation
    .nodes(graph.nodes)
    .on("tick", ticked);

  simulation.force("link")
    .links(graph.links);


  function ticked() {
    link
      .attr("x1", function(d) {
        return d.source.x;
      })
      .attr("y1", function(d) {
        return d.source.y;
      })
      .attr("x2", function(d) {
        return d.target.x;
      })
      .attr("y2", function(d) {
        return d.target.y;
      });

    node
      .attr("cx", function(d) {
        return d.x;
      })
      .attr("cy", function(d) {
        return d.y;
      });
    text
      .attr("x", function(d) {
        return d.x;
      })
      .attr("y", function(d) {
        return d.y;
      });
    textLinks
      .attr("transform", function(d) {
        return "translate(" +
          ((d.source.x + d.target.x) / 2) + "," +
          ((d.source.y + d.target.y) / 2) + ")";
      });
  }



  function dragstarted(d) {
    if (!d3.event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(d) {
    d.fx = d3.event.x;
    d.fy = d3.event.y;
  }

  function dragended(d) {
    if (!d3.event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }
};
