//  app/instagramUtils.js


//  =============================================================================
//  SET UP AND GLOBAL VARIABLES
//  =============================================================================

var https                     = require('https'),
    ig                        = require('instagram-node').instagram(),
    _                         = require('underscore'),
    crypto                    = require('crypto'),
    request                   = require('request'),
    redirect_uri              = process.env.INSURIREDIRECT,
    mysql                     = require('mysql'),
    random_second             = (Math.floor(((Math.random() * 1) + 0)*1000)), // random millisecond generator less then 1 sec
    connection                = mysql.createConnection({
                                  user: 'root',
                                  password: '',
                                  database: 'fancrawl'
                                });

    connection.connect(function(err) {
                                      if (err) {
                                        console.error('error connecting: ' + err.stack);
                                        return;
                                      }

                                      console.log('connected as id ' + connection.threadId);
                                     });

    ig.use({
            client_id: process.env.FANCRAWLCLIENTID,
            client_secret: process.env.FANCRAWLCLIENTSECRET
           });


//  =============================================================================
//  UTILITIES CALLED BY MAIN SECTIONS
//  =============================================================================

//  ZERO = check status function ================================================
  var GO_check                = function(fancrawl_instagram_id, new_instagram_following_id){
    connection.query('SELECT token from access_right where fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
      if (err) throw err;
      request('https://api.instagram.com/v1/users/'+new_instagram_following_id+'/relationship?access_token='+rows[0].token, function (error, response, body) {
        if (!error && response.statusCode == 200) {
          if ( body && body.data && body.data.incoming_status && body.data.incoming_status === "followed_by") {
            return true;
          } else {
            return false;
          }
        } else if (error) {
          console.log(error);
        }
      });

      setTimeout(
        function(){
          return false;
        }, 2000);

    });
    };

//  ZERO = unfollow function ====================================================
  var GO_unfollow             = function (fancrawl_instagram_id, new_instagram_following_id, ip_address){
    connection.query('SELECT token from access_right where fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
      if (err) throw err;
      // instagram header secret system
      var hmac = crypto.createHmac('SHA256', process.env.FANCRAWLCLIENTSECRET);
          hmac.setEncoding('hex');
          hmac.write(ip_address);
          hmac.end();
      var hash = hmac.read();

      // Set the headers
      var headers = {
          'X-Insta-Forwarded-For': ip_address+'|'+hash
      }

      // Configure the request
      var options = {
          uri: 'https://api.instagram.com/v1/users/'+new_instagram_following_id+'/relationship',
          qs: {'access_token': rows[0].token},
          method: 'POST',
          headers: headers,
          form:{action:'unfollow'}
      }

      request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
          console.log(body); // Print the google web page.
          if (body && body.data && body.data.outgoing_status && body.data.outgoing_status === "none") {
            connection.query('UPDATE beta_followers set following_status = 0 where fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND added_follower_instagram_id = "'+new_instagram_following_id+'"', function(err, rows, fields) {
              if (err) throw err;
            });
          }
        } else if (error) {
          console.log(error);
        }
      });

    });
    }

