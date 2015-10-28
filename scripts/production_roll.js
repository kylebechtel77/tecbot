module.exports = function(robot) {
	var moment = require('moment-timezone');

	var githubApiKey = process.env.HUBOT_GITHUB_API_KEY || '';
  var hipchatApiKey = process.env.HUBOT_HIPCHAT_API_KEY || '';
	var productionRepo = process.env.HUBOT_PRODUCTION_REPO || '';
	var productionBranch = process.env.HUBOT_PRODUCTION_BRANCH || '';
  var roomNames = ('TECBotTest').split(',');
  var messages = [
  	'Good job! The last production roll was ', 
  	'Let\'s get a production roll today! The last one was ', 
  	'We should do a production roll today. The last one was ', 
  	'We really could use a production roll. The last one was ', 
  	'It\'s been a while since the last production roll... The last one was ', 
  	'Starving for a production roll! The last one was '
  ];


	waitFor945();

	function setNotificationsOn() {
		getLastProductionCommits(function(err, data) {
			if (err || !data) {
				console.log('Problem retrieving data.\n' + err);
				return;
			}
			var lastCommit = data[0];
			var author = lastCommit.author.login;
			var then = moment(lastCommit.commit.author.date).tz('America/New_York');

			var fromNow = then.fromNow();

			var now = moment();
			var days = then.diff(now, 'days');

			var color = getColor(days);	
			var msg = getMessage(fromNow, days);

			roomNames.forEach(function (element, index, array) {
				messageHipchatRoom(element, msg, color);
			});
		})
	}


	function getLastProductionCommits(cb) {
		request({
		  url: 'https://api.github.com/repos/cbdr/' + productionRepo + '/commits',
		  qs: {
		  	access_token: githubApiKey,
		  	sha: productionBranch
		  },
		  method: 'GET',
		  headers: {
		    'User-Agent': 'TECBot',
		    'Content-Type': 'application/json'
		  }
		}, function(error, response, body) {
		  cb(error, JSON.parse(body));
		});
	}

	function messageHipchatRoom(room, msg, color) {
    request({
      url: 'https://api.hipchat.com/v2/room/' + room + '/notification',
      qs: {auth_token: hipchatApiKey},
      method: 'POST',
      json: {
        'color': color,
        'message': msg,
        'notify': true,
        'message_format': 'html'
      }
    });
  }

  function getMessage(fromNow, days) {
  	if (days > 5) {
  		days = 5;
  	}
  	return messages[days] + '<b>' + fromNow + '.</b>'
  }

  function getColor(days) {
  	if (days < 1) {
  		return 'green';
  	} else {
  		if (days < 3) {
  			return 'yellow';
  		} else {
  			return 'red';
  		}
  	}
  }

	function waitFor945() {
		var now = moment();
		var then = moment();
		var millis;
		then.hours(12);
		then.minutes(30);
		then.seconds(0);
		if (now.isBefore(then)) {
			millis = then.diff(now);
		} else {
			then.add(1, 'd');
			var millis = then.diff(now);
		}
		setTimeout(function() {
			setNotificationsOn();
		}, millis);
	}
}