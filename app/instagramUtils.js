//  app/instagramUtils.js

//  TODO - fix node-sass on server side

//  =============================================================================
//  SET UP AND GLOBAL VARIABLES
//  =============================================================================

var https                     = require('https'),
    _                         = require('underscore'),
    crypto                    = require('crypto'),
    request                   = require('request'),
    mysql                     = require('mysql'),
    lean_timer                = true, // when true time steps is normal, otherwise max request reached so prolongs timer
    timer_post_state          = true, // when true timer has gone by enough time for another post request
    timer_post_call           = false, // prevents timer function to be run multiple times
    timer_quick_state         = true, // when true timer has gone by enough time for another regular request
    timer_quick_call          = false, // prevents timer function to be run multiple times
    connection                = mysql.createConnection({
                                  host: 'localhost',
                                  user: 'root',
                                  password: process.env.MYSQLPASSWORD,
                                  database: 'fancrawl'
                                });

    connection.connect(function(err) {
                                      if (err) {
                                        console.error('error connecting: ' + err.stack);
                                        return;
                                      }

                                      console.log('connected as id ' + connection.threadId);
                                     });

//  =============================================================================
//  UTILITIES CALLED BY MAIN SECTIONS
//  =============================================================================

//  ZERO = neutral timer function for post requests =============================
  var timer_post              = function() {
    // random minute generator between 1 ~ 1.5 min
    var random_minute = (Math.floor(((Math.random() * 30) + 0)*1000)) + 60000;

    if (timer_post_call) {
      return;
    } else {
      timer_post_state = false;
      timer_post_call = true;
      if (lean_timer){
        console.log("TIMER POST");
        setTimeout(
          function(){
            if(lean_timer){
              timer_post_state = true;
              timer_post_call = false;
            } else {
              timer_post_call = false;
              timer_post();
            }
        }, random_minute); // (1~1.5 minute delay)
        // }, 90000); // (1.5 minute delay)
      } else {
        console.log("TIMER POST - Extended by 30 minutes");
        setTimeout(
          function(){
            lean_timer = true;
            timer_post_state = true;
            timer_post_call = false;
        }, 1800000); // (30 minute delay)
      }
    }

    };
    timer_post();  // autoloads on start to make sure to wait 1 minute

//  ZERO = neutral timer function for regular request ===========================
  var timer_quick             = function() {
    // random second generator between 3.6 ~ 5.6 sec
    var random_second = (Math.floor(((Math.random() * 2) + 0)*1000)) + 3600;

    if (timer_quick_call) {
    } else {
      timer_quick_state = false;
      timer_quick_call = true;
      if (lean_timer){
        console.log("TIMER QUICK");
        setTimeout(
          function(){
            if(lean_timer){
              timer_quick_state = true;
              timer_quick_call = false;
            } else {
              timer_quick_call = false;
              timer_quick();
            }
        }, random_second); // (1~1.5 second delay)
        // }, 90000); // (1.5 minute delay)
      } else {
        console.log("TIMER QUICK - Extended by 30 minutes");
        setTimeout(
          function(){
            lean_timer = true;
            timer_quick_state = true;
            timer_post_call = false;
        }, 1800000); // (30 minute delay)
      }
    }

    };
    timer_quick();  // autoloads on start to make sure to wait 1 minute

//  ZERO = time difference calculator ===========================================
  var time_difference         = function(original_time, current_time, callback) {
    // 1407473384 UNIX TIME in seconds
    var five_min              = 300, // 5 minutes in seconds
        one_hour              = 3600, // 1 hour in seconds
        one_day               = 86400, // 1 day in seconds
        tow_days              = 172800, // 2 days in seconds
        time_diff             = current_time - original_time;

    if( time_diff < five_min ){
      callback(0);
    } else if( time_diff < one_hour ){
      callback(1);
    } else if( time_diff < one_day ){
      callback(2);
    } else if( time_diff < tow_days ){
      callback(3);
    } else {
      callback(4);
    }
    };

