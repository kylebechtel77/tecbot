module.exports = function(robot) {
  robot.hear(/badger/i, function (res) {
     res.send("Badgers? BADGERS? WE DON'T NEED NO STINKIN\' BADGERS");
   });
};