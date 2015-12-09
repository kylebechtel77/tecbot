module.exports = function(robot) {
  var request = require('request');
  var async = require('async');
  var moment = require('moment-timezone');

  var githubApiKey = process.env.HUBOT_GITHUB_API_KEY || '';
  var hipchatApiKey = process.env.HUBOT_HIPCHAT_API_KEY || '';

  var defaultAssociation = [{ 
    "rooms": [
      "TECBotTest"
    ], 
    "repos": [  
      "tn_job" 
    ]
  }];
  var roomAssociations = process.env.HUBOT_HIPCHAT_ROOM_ASSOCIATIONS || JSON.stringify(defaultAssociation);
  roomAssociations = JSON.parse(roomAssociations);
  console.log(roomAssociations);

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
    var now = moment().tz('America/New_York');
    var h = now.hours();
    var d = now.days();
    if (h > 6 && h < 20 && d > 0 && d < 6) {
      roomAssociations.forEach(function (association, i, associations) {
        buildHTML(association.repos, function(error, html) {
          if (error) {
            console.log("There was a problem..." + "\n" + error);
          } else if (html) {
            for (var j = 0; j < association.rooms.length; j++) {
              messageHipchatRoom(association.rooms[j].name, html);
            }
          } 
        });
      });
    }
  }

  // Used for /prs now. Unfortunately, because Hipchat's room notifications api is case sensitive
  // and because the res object here stores the room name as all lower case, I have to use the 
  // room ID to send notifications. This is the reason for the weird object structure.
  function annoyEveryoneWithResponse(res) {
    var target = res.message.room.toLowerCase();
    console.log(target);
    console.log(res.message);
    console.log(res);
    roomAssociations.forEach(function (association, i, associations) {
      association.rooms.forEach(function (room, j, rooms) {
        if (room.name.toLowerCase() == target) {
          console.log(room + " found!");
          buildHTML(association.repos, function(err, html) {
            if (err) {
              res.send("There was a problem..." + "\n" + err);
            } else if (html) {
              console.log("messaging");
              messageHipchatRoom(room.id, html);
            } else {
              res.send("There are no pull requests! (pizzadance)");
            }
          });
        }
      });
    });
  }

  function buildHTML(repos, cb) {
    var html = '<b>' + getRandomElement(annoyingThingsToSay) + '</b><br/><ul>';
    getFullPRList(repos, function (error, prs) {
      if (error) {
         return cb(error, null);
      }
      if (prs.length > 0) {
        sortPRsOnTime(prs);
        for (var i = 0; i < prs.length; i++) {
          var pull = prs[i];
          html += '<li><strong>' + pull.user.login + '</strong> has open pull request ' 
            + '<strong>' + pull.title + '</strong> in ' + pull.base.repo.name + '</br>'
            + '<a href=\"' + pull.html_url + '\">' + pull.html_url + '</a></br>'
            + '<i>Last updated ' + pull.time.fromNow() + '</i></li>'; 
        }
        html += '</ul>'
        return cb(null, html);
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

  function getFullPRList(repos, cb) {
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

  function messageHipchatRoom(roomNameOrID, msg) {
    request({
      url: 'https://api.hipchat.com/v2/room/' + roomNameOrID + '/notification',
      qs: {auth_token: hipchatApiKey},
      method: 'POST',
      json: {
        'color': 'purple',
        'message': msg,
        'notify': true,
        'message_format': 'html'
      }
    });
  }

  function getAllHipchatEmoticons(cb) {
    request({
      url: 'https://api.hipchat.com/v2/emoticon',
      qs: {
        'auth_token': hipchatApiKey,
        'max-results': 1000
      },
      method: 'GET',
    }, function (error, response, body) {
      cb(error, JSON.parse(body));
    });
  }

  function waitForHour(cooldown) {
    var now = moment();
    var onHour = moment();
    onHour.add(1, 'hours');
    onHour.minutes(0);
    onHour.seconds(0);
    setTimeout(function () {
      setPRsOn(cooldown);
    }, onHour.diff(now));
  }

  function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function minutesToMillis(minutes) {
    return minutes * 60 * 1000;
  }

  function sortPRsOnTime(prs) {
    prs.forEach(function(element, index, array) {
      var time = moment(element.updated_at).tz('America/New_York');
      element.time = time;
    });

    prs.sort(function (x, y) {
      if (x.time.isBefore(y.time)) {
        return -1;
      } else if (y.time.isBefore(x.time)) {
        return 1;
      }
      return 0;
    });
  }
};