//  ZERO = check user relationship ==============================================
  var relationship            = function(fancrawl_instagram_id, new_instagram_following_id, callback) {
    if (timer_quick_state) {
      timer_quick();
      connection.query('SELECT token from access_right where fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
        if (err) throw err;

        var hmac = crypto.createHmac('SHA256', process.env.FANCRAWLCLIENTSECRET);
            hmac.setEncoding('hex');
            hmac.write(process.env.LOCALIP);
            hmac.end();
        var hash = hmac.read();

        // Set the headers
        var headers = {
            'X-Insta-Forwarded-For': process.env.LOCALIP+'|'+hash
            }

        // Configure the request
        var options = {
            uri: 'https://api.instagram.com/v1/users/'+new_instagram_following_id+'/relationship',
            qs: {'access_token': rows[0].token},
            method: 'GET',
            headers: headers
            }

        request(options, function (error, response, body) {
            var pbody = JSON.parse(body);

            // CHECK FOR BODY
            if (pbody) {

              // DOES NOT EXIST - GO_FOLLOW THE NEXT USER
              if ( pbody.meta && pbody.meta.error_message && pbody.meta.error_message === "this user does not exist") {
                // {"meta":{"error_type":"APINotFoundError","code":400,"error_message":"this user does not exist"}}
                console.log(new_instagram_following_id+" does not exist");
                callback("not_exit");

              // OAUTH TOKEN EXPIRED
              } else if( pbody.meta && pbody.meta.error_message && pbody.meta.error_message === "The access_token provided is invalid." ) {
                // {"meta":{"error_type":"OAuthParameterException","code":400,"error_message":"The access_token provided is invalid."}}
                console.log("MUST LOG IN AGAIN - NEED NEW TOKEN");

              // OAUTH TIME LIMIT REACHED LET TIMER KNOW AND TRIES AGAIN
              } else if( pbody.meta && pbody.meta.error_type && pbody.meta.error_type === "OAuthRateLimitException" ) {
                // {"meta":{"error_type":"OAuthRateLimitException","code":429,"error_message":"The maximum number of requests per hour has been exceeded. You have made 91 requests of the 60 allowed in the last hour."}}
                console.log("GO_follow limit reach ("+new_instagram_following_id+"): ", body);
                callback("oauth_limit");

              } else if ( pbody.data ) {

                // FOLLOWED_BY BACK
                if ( pbody.data.outgoing_status && pbody.data.incoming_status ) {

                  // NOT FOLLOWED NOR BEING FOLLOWED
                  if( pbody.data.incoming_status === "none" ) {

                    // NEITHER YOU OR THE ARE FOLLOWING ONE ANOTHER
                    if( pbody.data.outgoing_status === "none" ) {
                      // {"meta":{"code":200},"data":{"outgoing_status":"none","target_user_is_private":true,"incoming_status":"none"}}
                      console.log( "you and user: "+new_instagram_following_id+" are not following one another" );
                      callback("neither");

                    // ONLY FOLLOWS NEW USER
                    } else if( pbody.data.outgoing_status === "requested"  ) {
                      // {"meta":{"code":200},"data":{"outgoing_status":"requested","target_user_is_private":true,"incoming_status":"none"}}
                      console.log( "you have requested to follow this user: "+new_instagram_following_id );
                      callback("requested");


                    // ONLY FOLLOWS NEW USER
                    } else if( pbody.data.outgoing_status === "follows"  ) {
                      // {"meta":{"code":200},"data":{"outgoing_status":"follows","target_user_is_private":true,"incoming_status":"none"}}
                      console.log( "you are only following user: "+new_instagram_following_id );
                      callback("follows");
                    }

                  } else if( pbody.data.incoming_status === "followed_by" ) {

                    // ONLY FOLLOWED_BY BACK
                    if( pbody.data.outgoing_status === "none" ) {
                      // {"meta":{"code":200},"data":{"outgoing_status":"none","target_user_is_private":true,"incoming_status":"followed_by"}}
                      console.log( new_instagram_following_id+" is following you back" );
                      callback("followed_by");

                    // BOTH FOLLOW AND FOLLOWED_BY BACK
                    } else if( pbody.data.outgoing_status === "requested" ) {
                      // {"meta":{"code":200},"data":{"outgoing_status":"follows","target_user_is_private":true,"incoming_status":"followed_by"}}
                      console.log( "You are following user: "+new_instagram_following_id+" and he is following you back" );
                      callback("followed_by_and_requested");

                    // BOTH FOLLOW AND FOLLOWED_BY BACK
                    } else if( pbody.data.outgoing_status === "follows" ) {
                      // {"meta":{"code":200},"data":{"outgoing_status":"follows","target_user_is_private":true,"incoming_status":"followed_by"}}
                      console.log( "You are following user: "+new_instagram_following_id+" and he is following you back" );
                      callback("both");

                    }
                  }

                } else {
                  console.log("Relationship did not pick up on this body ("+new_instagram_following_id+"): ", body);
                  callback("error");
                }

              }
            } else if (error) {
              console.log("Relationship error ("+new_instagram_following_id+"): ", error);
              callback("error");
            }
        });
      });
    } else {
      setTimeout(
        function(){
          relationship(fancrawl_instagram_id, new_instagram_following_id, callback);
      }, 1000 ); // time between adding new followers (0.5 sec or so wait)
    }
    };