//  ZERO = follow crawler function ==============================================
  var GO_follow               = function(fancrawl_instagram_id, new_instagram_following_id, ip_address){

    console.log("IN GO FUNCTION");
    connection.query('SELECT state FROM access_right where fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
      if (err) throw err;
      if (rows[0].state === 'started') {

        var next_follower = ( parseInt(new_instagram_following_id) + 1);
        connection.query('UPDATE access_right set last_following_id = "'+next_follower+'" where fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
          if (err) throw err;

          setTimeout(
            function(){
              connection.query('SELECT token from access_right where fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
                if (err) throw err;

                // instagram header secret system
                var hmac = crypto.createHmac('SHA256', process.env.FANCRAWLCLIENTSECRET);
                    hmac.setEncoding('hex');
                    hmac.write(ip_address);
                    hmac.end()
                var hash = hmac.read();

                // Set the headers
                var headers = {
                    'X-Insta-Forwarded-For': ip_address+'|'+hash
                    };

                // Configure the request
                var options = {
                    uri: 'https://api.instagram.com/v1/users/'+new_instagram_following_id+'/relationship',
                    qs: {'access_token': rows[0].token},
                    method: 'POST',
                    headers: headers,
                    form:{action:'follow'}
                    };

                request(options, function (error, response, body) {
                  if (!error && response.statusCode == 200) {
                    console.log(body); // Print the google web page.
                    connection.query('INSERT INTO beta_followers SET fancrawl_instagram_id = '+fancrawl_instagram_id+', added_follower_instagram_id = '+new_instagram_following_id, function(err, rows, fields) {
                      if (err) throw err;
                    });
                  } else if (error) {
                    console.log(error);
                  }
                });

                connection.query('SELECT last_following_id from access_right where fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
                  if (err) throw err;
                  GO_follow( fancrawl_instagram_id, rows[0].last_following_id, ip_address);
                });
              });

              setTimeout(
                function(){
                  console.log('waited 5 minutes for follower: '+new_instagram_following_id);
                  if (GO_check(fancrawl_instagram_id, new_instagram_following_id)){
                    console.log('after 5 min user '+new_instagram_following_id+' follows you back');
                    connection.query('UPDATE beta_followers set followed_by_status = 1, count = 1 where fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND added_follower_instagram_id = "'+new_instagram_following_id+'"', function(err, rows, fields) {
                      if (err) throw err;
                      GO_unfollow(fancrawl_instagram_id, new_instagram_following_id, ip_address);
                    });

                  } else {
                    connection.query('UPDATE beta_followers set count = 1 where fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND added_follower_instagram_id = "'+new_instagram_following_id+'"', function(err, rows, fields) {
                      if (err) throw err;
                      setTimeout(
                        function(){
                          console.log('waited 1 hour for follower: '+new_instagram_following_id);
                          if (GO_check(fancrawl_instagram_id, new_instagram_following_id)){
                            console.log('after 1 hour user '+new_instagram_following_id+' follows you back');
                            connection.query('UPDATE beta_followers set followed_by_status = 1, count = 2 where fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND added_follower_instagram_id = "'+new_instagram_following_id+'"', function(err, rows, fields) {
                              if (err) throw err;
                              GO_unfollow(fancrawl_instagram_id, new_instagram_following_id, ip_address);
                            });

                          } else {
                            connection.query('UPDATE beta_followers set count = 2 where fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND added_follower_instagram_id = "'+new_instagram_following_id+'"', function(err, rows, fields) {
                              if (err) throw err;
                              setTimeout(
                                function(){
                                  console.log('waited 1 day for follower: '+new_instagram_following_id);
                                  if (GO_check(fancrawl_instagram_id, new_instagram_following_id)){
                                    console.log('after 1 day user '+new_instagram_following_id+' follows you back');
                                    connection.query('UPDATE beta_followers set followed_by_status = 1, count = 3 where fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND added_follower_instagram_id = "'+new_instagram_following_id+'"', function(err, rows, fields) {
                                      if (err) throw err;
                                      GO_unfollow(fancrawl_instagram_id, new_instagram_following_id, ip_address);
                                    });

                                  } else {
                                    connection.query('UPDATE beta_followers set count = 3 where fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND added_follower_instagram_id = "'+new_instagram_following_id+'"', function(err, rows, fields) {
                                      if (err) throw err;
                                      setTimeout(
                                        function(){
                                          console.log('waited 2 days for follower: '+new_instagram_following_id);
                                          if (GO_check(fancrawl_instagram_id, new_instagram_following_id)){
                                            console.log('after 2 days user '+new_instagram_following_id+' follows you back');
                                            connection.query('UPDATE beta_followers set followed_by_status = 1, count = 4 where fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND added_follower_instagram_id = "'+new_instagram_following_id+'"', function(err, rows, fields) {
                                              if (err) throw err;
                                              GO_unfollow(fancrawl_instagram_id, new_instagram_following_id, ip_address);
                                            });

                                          } else {
                                            connection.query('UPDATE beta_followers set count = 4 where fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND added_follower_instagram_id = "'+new_instagram_following_id+'"', function(err, rows, fields) {
                                              console.log('sorry after 2 days user '+new_instagram_following_id+' did not follow you back');
                                              if (err) throw err;
                                              GO_unfollow(fancrawl_instagram_id, new_instagram_following_id, ip_address);
                                            });
                                          }
                                      }, 172800000); // third time to check if user added back (2 days)
                                    });
                                  }
                              }, 86400000); // third time to check if user added back (1 day)
                            });
                          }
                      }, 3600000); // second time to check if user added back (1 hour)
                    });
                  }
              }, 300000); // first time to check if user added back (5 minutes)

            return;
          }, 60000 + random_second); // time between adding new followers (1 minute)
          return;
        });
      } else {
        console.log(new_instagram_following_id+' was stopped');
        return;
      }
      return;
    });
    };

