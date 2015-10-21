module.exports = function(robot) {
  var querystring = require('querystring');
  var request = require('request');
  var async = require('async');

  var githubApiKey = process.env.HUBOT_GITHUB_API_KEY;
  var hipchatApiKey = process.env.HUBOT_HIPCHAT_API_KEY;
  var roomNames = process.env.HUBOT_HICPHAT_ROOM_NAMES.split(',') || ['TECBotTest'];
  var repos = process.env.HUBOT_REPOS.split(',');

  var annoyingThingsToSay = ['Pull request time!', 'Who wants some pull requests?', 'DO THESE PULL REQUESTS NOW!',
   'I got some more pull requests for you guys.', 'Do all the things!', 'FREE PULL REQUESTS!'];

  var annoyFunction;
  var cooldown = 60;
  waitForHour(cooldown);

  robot.hear(/\/prs now/i, function(res) {
    annoyEveryoneWithResponse(res);
  });

  function setPRsOn(cooldown) {
    clearInterval(annoyFunction);
    annoyEveryone();
    annoyFunction = setInterval(function() {
      annoyEveryone();
    }, minutesToMillis(cooldown));
  }

  function setPRsOff() {
    clearInterval(annoyFunction);
  }

  function annoyEveryone() {
    var d = new Date();
    var h = d.getHours() - 4;
    var w = d.getDay();
    console.log(w + ' day of the week and ' + h + ' hour.')
    if (h > 6 && h < 20 && w > 0 && w < 6) {
      buildHTML(function(error, html) {
        if (error) {
          console.log("There was a problem..." + "\n" + error);
        } else if (html) {
          for (var i = 0; i < roomNames.length; i++) {
            messageHipchatRoom(roomNames[i], html);
          }
        } 
      });
    }
  }

  function annoyEveryoneWithResponse(res) {
    buildHTML(function(err, html) {
      if (err) {
        res.send("There was a problem..." + "\n" + err);
      } else if (html) {
        for (var i = 0; i < roomNames.length; i++) {
          messageHipchatRoom(roomNames[i], html);
        }
      } else {
        res.send("There are no pull requests! (frogparty)");
      }
    }
  }

  function buildHTML(cb) {
    var html = '<b>' + getRandomPrimaryMessage() + '</b><br/><ul>';
    getFullPRList(function (error, prs) {
      if (error) {
        cb(error, null);
      }
      if (prs.length > 0) {
        for (var i = 0; i < prs.length; i++) {
          var pull = prs[i];
          html += '<li><strong>' + pull.user.login + '</strong> has open pull request ' 
            + '<strong>' + pull.title + '</strong> in ' + pull.base.repo.name + '</br>'
            + '<a href=\"' + pull.html_url + '\">' + pull.html_url + '</a></li>'; 
        }
        html += '</ul>'
        cb(null, html);
      }
      cb(null, undefined);
    });
  }    

  function getPullRequests(repo, cb) {
    request({ 
      url: 'https://api.github.com/repos/cbdr/' + repo + '/pulls',
      qs: {access_token: githubApiKey},
      method: 'GET',
      headers: {
        'User-Agent': 'TECBot',
        'Content-Type': 'application/json'
      }
    }, function(error, response, body) {
      cb(error, JSON.parse(body));
    });
  }

  function getFullPRList(cb) {
    var tasks = {};
    repos.forEach(function (element, index, array) {
      tasks[element] = function (callback) {
        getPullRequests(element, function (error, body) {
          callback(error, body);
        });
      }
    });
    async.parallel(tasks, function (error, result) {
      var prs = [];
      for (var repo in result) {
        if (result.hasOwnProperty(repo)) {
          for (var i = 0; i < result[repo].length; i++) {
            prs.push(result[repo][i]);
          }
        }
      }
      cb(error, prs);
    });
  }

  function messageHipchatRoom(room, msg) {
    request({
      url: 'https://api.hipchat.com/v2/room/' + room + '/notification',
      qs: {auth_token: hipchatApiKey},
      method: 'POST',
      json: {
        'color': 'purple',
        'message': msg,
        'notify': true,
        'message_format': 'html'
      }
    }, function(error, response, body) {
      console.log("Message sent to " + room + ".");
    });
  }

  function waitForHour(cooldown) {
    var d = new Date();
    var m = d.getMinutes();
    var s = d.getSeconds();
    console.log('Currently ' + m + ' minutes and ' + s + ' seconds into hour.');
    var fullSeconds = m * 60 + s;
    var leftSeconds = 60 * 60 - fullSeconds;
    console.log(fullSeconds+ ' in hour ' + leftSeconds + ' seconds left until hour.');
    setTimeout(function () {
      setPRsOn(cooldown);
    }, 1000 * leftSeconds);
  }

  function getRandomPrimaryMessage() {
    return annoyingThingsToSay[Math.floor(Math.random()*annoyingThingsToSay.length)];
  }

  function minutesToMillis(minutes) {
    return minutes * 60 * 1000;
  }
};