//  ZERO = unfollow function ====================================================
  var GO_unfollow             = function (fancrawl_instagram_id, new_instagram_following_id, followed_by ){

    if ( followed_by ) {
      var followed_by_status = 1;
    } else {
      var followed_by_status = 0;
    }

    if (timer_post_state) {
      timer_post();

      connection.query('SELECT added_follower_instagram_id, UNIX_TIMESTAMP(creation_date), UNIX_TIMESTAMP(now()) FROM beta_followers WHERE fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND added_follower_instagram_id = "'+new_instagram_following_id+'"', function(err, rows, fields) {
        if (err) throw err;

        // CHECK TIME DIFFERENCE
        time_difference(rows[0]['UNIX_TIMESTAMP(creation_date)'], rows[0]['UNIX_TIMESTAMP(now())'], function(code){
          var count = code;


          // check in secure detabase before unfollowin if not there then unfollow
          connection.query('SELECT * FROM s_followed_by WHERE fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND followed_by_username = "'+new_instagram_following_id+'"', function(err, rows, fields) {
            if (err) throw err;
            if (rows[0]) {
              // found in secure database so do not unfollow
              // on success update database with right values
              connection.query('UPDATE beta_followers SET count = '+count+', following_status = 1, followed_by_status = '+followed_by+' WHERE fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND added_follower_instagram_id = "'+new_instagram_following_id+'"', function(err, rows, fields) {
                if (err) throw err;
                console.log("its part of the s_followed_by so do not unfollow");
              });

            } else {

              connection.query('SELECT token from access_right where fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
                if (err) throw err;
                // instagram header secret system
                var hmac = crypto.createHmac('SHA256', process.env.FANCRAWLCLIENTSECRET);
                    hmac.setEncoding('hex');
                    hmac.write(process.env.LOCALIP);
                    hmac.end();
                var hash = hmac.read();

                // Set the headers
                var headers = {
                    'X-Insta-Forwarded-For': process.env.LOCALIP+'|'+hash
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
                  var pbody = JSON.parse(body);
                  if (!error && response.statusCode == 200) {
                    if (pbody && pbody.data && pbody.data.outgoing_status && pbody.data.outgoing_status === "none") {
                      connection.query('UPDATE beta_followers SET count = '+count+', following_status = 0, followed_by_status = '+followed_by_status+' where fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND added_follower_instagram_id = "'+new_instagram_following_id+'"', function(err, rows, fields) {
                        if (err) throw err;
                        console.log("unfollow body ("+new_instagram_following_id+"): ", pbody); // Print the google web page.
                      });
                    }
                  } else if (error) {
                    console.log('GO_unfollow error ('+new_instagram_following_id+'): ', error);
                  }
                });
              });
            }
          });

        });
      });
    } else {
      setTimeout(
        function(){
          GO_unfollow(fancrawl_instagram_id, new_instagram_following_id, followed_by);
      }, 5000 ); // time between adding new followers (5 sec or so wait)
    }
    }