//  ZERO = server restart check =================================================
  var GO_start                 = function(){
    connection.query('SELECT fancrawl_instagram_id, last_following_id, last_ip  FROM access_right where state = "started"', function(err, rows, fields) {
      if (err) throw err;
      if(rows) {
        for (var i = 0; i < rows.length; i++){
          // console.log(rows[i]);
          if ( rows[i].fancrawl_instagram_id && rows[i].last_following_id && rows[i].last_ip ){
          console.log("SERVER RESTART STARTING FETCH AGAIN");
            GO_follow(rows[i].fancrawl_instagram_id, rows[i].last_following_id, rows[i].last_ip);
          }
        }
      }
    })
    }();

//  =============================================================================
//  MAIN SECTIONS
//  =============================================================================

//  FIRST = load landing page '/' ===============================================
  exports.login               = function(req, res) {
    res.render('./partials/login.ejs');
    };

//  SECOND = link to instagram authentication api for access token ==============
  exports.authorize_user      = function(req, res) {
    res.redirect(ig.get_authorization_url(redirect_uri, { scope: ['likes', 'comments', 'relationships'], state: 'a state' }));
    };

//  THIRD = handle instagram response and check access rights ===================
  exports.handleauth          = function(req, res) {
    // queryCode           = req.query.code;

    ig.authorize_user(req.query.code, redirect_uri, function(err, result) {

      // profile_picture     = result.user.profile_picture;
      // token               = result.access_token;
      // full_name           = result.user.full_name;
      // userName            = result.user.username;
      // id                  = result.user.id;

      if (err) {
        console.log("Didn't work - most likely the Instagram secret key has been changed... For developer: Try rebooting the server. " + err.body);
        res.redirect('/404/');
        return;
      } else {
        connection.query('SELECT fancrawl_username FROM access_right where fancrawl_instagram_id = '+ result.user.id, function(err, rows, fields) {
          if (err) throw err;

          if (rows[0].fancrawl_username === result.user.username){
            console.log("User granted");

              connection.query('UPDATE access_right set fancrawl_full_name = "'+result.user.full_name+'", code = "'+req.query.code+'", token = "'+result.access_token+'", fancrawl_profile_picture = "'+result.user.profile_picture+'" where fancrawl_instagram_id = '+ result.user.id, function(err, rows, fields) {
                if (err) throw err;
                res.redirect('/fresh?user='+result.user.username+'&id='+result.user.id);
                return;
              });

            return;
          } else {
            console.log("User not granted");
            // connection.end();
            res.redirect('/404/');
            return;
          }
        });

      }
    });
    };

