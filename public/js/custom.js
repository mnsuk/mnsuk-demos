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
  var $traffic = $('img.light');
  var $reevoo = $('a#reevoo');
  var $nhtsa = $('a#nhtsa');

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


  var state = {
    clicked: 'unknown',
    reevoo: 'unknown',
    nhtsa: 'unknown',
    gdpr: 'unknown',
  };

  var skyAllStatus = function() {
    skyStatus('nhtsa');
    skyStatus('reevoo');
    skyStatus('gdpr');
  }


  var skyStatus = function(app) {
    var $status = $('#' + app + '.panel' + ' img.light');
    var $start = $('#' + app + '.panel' + ' img.play');
    var $pause = $('#' + app + '.panel' + ' img.pause');
    var $button = $('#' + app + '.panel' + ' a.launch');
    var $button2 = $('#' + app + '.panel' + ' a.launch2');
    var $progress = $('#' + app + '.panel' + ' .floatingBarsG');
    if (state.clicked == app) {
      state.clicked == 'unknown'; // miss a beat on startup
      return;
    }
    $.get('/skytap/status/' + app)
      .done(function onSucess(ret) {
        let switchCode = '';
        if (ret.startsWith('Err:'))
          switchCode = 'error';
        else {
          switchCode = ret;
        }
        switch (switchCode) {
          case 'suspended':
            if (state[app] != switchCode) {
              $status.attr("src", "images/traffic_red_circle.png")
              $start.attr("src", "images/player_play_normal.png")
              $pause.attr("src", "images/player_pause_light.png")
              $progress.css("visibility", "hidden");
              $button.text(ret)
              if ($button2.length)
                $button2.text(ret);
              state[app] = switchCode;
            }
            break;
          case 'running':
            if (state[app] != switchCode) {
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
              state[app] = switchCode;
            }
            break;
          case 'stopped':
            if (state[app] != switchCode) {
              $status.attr("src", "images/traffic_red_circle.png")
              $start.attr("src", "images/player_play_normal.png")
              $pause.attr("src", "images/player_pause_light.png")
              $progress.css("visibility", "hidden");
              $button.text(ret);
              if ($button2.length)
                $button2.text(ret);
              state[app] = switchCode;
            }
            break;
          case 'busy':
            if (state[app] != switchCode) {
              $status.attr("src", "images/traffic_orange_circle.png")
              $start.attr("src", "images/player_play_light.png")
              $pause.attr("src", "images/player_pause_light.png")
              $progress.css("visibility", "visible");
              $button.text(ret)
              if ($button2.length)
                $button2.text(ret);
              state[app] = switchCode;
            }
            break;
          case 'error':
            $status.attr("src", "images/traffic_grey_circle.png")
            $start.attr("src", "images/player_play_light.png")
            $pause.attr("src", "images/player_pause_light.png")
            $progress.css("visibility", "hidden");
            $button.text(ret)
            if ($button2.length)
              $button2.text(ret);
            state[app] = 'unknown';
            break;
          default:
            $status.attr("src", "images/traffic_grey_circle.png")
            $start.attr("src", "images/player_play_light.png")
            $pause.attr("src", "images/player_pause_light.png")
            $progress.css("visibility", "hidden");
            $button.text('unknown');
            if ($button2.length)
              $button2.text(ret);
            state[app] = 'unknown';
        }
      })
      .fail(function onError(error) {
        $status.attr("src", "images/traffic_grey_circle.png")
        $start.attr("src", "images/player_play_light.png")
        $pause.attr("src", "images/player_pause_light.png")
        state[app] = 'unknown';
      })
      .always(function always() {});
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
          $button.text('busy')
          if ($button2.length)
            $button2.text('busy');
          //skyStatus(myApp);
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
      state.clicked = myApp;
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
          $button.text('busy')
          if ($button2.length)
            $button2.text('busy');
          // skyStatus(myApp);
        });
    }
  });

  skyAllStatus();
  setInterval(skyAllStatus, 3000);
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