//  ZERO = follow function ======================================================
  var GO_follow               = function (fancrawl_instagram_id, new_instagram_following_id){
    if (timer_post_state) {
      timer_post();
      connection.query('SELECT token from access_right where fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
        if (err) throw err;
        // instagram header secret system
        var hmac = crypto.createHmac('SHA256', process.env.FANCRAWLCLIENTSECRET);
            hmac.setEncoding('hex');
            hmac.write(process.env.LOCALIP);
            hmac.end();
        var hash = hmac.read();

        // Set the headers
        var headers = {
            'X-Insta-Forwarded-For': process.env.LOCALIP+'|'+hash
        }

        // Configure the request
        var options = {
            uri: 'https://api.instagram.com/v1/users/'+new_instagram_following_id+'/relationship',
            qs: {'access_token': rows[0].token},
            method: 'POST',
            headers: headers,
            form:{action:'follow'}
        }

        request(options, function (error, response, body) {
          if (!error && response.statusCode == 200) {
            console.log("follow body ("+new_instagram_following_id+"): ", body); // Print the google web page.
            if( body && body.data ) {
              if( body.data.outgoing_status ){
                if ( body.data.outgoing_status === "follows" || body.data.outgoing_status === "requested" ) {
                  connection.query('INSERT INTO beta_followers SET fancrawl_instagram_id = '+fancrawl_instagram_id+', added_follower_instagram_id = '+new_instagram_following_id, function(err, rows, fields) {
                    if (err) throw err;
                    console.log("GO_follow body ("+new_instagram_following_id+"): ", body);
                  });
                }
              }
            }
          } else if (error) {
            console.log('GO_follow error ('+new_instagram_following_id+'): ', error);
          }
        });
      });
    } else {
      setTimeout(
        function(){
          GO_follow(fancrawl_instagram_id, new_instagram_following_id);
      }, 5000 ); // time between adding new followers (5 sec or so wait)
    }
    }

//  ZERO = follow crawler function ==============================================
  var verify                  = function(fancrawl_instagram_id, new_instagram_following_id, is_new){

    // CHECK STATE
    connection.query('SELECT state FROM access_right where fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
      if (err) throw err;

      // GOES ON WITH PROCESS IF STARTED STATE
      if (rows[0].state === 'started') {
        var next_follower = ( parseInt(new_instagram_following_id) + 1);

        // CHECK RELATIONSHIP
        relationship(fancrawl_instagram_id, new_instagram_following_id, function(status){

          // OAUTH LIMIT REACHED
          if( status === "oauth_limit" ){

            // DELAY TIMER
            lean_timer = false;
            timer_post();

            // CHECK TIMER IF ACTIF OR NOT
            if ( timer_post_state ) {
              // verify again
              verify( fancrawl_instagram_id, new_instagram_following_id);
            } else {
              setTimeout(
                function(){
                  // GO_follow again
                  verify(fancrawl_instagram_id, new_instagram_following_id);
              }, 60000); // time between adding new followers (1 min wait)
            }


          // DOES NOT EXIST + ALREADY FOLLOWING + ALREADY REQUESTED + NEW USER + FOLLOWS YOU BACK
          } else if( status === "not_exit" || status === "neither" || status === "follows"  || status === "requested" || status === "both" || status === "followed_by_and_requested" || status === "followed_by" ) {

            // IS A NEW USER
            if( status === "neither" ) {
              GO_follow( fancrawl_instagram_id, new_instagram_following_id);

            // FOLLOWED BY BACK
            } else if( status === "both" || status === "followed_by" || status === "followed_by_and_requested" ) {
              GO_unfollow(fancrawl_instagram_id, new_instagram_following_id, "followed_by");

            }

            if ( is_new === "new" ) {
              verify( fancrawl_instagram_id, next_follower);
            }

          // ERROR
          } else if( status === "error" ) {
            return;
          }

        });
      } else {
        console.log("State has been stopped")
      }
    });
    };