//  FOURTH = go grab instagram follower/ed data and show it =====================
  exports.fresh               = function(req, res) {

    if (JSON.stringify(req.query).length !== 2 && req.query.user !== undefined && req.query.id !== undefined) {
      console.log("has valid structure");

      // check access rights from database.
      connection.query('SELECT fancrawl_username FROM access_right where fancrawl_instagram_id = '+ req.query.id, function(err, rows, fields) {
        if (err) throw err;

        if (rows[0] === undefined || rows[0].fancrawl_username === undefined || rows[0].fancrawl_username !== req.query.user){
          console.log("User not granted");
          res.redirect('/404/');
          return;

        } else {
          console.log("User granted");

            // check state for particular fancrawl_instagram_id
            connection.query('SELECT state FROM access_right where fancrawl_instagram_id = "'+req.query.id+'"', function(err, rows, fields) {
              if (err) throw err;
              if (rows[0].state === "empty") {
                console.log("////////////////////////////");
                console.log("In a empty state");

                // update state to busy to prevent multiple edition.
                connection.query('UPDATE access_right set state = "busy" where fancrawl_instagram_id = "'+req.query.id+'"', function(err, rows, fields) {
                  if (err) throw err;

                  // instagram API calls
                  // go get current instagram followed_by users
                  var paginationFollowed_by = function (err, users, pagination, limit) {
                    if(err){
                      console.log(err);
                    } else {

                      // TODO this does not take asynchronous process into consideration
                      //puts in mysql each users
                      for (var i = 0; i < users.length; i++) {
                        connection.query('INSERT INTO s_followed_by set fancrawl_instagram_id = "'+req.query.id+'", followed_by_full_name = "'+users[i].full_name+'", followed_by_username = "'+users[i].username+'", followed_by_id = "'+users[i].id+'"', function(err, rows, fields) {
                          if (err) throw err;
                        });
                      };

                      // goes through each pagination to add to the followers list.
                      if (pagination && pagination.next) {
                        pagination.next(paginationFollowed_by);
                      } else {
                      console.log('Done with s_followed_by list');

                        // instagram API calls
                        // go get current instagram following users
                        var paginationFollowing = function (err, users, pagination, limit) {
                          if(err){
                            console.log(err);
                          } else {

                            // TODO this does not take asynchronous process into consideration
                            //puts in mysql each users
                            for (var i = 0; i < users.length; i++) {
                              connection.query('INSERT INTO s_following set fancrawl_instagram_id = "'+req.query.id+'", following_full_name = "'+users[i].full_name+'", following_username = "'+users[i].username+'", following_id = "'+users[i].id+'"', function(err, rows, fields) {
                                if (err) throw err;
                              });
                            };

                            // goes through each pagination to add to the followers list.
                            if (pagination && pagination.next) {
                              pagination.next(paginationFollowing);
                            } else {
                            console.log('Done with s_following list');

                            // update database status from busy to fresh
                            connection.query('UPDATE access_right set state = "fresh" where fancrawl_instagram_id = "'+req.query.id+'"', function(err, rows, fields) {
                              if (err) throw err;
                            });

                            // variables to ejs pages
                            var followed_by;
                            var following;

                            connection.query('SELECT count(*) from s_followed_by', function(err, rows, fields) {
                              if (err) throw err;
                              followed_by = rows[0]['count(*)'];

                              connection.query('SELECT count(*) from s_following', function(err, rows, fields) {
                                if (err) throw err;
                                following = rows[0]['count(*)'];
                                  console.log('following '+following+' and is followed_by '+followed_by+' instagram users');
                                  console.log('Done with s_following list');
                                  res.render('./partials/dashboard.ejs',  {
                                                                            'state': 'fresh',
                                                                            'followed_by': followed_by,
                                                                            'following': following
                                                                          })
                                return;
                              });
                            });

                            return;
                            };
                          };
                        };


                        ig.user_follows(req.query.id, paginationFollowing);
                      }
                    }
                  };

                  ig.user_followers(req.query.id, paginationFollowed_by);
                });


              } else if (rows[0].state === "busy"){
                console.log("In a busy state");

                setTimeout(function(){
                      console.log('in busy state redirected after a 2 second pause');
                      var data = req.query;
                      res.redirect('/fresh?user='+data.user+'&id='+data.id);
                      return;
                    }, 2000)

              } else if (rows[0].state === "fresh"){
                console.log("////////////////////////////");
                console.log("In a fresh state");

                // variables to ejs pages
                var followed_by;
                var following;

                connection.query('SELECT count(*) from s_followed_by', function(err, rows, fields) {
                  if (err) throw err;
                  followed_by = rows[0]['count(*)'];

                  connection.query('SELECT count(*) from s_following', function(err, rows, fields) {
                    if (err) throw err;
                    following = rows[0]['count(*)'];
                      console.log('following '+following+' and is followed_by '+followed_by+' instagram users');
                      console.log('Data fetched from database');
                      res.render('./partials/dashboard.ejs',  {
                                                                'state': 'fresh',
                                                                'followed_by': followed_by,
                                                                'following': following
                                                              })
                    return;
                  });
                });

              } else if (rows[0].state === "started"){
                console.log("////////////////////////////");
                console.log("In a started state");

                res.render('./partials/dashboard.ejs',  {
                                          'state': 'started',
                                          'followed_by': followed_by,
                                          'following': following
                                        })

              } else if (rows[0].state === "stopping"){
                console.log("////////////////////////////");
                console.log("In a stopping state");

                res.render('./partials/dashboard.ejs',  {
                                          'state': 'stopping',
                                          'followed_by': followed_by,
                                          'following': following
                                        })

              } else if (rows[0].state === "stopped"){
                console.log("////////////////////////////");
                console.log("In a stopped state");

                res.render('./partials/dashboard.ejs',  {
                                          'state': 'stopped',
                                          'followed_by': followed_by,
                                          'following': following
                                        })

              }
            });

          return;
        }
      });

    } else {
      console.log("access denied");
      res.redirect('/404/');
      return;
    }
    return;
    };

