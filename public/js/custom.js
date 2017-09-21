// Offset for Site Navigation
$('#siteNav').affix({
  offset: {
    top: 100
  }
})


$(function() {
  $('.container#mnsfade').removeClass('fade-out');
  var $appStart = $('.skyControls img.play');
  var $appPause = $('.skyControls img.pause');
  var $appGo = $('a.launch');

  $('.panel').on('click', 'a.launch, a.launch2', function() {
    var myApp = $(this).parentsUntil('.panel').parent().attr('id');
    if (state[myApp] == 'running') {
      targetUrl = '';
      switch (myApp) {
        case 'reevoo':
          targetUrl = 'http://services-emea.skytap.com:10098/ui/analytics/cereevoo';
          break;
        case 'nhtsa':
          targetUrl = 'http://services-emea.skytap.com:10098/ui/analytics/default?facetedCollection=aNHTSA';
          break;
        case 'gdpr':
          if ($(this).hasClass('launch2'))
            targetUrl = 'https://services-emea.skytap.com:12045/navigator/?desktop=gdpr';
          else
            targetUrl = 'http://services-emea.skytap.com:12776/AppBuilder/';
          break;
        default:
          targetUrl = '#';
      }
      var win = window.open(targetUrl, '_blank');
      if (win) {
        win.focus();
        $.get('/audit', {
            "app": myApp
          })
          .done(function onSucess(ret) {})
          .fail(function onError(error) {})
          .always(function always() {});
      } else {
        alert('Please allow popups for this site');
      }
    } else {
      $(this).text('Not running')
      var $button = $('#' + myApp + '.panel' + ' a.launch');
      var $button2 = $('#' + myApp + '.panel' + ' a.launch2');
      setTimeout(function() {
        $button.text(state[myApp]);
        if ($button2.length)
          $button2.text(state[myApp]);
      }, 2000);
    }
  });


  /* var state = {
    reevoo: 'unknown',
    nhtsa: 'unknown',
    gdpr: 'unknown',
  }; */

  var state = {};

  var newstate = {};

  var skyAllStatus = function() {
    // console.log('Status: ' + JSON.stringify(state));
    let page = window.location.pathname;
    if (page.endsWith("/launch")) {
      $.get('/skytap/status')
        .done(function onSuccess(ret) {
          ret.forEach((env) => {
            let app = env.id;
            newstate[app] = env.runstate;
          });
        })
        .fail(function onError(error) {
          Object.keys(state).forEach((app) => {
            newstate[app] = 'Err: connection';
          });
        })
        .always(function always() {
          Object.keys(newstate).forEach((app) => {
            // console.log(new Date() + ' Doing: ' + app + ' as ' + state[app]);
            var $status = $('#' + app + '.panel' + ' img.light');
            var $start = $('#' + app + '.panel' + ' img.play');
            var $pause = $('#' + app + '.panel' + ' img.pause');
            var $button = $('#' + app + '.panel' + ' a.launch');
            var $button2 = $('#' + app + '.panel' + ' a.launch2');
            var $progress = $('#' + app + '.panel' + ' .floatingBarsG');
            let ns = newstate[app];
            switch (ns) {
              case 'suspended':
                if (ns != state[app]) {
                  $status.attr("src", "images/traffic_red_circle.png")
                  $start.attr("src", "images/player_play_normal.png")
                  $pause.attr("src", "images/player_pause_light.png")
                  $progress.css("visibility", "hidden");
                  $button.text(ns)
                  if ($button2.length)
                    $button2.text(ns);
                  state[app] = ns;
                }
                break;
              case 'running':
                if (ns != state[app]) {
                  // console.log(app + ' needs update to ' + ns);
                  $status.attr("src", "images/traffic_green_circle.png")
                  $start.attr("src", "images/player_play_light.png")
                  $pause.attr("src", "images/player_pause_normal.png")
                  $progress.css("visibility", "hidden");
                  if ($button2.length) {
                    $button.text('Open WEX')
                    $button2.text('Open CM')
                  } else {
                    $button.text('Open demo')
                  }
                  state[app] = ns;
                }
                break;
              case 'stopped':
                if (ns != state[app]) {
                  // console.log(app + ' needs update to ' + ns);
                  $status.attr("src", "images/traffic_red_circle.png")
                  $start.attr("src", "images/player_play_normal.png")
                  $pause.attr("src", "images/player_pause_light.png")
                  $progress.css("visibility", "hidden");
                  $button.text(ns);
                  if ($button2.length)
                    $button2.text(ns);
                  state[app] = ns;
                }
                break;
              case 'busy':
                if (ns != state[app]) {
                  // console.log(app + ' needs update to ' + ns);
                  $status.attr("src", "images/traffic_orange_circle.png")
                  $start.attr("src", "images/player_play_light.png")
                  $pause.attr("src", "images/player_pause_light.png")
                  $progress.css("visibility", "visible");
                  $button.text(ns)
                  if ($button2.length)
                    $button2.text(ns);
                  state[app] = ns;
                }
                break;
              default:
                if (ns != state[app]) {
                  $status.attr("src", "images/traffic_grey_circle.png")
                  $start.attr("src", "images/player_play_light.png")
                  $pause.attr("src", "images/player_pause_light.png")
                  $progress.css("visibility", "hidden");
                  $button.text(ns);
                  if ($button2.length)
                    $button2.text(ns);
                  state[app] = ns;
                }
            }
          });
        });
    }
  };

  $appPause.on('mouseover', function() {
    var myApp = $(this).parentsUntil('.panel').parent().attr('id');
    //var myApp = myDiv.substr(0, myDiv.indexOf('Controls'));
    if (state[myApp] == 'running') {
      var $pause = $('#' + myApp + '.panel' + ' img.pause');
      $pause.attr("src", "images/player_pause_hover.png")
    }
  });
  $appPause.on('mouseout', function() {
    var myApp = $(this).parentsUntil('.panel').parent().attr('id');
    if (state[myApp] == 'running') {
      var $pause = $('#' + myApp + '.panel' + ' img.pause');
      $pause.attr("src", "images/player_pause_normal.png")
    }
  });
  $appStart.on('mouseover', function() {
    var myApp = $(this).parentsUntil('.panel').parent().attr('id');
    if (state[myApp] == 'suspended') {
      var $start = $('#' + myApp + '.panel' + ' img.play');
      $start.attr("src", "images/player_play_hover.png")
    }
  });
  $appStart.on('mouseout', function() {
    var myApp = $(this).parentsUntil('.panel').parent().attr('id');
    if (state[myApp] == 'suspended') {
      var $start = $('#' + myApp + '.panel' + ' img.play');
      $start.attr("src", "images/player_play_normal.png")
    }
  });
  $appPause.on('click', function() {
    var myApp = $(this).parentsUntil('.panel').parent().attr('id');
    if (state[myApp] == 'running') {
      var $pause = $('#' + myApp + '.panel' + ' img.pause');
      $pause.attr("src", "images/player_pause_pressed.png");
      var $progress = $('#' + myApp + '.panel' + '.floatingBarsG');
      $progress.css("visibility", "visible");
      $.get('/skytap/pause/' + myApp)
        .done(function onSucess(ret) {})
        .fail(function onError(error) {})
        .always(function always() {
          var $status = $('#' + myApp + '.panel' + ' img.light');
          var $start = $('#' + myApp + '.panel' + ' img.play');
          var $pause = $('#' + myApp + '.panel' + ' img.pause');
          var $button = $('#' + myApp + '.panel' + ' a.launch');
          var $button2 = $('#' + myApp + '.panel' + ' a.launch2');
          $status.attr("src", "images/traffic_orange_circle.png")
          $start.attr("src", "images/player_play_light.png")
          $pause.attr("src", "images/player_pause_light.png")
          state[myApp] == 'busy';
          $button.text('busy')
          if ($button2.length)
            $button2.text('busy');
        });
    }
  });
  $appStart.on('click', function() {
    var myApp = $(this).parentsUntil('.panel').parent().attr('id');
    if (state[myApp] == 'suspended') {
      var $start = $('#' + myApp + '.panel' + ' img.play');
      $start.attr("src", "images/player_play_pressed.png");
      var $progress = $('#' + myApp + '.panel' + '.floatingBarsG');
      $progress.css("visibility", "visible");
      $.get('/skytap/start/' + myApp)
        .done(function onSucess(ret) {})
        .fail(function onError(error) {})
        .always(function always() {
          var $status = $('#' + myApp + '.panel' + ' img.light');
          var $start = $('#' + myApp + '.panel' + ' img.play');
          var $pause = $('#' + myApp + '.panel' + ' img.pause');
          var $button = $('#' + myApp + '.panel' + ' a.launch');
          var $button2 = $('#' + myApp + '.panel' + ' a.launch2');
          $status.attr("src", "images/traffic_orange_circle.png")
          $start.attr("src", "images/player_play_light.png")
          $pause.attr("src", "images/player_pause_light.png")
          state[myApp] == 'busy';
          $button.text('busy')
          if ($button2.length)
            $button2.text('busy');
        });
    }
  });

  skyAllStatus();
  setInterval(skyAllStatus, 2500); // poll every 2.5 seconds
  ConversationPanel.init();
});


$("#enter").click(function() {
  $('#mnsTest').fadeOut(750, 'linear', () => {
    if (user)
      document.location.href = 'launch';
    else
      document.location.href = 'login';
  });
});