//  ZERO = check status of current database users ===============================
  var check_database          = function(fancrawl_instagram_id) {
    connection.query('SELECT added_follower_instagram_id, UNIX_TIMESTAMP(creation_date), UNIX_TIMESTAMP(now()) FROM beta_followers WHERE fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND count not in (4) AND following_status = 1', function(err, rows, fields) {
      if (err) throw err;
      for( var i = 0; i < rows.length; i++ ){

        var new_user = rows[i].added_follower_instagram_id;

        // CHECK TIME DIFFERENCE
        time_difference(rows[i]['UNIX_TIMESTAMP(creation_date)'], rows[i]['UNIX_TIMESTAMP(now())'], function(code){
          var count = code;
          var X_new_user = new_user;

          // CHECK RELATIONSHIP
          relationship(fancrawl_instagram_id, new_user, function(status){
            if( status === "followed_by" || status === "both" || status === "followed_by_and_requested" ){
              GO_unfollow(fancrawl_instagram_id, X_new_user, "followed_by");

            } else if ( count === 4 ){
              GO_unfollow(fancrawl_instagram_id, X_new_user);
            } else {
              // update code status
              connection.query('UPDATE beta_followers SET count = '+count+' WHERE fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND added_follower_instagram_id = "'+X_new_user+'"', function(err, rows, fields) {
                if (err) throw err;
                var time_start  = JSON.parse(rows[i]['UNIX_TIMESTAMP(creation_date)']),
                    time_now    = JSON.parse(rows[i]['UNIX_TIMESTAMP(now())']),
                    time_diff     = (time_now - time_start) * 1000;

                // less then 2 days
                if ( count === 3 ) {
                  var two_days  = 1000 * 60 * 60 * 48,
                      delay     = two_days - time_diff;

                  setTimeout(
                    function(){
                    verify(fancrawl_instagram_id, X_new_user, "old");
                  }, delay); // time between adding new followers (1 min wait)

                // less then 1 day
                } else if ( count === 2 ) {
                  var one_day   = 1000 * 60 * 60 * 24,
                      delay     = one_day - time_diff;

                  setTimeout(
                    function(){
                    verify(fancrawl_instagram_id, X_new_user, "old");
                  }, delay); // time between adding new followers (1 min wait)

                // less then 1 hour
                } else if ( count === 1 ) {
                  var one_hour  = 1000 * 60 * 60,
                      delay     = one_hour - time_diff;

                  setTimeout(
                    function(){
                    verify(fancrawl_instagram_id, X_new_user, "old");
                  }, delay); // time between adding new followers (1 min wait)

                // less then 5 min
                } else if ( count === 0 ) {
                  var five_min  = 1000 * 60 * 5,
                      delay     = five_min - time_diff;

                  setTimeout(
                    function(){
                    verify(fancrawl_instagram_id, X_new_user, "old");
                  }, delay); // time between adding new followers (1 min wait)
                }
              });
            }
          });
        });
      }
    });
    };

//  ZERO = server restart check =================================================
  var GO_start                = function(){
    connection.query('SELECT fancrawl_instagram_id FROM access_right where state = "started"', function(err, rows, fields) {
      if (err) throw err;
      if( rows && rows[0] ) {
        for (var i = 0; i < rows.length; i++){
          if ( rows[i].fancrawl_instagram_id ){
          var user = rows[i].fancrawl_instagram_id
          console.log("SERVER RESTART STARTING FETCH AGAIN");
            check_database(rows[i].fancrawl_instagram_id);
            connection.query('select MAX(beta_followers.added_follower_instagram_id) from beta_followers where fancrawl_instagram_id = "'+user+'"', function(err, rows, fields) {
              if (err) throw err;
              var last = JSON.parse(rows[0]['MAX(beta_followers.added_follower_instagram_id)']) + 1;
              verify(user, last, "new");
            });

          }
        }
      }
    });
    }();


//  =============================================================================
//  MAIN SECTIONS
//  =============================================================================