//  FIFTH = trigger to start stop the crawl =====================================
  exports.button              = function(req, res) {
    var original_url  = req.headers.referer,
        url_split     = original_url.split("?"),
        req_query     = JSON.parse('{"' + decodeURI(url_split[1].replace(/&/g, "\",\"").replace(/=/g,"\":\"")) + '"}'); // req_query = { user: 'ig_user_name', id: 'ig_id_number' };

    if (JSON.stringify(req_query).length !== 2 && req_query.user !== undefined && req_query.id !== undefined) {
      console.log("has valid structure");

      // check access rights from database.
      connection.query('SELECT fancrawl_username FROM access_right where fancrawl_instagram_id = '+ req_query.id, function(err, rows, fields) {
        if (err) throw err;

        if (rows[0] === undefined || rows[0].fancrawl_username === undefined || rows[0].fancrawl_username !== req_query.user){
          console.log("User not granted");
          res.redirect('/404/');
          return;

        } else {
          console.log("User granted");

            connection.query('UPDATE access_right set last_ip = "'+req._remoteAddress+'" where fancrawl_instagram_id = "'+req_query.id+'"', function(err, rows, fields) {
              if (err) throw err;

              // check state for particular fancrawl_instagram_id
              connection.query('SELECT state FROM access_right where fancrawl_instagram_id = "'+req_query.id+'"', function(err, rows, fields) {
                if (err) throw err;
                if (rows[0].state === "fresh") {
                  console.log('database state is fresh');
                  connection.query('UPDATE access_right set state = "started" where fancrawl_instagram_id = "'+req_query.id+'"', function(err, rows, fields) {
                    if (err) throw err;
                      console.log('started');

                      connection.query('SELECT last_following_id FROM access_right where fancrawl_instagram_id = "'+req_query.id+'"', function(err, rows, fields) {
                        if (err) throw err;
                        console.log('Last user added was: ', rows[0].last_following_id);

                        GO_follow( req_query.id , rows[0].last_following_id, req._remoteAddress );
                        res.redirect('/fresh?'+url_split[1]);
                      });

                  });
                  return;

                } else if (rows[0].state === "started") {
                  console.log('database state is started');
                  connection.query('UPDATE access_right set state = "stopped" where fancrawl_instagram_id = "'+req_query.id+'"', function(err, rows, fields) {
                    if (err) throw err;
                      res.redirect('/fresh?'+url_split[1]);
                  });
                  return;

                } else if (rows[0].state === "stopping") {
                    console.log('database state is stopping');
                  return;

                } else if (rows[0].state === "stopped") {
                  console.log('database state is stopped');
                  connection.query('UPDATE access_right set state = "started" where fancrawl_instagram_id = "'+req_query.id+'"', function(err, rows, fields) {
                    if (err) throw err;
                      console.log('started');
                      connection.query('SELECT last_following_id FROM access_right where fancrawl_instagram_id = "'+req_query.id+'"', function(err, rows, fields) {
                        if (err) throw err;
                        console.log('Last user added was: ', rows[0].last_following_id);

                        GO_follow( req_query.id , rows[0].last_following_id, req._remoteAddress);
                        res.redirect('/fresh?'+url_split[1]);
                      });
                  });
                  return;
                }
              });
            });
        }
      });
    } else {
      console.log("User not granted");
      res.redirect('/404/');
      return;
    }

    return;
    };