//  FIRST = load landing page '/' ===============================================
  exports.login               = function(req, res) {
    console.log("loggedin");
    res.render('./partials/login.ejs');
    };

//  SECOND = link to instagram authentication api for access token ==============
  exports.authorize_user      = function(req, res) {
    console.log("authorizing");
    // https://instagram.com/accounts/login/?next=/oauth/authorize%3Fclient_id%3D8527a4d35d6c4d63b9006f6233dd4860%26redirect_uri%3Dhttp%253A%252F%252Flocalhost%253A3000%252Fauth%252Finstagram%252Fcallback%26response_type%3Dcode%26state%3Da%2520state%26scope%3Dlikes%2Bcomments%2Brelationships
    var url = 'https://api.instagram.com/oauth/authorize/?client_id='+process.env.FANCRAWLCLIENTID+'&redirect_uri='+process.env.INSURIREDIRECT+'&response_type=code&state=a%20state&scope=likes+comments+relationships';
    res.redirect(url);
    // res.redirect(ig.get_authorization_url(redirect_uri, { scope: ['likes', 'comments', 'relationships'], state: 'a state' }));
    };

//  THIRD = handle instagram response and check access rights ===================
  exports.handleauth          = function(req, res) {
    // queryCode           = req.query.code;

    // form data
    var data = {'client_id' : process.env.FANCRAWLCLIENTID,
                 'client_secret' : process.env.FANCRAWLCLIENTSECRET,
                 'grant_type' : 'authorization_code',
                 'redirect_uri' : process.env.INSURIREDIRECT,
                 'code' : req.query.code
                };

    // configure the request
    var options = {
        uri: 'https://api.instagram.com/oauth/access_token',
        method: 'POST',
        form: data
    }

    // request for the token and data back
    request(options, function (error, response, body) {
      var pbody = JSON.parse(body);

      if (error) {
        console.log("Didn't work - most likely the Instagram secret key has been changed... For developer: Try rebooting the server. " + err.body);
        res.redirect('/404/');
        return;
      } else {
        connection.query('SELECT fancrawl_username FROM access_right where fancrawl_instagram_id = '+ pbody.user.id, function(err, rows, fields) {
          if (err) throw err;

          if ( rows && rows[0] && rows[0].fancrawl_username && rows[0].fancrawl_username === pbody.user.username){
            console.log("User granted");

              connection.query('UPDATE access_right set fancrawl_full_name = "'+pbody.user.full_name+'", code = "'+req.query.code+'", token = "'+pbody.access_token+'", fancrawl_profile_picture = "'+pbody.user.profile_picture+'" where fancrawl_instagram_id = '+ pbody.user.id, function(err, rows, fields) {
                if (err) throw err;
                res.redirect('/fresh?user='+pbody.user.username+'&id='+pbody.user.id);
                return;
              });

            return;
          } else {
            console.log("User not granted");
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
                      console.log("fresh error - Pagination: ", err);
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
                            console.log("fresh error - paginationFollowing: ", err);
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
                                          'followed_by': 'followed_by',
                                          'following': 'following'
                                        })

              } else if (rows[0].state === "stopping"){
                console.log("////////////////////////////");
                console.log("In a stopping state");

                res.render('./partials/dashboard.ejs',  {
                                          'state': 'stopping',
                                          'followed_by': 'followed_by',
                                          'following': 'following'
                                        })

              } else if (rows[0].state === "stopped"){
                console.log("////////////////////////////");
                console.log("In a stopped state");

                res.render('./partials/dashboard.ejs',  {
                                          'state': 'stopped',
                                          'followed_by': 'followed_by',
                                          'following': 'following'
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

                      // GO_follow( req_query.id , rows[0].last_following_id, req._remoteAddress );
                      verify( req_query.id , rows[0].last_following_id, "new" );
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

                      // GO_follow( req_query.id , rows[0].last_following_id, req._remoteAddress);
                      verify( req_query.id , rows[0].last_following_id, "new");
                      res.redirect('/fresh?'+url_split[1]);
                    });
                });
                return;
              }
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

