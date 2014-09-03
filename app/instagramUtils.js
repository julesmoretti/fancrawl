//  app/instagramUtils.js

//  TODO check verifyRelationship...
//  TODO - fix node-sass on server side
//  TODO - organize and cap the count of people to add
//    >  anarray.unshift("x"); // add to beguining
//    >  anarray.pop(); // remove from the end

//  =============================================================================
//  SET UP AND GLOBAL VARIABLES
//  =============================================================================

var crypto                    = require('crypto'),
    request                   = require('request'),
    mysql                     = require('mysql'),
    usersInfo                 = {},
    timer                     = {},
    queueCap                  = 17,
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

//  ZERO = manage setTimout of timers =========================================== X
  var callTimer               = function ( fancrawl_instagram_id, state) {
    var random_second = (Math.floor(((Math.random() * 2) + 0)*1000)) + 3600;
    var random_minute = ( Math.floor((( Math.random() * 30 ) + 0 ) * 1000 )) + 60000;

    if ( state === "quick_short" ) {
      setTimeout(
        function(){
            timer_quick( fancrawl_instagram_id );
      }, 500); // 0.5 sec

    } else if ( state === "quick_long" ) {
      setTimeout(
        function(){
            if ( timer[ fancrawl_instagram_id ] ) {
              timer[ fancrawl_instagram_id ].quick_seconds = false;
              timer_quick( fancrawl_instagram_id );
            }
      }, random_second); // 3.6 ~ 5.6 sec

    } else if ( state === "post_short" ) {

      setTimeout(
        function(){
          timer_post( fancrawl_instagram_id );
      }, 5000); // (1~1.5 minute delay)

    } else if ( state === "post_long" ) {
      setTimeout(
        function(){
          if ( timer[ fancrawl_instagram_id ] ) {
            timer[ fancrawl_instagram_id ].post_minute = false;
            timer_post( fancrawl_instagram_id );
          }
      }, random_minute); // (1~1.5 minute delay)
    }
    };

//  ZERO = neutral timer function for post requests ============================= X
  var timer_post              = function ( fancrawl_instagram_id ) {
    // random minute generator between 1 ~ 1.5 min
    var random_minute = ( Math.floor((( Math.random() * 30 ) + 0 ) * 1000 )) + 60000;

    if ( !timer[ fancrawl_instagram_id ] ) {
      timer[ fancrawl_instagram_id ]                 = {};
      timer[ fancrawl_instagram_id ].post_queue      = {}; // handles sequence of people to follow or unfollow
      timer[ fancrawl_instagram_id ].quick_queue     = {}; // handles sequence of people to verify
      timer[ fancrawl_instagram_id ].post_minute     = false; // keep track of a minute has gone by
      timer[ fancrawl_instagram_id ].quick_seconds   = false; // keep track of minimum seconds separation
    }

    // IF POST_MINUTE = FALSE
    if ( timer[ fancrawl_instagram_id ].post_minute === false ) {
      // ENABLE
      timer[ fancrawl_instagram_id ].post_minute = true;
      // SETTIMEOUT LONG
      callTimer( fancrawl_instagram_id, "post_long" );

      // RUN SOME STUFF HERE //////////////////////////////////////////////
        console.log("/////////////////////////////////////////////////////");
        console.log("|||||||||||||||||||||||||||||||||||||||||||||||||||||");
        console.log("TIMER POST: "+fancrawl_instagram_id+": "+JSON.stringify(timer) );
        // CHECK STATE OF USER
        connection.query('SELECT state FROM access_right where fancrawl_instagram_id = "'+ fancrawl_instagram_id +'"', function(err, rows, fields) {
          if (err) throw err;

          // IF STOPPED DELETE QUEUES
          if ( rows[0].state === 'stopped' ) {
            // RESET post_timer
            if ( timer[ fancrawl_instagram_id ] && timer[ fancrawl_instagram_id ].post_queue && timer[ fancrawl_instagram_id ].quick_queue ) {
              timer[ fancrawl_instagram_id ].post_queue = {};
              timer[ fancrawl_instagram_id ].quick_queue = {};
            }

          // PROCESS STARTED OR CLEANING SO CARRY ON
          } else if ( rows[0].state === 'started' || rows[0].state === 'cleaning' ) {
            // normal behavior
            var count = [];
            for ( keys in timer[ fancrawl_instagram_id ].post_queue ) {
              count.push(keys);
            }
            if ( count.length === 0 ) {
              console.log("TIMER POST YYYY - Reached 0 waiting full cycle");
            } else if ( count.length < queueCap ) {
              var last_instagram_following_id = count[0];
              var process = timer[ fancrawl_instagram_id ].post_queue[ last_instagram_following_id ];

              if ( process === "follow" ) {
                GO_follow( fancrawl_instagram_id, last_instagram_following_id, function( fancrawl_instagram_id, last_instagram_following_id ){
                  delete timer[ fancrawl_instagram_id ].post_queue[ last_instagram_following_id ];
                  console.log("TIMER POST FOLLOW - deleted "+fancrawl_instagram_id+": "+last_instagram_following_id+" of process GO_FOLLOW");
                  var postQueueList = [];
                  for ( keys in timer[ fancrawl_instagram_id ].post_queue ) {
                    postQueueList.push(keys);
                  }

                  if ( timer[ fancrawl_instagram_id ].post_queue && postQueueList.length !== 0 ) {
                    for ( keys in timer[ fancrawl_instagram_id ].post_queue ) {
                      var lastPostQueueList = keys;
                      fetchNewFollowers( fancrawl_instagram_id, lastPostQueueList );
                    }

                  } else {
                    var nextUser = JSON.parse( last_instagram_following_id ) + 1;
                    fetchNewFollowers( fancrawl_instagram_id, nextUser );
                  }

                });
              } else if ( process === "unfollow" ) {
                GO_unfollow( fancrawl_instagram_id, last_instagram_following_id, "", function( fancrawl_instagram_id, last_instagram_following_id ){
                  delete timer[ fancrawl_instagram_id ].post_queue[ last_instagram_following_id ];
                  console.log("TIMER POST UNFOLLOW - deleted "+fancrawl_instagram_id+": "+last_instagram_following_id+" of process GO_UNFOLLOW");
                });
              } else if ( process === "unfollow_followedby" ) {
                GO_unfollow( fancrawl_instagram_id, last_instagram_following_id, true, function( fancrawl_instagram_id, last_instagram_following_id ){
                  delete timer[ fancrawl_instagram_id ].post_queue[ last_instagram_following_id ];
                  console.log("TIMER POST UNFOLLOW_FOLLOWED_BY - deleted "+fancrawl_instagram_id+": "+last_instagram_following_id+" of process GO_FOLLOW");
                });
              } else {
                console.log("TIMER POST XXXX - No process found... "+process);
              }
            } else {
              console.log("clockManager is not working properly.... "+count.length+" keys in the post_timer");
            }
          }
        });
      /////////////////////////////////////////////////////////////////////

    // IF TRUE TO SETTIMEOUT SHORT
    } else {
      callTimer( fancrawl_instagram_id, "post_short" );
    }
    };

//  ZERO = neutral timer function for regular request =========================== X
  var timer_quick             = function ( fancrawl_instagram_id ) {
    // random second generator between 3.6 ~ 5.6 sec
    var random_second = (Math.floor(((Math.random() * 2) + 0)*1000)) + 3600;

    if ( !timer[ fancrawl_instagram_id ] ) {
      timer[ fancrawl_instagram_id ]                 = {};
      timer[ fancrawl_instagram_id ].post_queue      = {}; // handles sequence of people to follow or unfollow
      timer[ fancrawl_instagram_id ].quick_queue     = {}; // handles sequence of people to verify
      timer[ fancrawl_instagram_id ].post_minute     = false; // keep track of a minute has gone by
      timer[ fancrawl_instagram_id ].quick_seconds   = false; // keep track of minimum seconds separation
    }

    // IF POST_MINUTE = FALSE
    if ( timer[ fancrawl_instagram_id ].quick_seconds === false ) {
      // ENABLE
      timer[ fancrawl_instagram_id ].quick_seconds = true;
      // SETTIMEOUT LONG
      callTimer( fancrawl_instagram_id, "quick_long" );

      // RUN SOME STUFF HERE //////////////////////////////////////////////
        connection.query('SELECT state FROM access_right where fancrawl_instagram_id = "'+ fancrawl_instagram_id +'"', function(err, rows, fields) {
          if (err) throw err;

          // IF STOPPED DELETE QUEUES
          if ( rows[0].state === 'stopped' ) {
            // RESET post_timer
            if ( timer[ fancrawl_instagram_id ] && timer[ fancrawl_instagram_id ].post_queue && timer[ fancrawl_instagram_id ].quick_queue ) {
              timer[ fancrawl_instagram_id ].post_queue = {};
              timer[ fancrawl_instagram_id ].quick_queue = {};
            }

          // PROCESS STARTED OR CLEANING SO CARRY ON
          } else if ( rows[0].state === 'started' || rows[0].state === 'cleaning' ) {

            var count = [];
            for ( keys in timer[ fancrawl_instagram_id ].quick_queue ) {
              count.push(keys);
            }

            if ( count.length === 0 ) {
              // console.log("TIMER QUICK XXXX - Reached zero waiting cycle");
            } else if ( count.length < queueCap ) {
              // console.log("TIMER QUICK XXXX - MORE THEN ZERO: ", count);

              var new_instagram_following_id = count[0];
              var process = timer[ fancrawl_instagram_id ].quick_queue[ new_instagram_following_id ];

              if ( process === "new" ) {
                // check relationship and unfollow with proper
                relationship( fancrawl_instagram_id, new_instagram_following_id, function( fancrawl_instagram_id, new_instagram_following_id, relationship ){
                  if ( relationship === "not_exit" ) {
                    // DELETE FROM LIST
                    delete timer[ fancrawl_instagram_id ].quick_queue[ new_instagram_following_id ];
                    console.log("NEW ADDED USER DID NOT EXIST - Deleted from quick list");

                  } else if ( relationship === "access_token" ) {
                    // error to deal with...
                    if ( !usersInfo[ fancrawl_instagram_id ] ) {
                      usersInfo[ fancrawl_instagram_id ] = {};
                    }
                    usersInfo[ fancrawl_instagram_id ].access_token = "access_token error";

                  } else if ( relationship === "oauth_limit" ) {
                    // error to deal with...
                    if ( !usersInfo[ fancrawl_instagram_id ] ) {
                      usersInfo[ fancrawl_instagram_id ] = {};
                    }
                    usersInfo[ fancrawl_instagram_id ].oauth_limit = "oauth_limit error";

                  } else if ( relationship === "followed_by" || relationship === "followed_by_and_requested" || relationship === "both" ) {
                    // console.log("ADDED TO CLOCK MANAGER FOLLOW: ", fancrawl_instagram_id );
                    if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].access_token ) {
                      delete usersInfo[ fancrawl_instagram_id ].access_token;
                    }
                    if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].oauth_limit ) {
                      delete usersInfo[ fancrawl_instagram_id ].oauth_limit;
                    }

                    delete timer[ fancrawl_instagram_id ].quick_queue[ new_instagram_following_id ];
                    clockManager( fancrawl_instagram_id, new_instagram_following_id, "unfollow_followedby" );

                  } else if ( relationship === "neither" || relationship === "follows" || relationship === "requested" ) {
                    if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].access_token ) {
                      delete usersInfo[ fancrawl_instagram_id ].access_token;
                    }
                    if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].oauth_limit ) {
                      delete usersInfo[ fancrawl_instagram_id ].oauth_limit;
                    }
                    delete timer[ fancrawl_instagram_id ].quick_queue[ new_instagram_following_id ];
                    clockManager( fancrawl_instagram_id, new_instagram_following_id, "follow");
                  }
                });

              } else if ( process === "unfollow_verify" ) {
                // check relationship and then time difference if needs be
                relationship( fancrawl_instagram_id, new_instagram_following_id, function( fancrawl_instagram_id, new_instagram_following_id, relationship ){
                  if ( relationship === "access_token" ) {
                    // error to deal with...
                    if ( !usersInfo[ fancrawl_instagram_id ] ) {
                      usersInfo[ fancrawl_instagram_id ] = {};
                    }
                    usersInfo[ fancrawl_instagram_id ].access_token = "access_token error";

                  } else if ( relationship === "oauth_limit" ) {
                    // error to deal with...
                    if ( !usersInfo[ fancrawl_instagram_id ] ) {
                      usersInfo[ fancrawl_instagram_id ] = {};
                    }
                    usersInfo[ fancrawl_instagram_id ].oauth_limit = "oauth_limit error";

                  } else if ( relationship === "followed_by" || relationship === "followed_by_and_requested" || relationship === "both" ) {
                    if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].access_token ) {
                      delete usersInfo[ fancrawl_instagram_id ].access_token;
                    }
                    if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].oauth_limit ) {
                      delete usersInfo[ fancrawl_instagram_id ].oauth_limit;
                    }

                    delete timer[ fancrawl_instagram_id ].quick_queue[ new_instagram_following_id ];
                    clockManager( fancrawl_instagram_id, new_instagram_following_id, "unfollow_followedby" );

                  // neither or just follow or just requested
                  } else {
                    if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].access_token ) {
                      delete usersInfo[ fancrawl_instagram_id ].access_token;
                    }
                    if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].oauth_limit ) {
                      delete usersInfo[ fancrawl_instagram_id ].oauth_limit;
                    }

                    delete timer[ fancrawl_instagram_id ].quick_queue[ new_instagram_following_id ];
                    clockManager( fancrawl_instagram_id, new_instagram_following_id, "unfollow" );
                  }
                });

              } else if ( process === 3 || process === "3" || process === 2 || process === "2" || process === 1 || process === "1" || process === 0 || process === "0" ) {

                // check relationship and then time difference if needs be
                relationship( fancrawl_instagram_id, new_instagram_following_id, function( fancrawl_instagram_id, new_instagram_following_id, relationship ){
                  if ( relationship === "access_token" ) {
                    // error to deal with...
                    if ( !usersInfo[ fancrawl_instagram_id ] ) {
                      usersInfo[ fancrawl_instagram_id ] = {};
                    }
                    usersInfo[ fancrawl_instagram_id ].access_token = "access_token error";

                  } else if ( relationship === "oauth_limit" ) {
                    // error to deal with...
                    if ( !usersInfo[ fancrawl_instagram_id ] ) {
                      usersInfo[ fancrawl_instagram_id ] = {};
                    }
                    usersInfo[ fancrawl_instagram_id ].oauth_limit = "oauth_limit error";

                  } else if ( relationship === "followed_by" || relationship === "followed_by_and_requested" || relationship === "both" ) {
                    if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].access_token ) {
                      delete usersInfo[ fancrawl_instagram_id ].access_token;
                    }
                    if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].oauth_limit ) {
                      delete usersInfo[ fancrawl_instagram_id ].oauth_limit;
                    }

                    delete timer[ fancrawl_instagram_id ].quick_queue[ new_instagram_following_id ];
                    clockManager( fancrawl_instagram_id, new_instagram_following_id, "unfollow_followedby" );

                  // neither or just follow or just requested
                  } else {
                    if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].access_token ) {
                      delete usersInfo[ fancrawl_instagram_id ].access_token;
                    }
                    if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].oauth_limit ) {
                      delete usersInfo[ fancrawl_instagram_id ].oauth_limit;
                    }
                    // delete from queue
                    delete timer[ fancrawl_instagram_id ].quick_queue[ new_instagram_following_id ];
                    // console.log("TIMER QUICK - deleted "+fancrawl_instagram_id+": "+new_instagram_following_id+" of process "+process);
                    // check time difference and wait for 48 hours and repeat
                    verifyRelationship( fancrawl_instagram_id, new_instagram_following_id );
                  }
                });
              } else {
                console.log("TIMER QUICK XXXX - No process found... "+process+" for user "+new_instagram_following_id);
              }

            } else {
              console.log("TIMER QUICK XXXX - clockManager is not working properly.... "+count.length+" keys in the post_timer");
            }
          }
        });
      /////////////////////////////////////////////////////////////////////

    // IF TRUE TO SETTIMEOUT SHORT
    } else {
      callTimer( fancrawl_instagram_id, "quick_short" );
    }
    };

//  ZERO = time difference calculator =========================================== X
  var time_difference         = function ( fancrawl_instagram_id, new_instagram_following_id, original_time, current_time, callback ) {
    // 1407473384 UNIX TIME in seconds
    var five_min              = 300, // 5 minutes in seconds
        one_hour              = 3600, // 1 hour in seconds
        one_day               = 86400, // 1 day in seconds
        tow_days              = 172800, // 2 days in seconds
        time_diff             = current_time - original_time;

    if( time_diff < five_min ){
      callback(fancrawl_instagram_id, new_instagram_following_id, 0);
    } else if( time_diff < one_hour ){
      callback(fancrawl_instagram_id, new_instagram_following_id, 1);
    } else if( time_diff < one_day ){
      callback(fancrawl_instagram_id, new_instagram_following_id, 2);
    } else if( time_diff < tow_days ){
      callback(fancrawl_instagram_id, new_instagram_following_id, 3);
    } else {
      callback(fancrawl_instagram_id, new_instagram_following_id, 4);
    }
    };

//  ZERO = check user relationship ==============================================
  var relationship            = function ( fancrawl_instagram_id, new_instagram_following_id, callback ) {

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
              console.log("RELATIONSHIP: "+new_instagram_following_id+" does not exist");
              callback(fancrawl_instagram_id, new_instagram_following_id, "not_exit");

            // OAUTH TOKEN EXPIRED
            } else if( pbody.meta && pbody.meta.error_message && pbody.meta.error_message === "The access_token provided is invalid." ) {
              // {"meta":{"error_type":"OAuthParameterException","code":400,"error_message":"The access_token provided is invalid."}}
              console.log( "RELATIONSHIP: "+new_instagram_following_id+" MUST LOG IN AGAIN - NEED NEW TOKEN - OR VALIDATE ACCOUNT AGAIN");
              callback(fancrawl_instagram_id, new_instagram_following_id, "access_token");

            // OAUTH TIME LIMIT REACHED LET TIMER KNOW AND TRIES AGAIN
            } else if( pbody.meta && pbody.meta.error_type && pbody.meta.error_type === "OAuthRateLimitException" ) {
              // {"meta":{"error_type":"OAuthRateLimitException","code":429,"error_message":"The maximum number of requests per hour has been exceeded. You have made 91 requests of the 60 allowed in the last hour."}}
              console.log("RELATIONSHIP: LIMIT REACH FOR: "+new_instagram_following_id+" - ", body);
              callback(fancrawl_instagram_id, new_instagram_following_id, "oauth_limit");

            } else if ( pbody.data ) {

              // FOLLOWED_BY BACK
              if ( pbody.data.outgoing_status && pbody.data.incoming_status ) {

                // NOT FOLLOWED NOR BEING FOLLOWED
                if( pbody.data.incoming_status === "none" ) {

                  // NEITHER YOU OR THE ARE FOLLOWING ONE ANOTHER
                  if( pbody.data.outgoing_status === "none" ) {
                    // {"meta":{"code":200},"data":{"outgoing_status":"none","target_user_is_private":true,"incoming_status":"none"}}
                    console.log( "RELATIONSHIP: you and user "+new_instagram_following_id+" are not following one another" );
                    callback(fancrawl_instagram_id, new_instagram_following_id, "neither");

                  // ONLY FOLLOWS NEW USER
                  } else if( pbody.data.outgoing_status === "requested"  ) {
                    // {"meta":{"code":200},"data":{"outgoing_status":"requested","target_user_is_private":true,"incoming_status":"none"}}
                    console.log( "RELATIONSHIP: you have requested to follow this user: "+new_instagram_following_id );
                    callback(fancrawl_instagram_id, new_instagram_following_id, "requested");


                  // ONLY FOLLOWS NEW USER
                  } else if( pbody.data.outgoing_status === "follows"  ) {
                    // {"meta":{"code":200},"data":{"outgoing_status":"follows","target_user_is_private":true,"incoming_status":"none"}}
                    console.log( "RELATIONSHIP: you are only following user: "+new_instagram_following_id );
                    callback(fancrawl_instagram_id, new_instagram_following_id, "follows");
                  }

                } else if( pbody.data.incoming_status === "followed_by" ) {

                  // ONLY FOLLOWED_BY BACK
                  if( pbody.data.outgoing_status === "none" ) {
                    // {"meta":{"code":200},"data":{"outgoing_status":"none","target_user_is_private":true,"incoming_status":"followed_by"}}
                    console.log( "RELATIONSHIP: "+new_instagram_following_id+" is following you back" );
                    callback(fancrawl_instagram_id, new_instagram_following_id, "followed_by");

                  // BOTH FOLLOW AND FOLLOWED_BY BACK
                  } else if( pbody.data.outgoing_status === "requested" ) {
                    // {"meta":{"code":200},"data":{"outgoing_status":"requested","target_user_is_private":true,"incoming_status":"followed_by"}}
                    console.log( "RELATIONSHIP: you have requested to follow user "+new_instagram_following_id+" and he is following you back" );
                    callback(fancrawl_instagram_id, new_instagram_following_id, "followed_by_and_requested");

                  // BOTH FOLLOW AND FOLLOWED_BY BACK
                  } else if( pbody.data.outgoing_status === "follows" ) {
                    // {"meta":{"code":200},"data":{"outgoing_status":"follows","target_user_is_private":true,"incoming_status":"followed_by"}}
                    console.log( "RELATIONSHIP: you are following user "+new_instagram_following_id+" and he is following you back" );
                    callback(fancrawl_instagram_id, new_instagram_following_id, "both");

                  }
                }

              } else {
                console.log("RELATIONSHIP: did not pick up on body of user "+new_instagram_following_id+" - ", body);
                callback(fancrawl_instagram_id, new_instagram_following_id, "error");
              }

            }
          } else if (error) {
            console.log("RELATIONSHIP: error "+new_instagram_following_id+" - ", error);
            callback(fancrawl_instagram_id, new_instagram_following_id, "error");
          }
      });
    });
    };

//  ZERO = unfollow function ==================================================== X
  var GO_unfollow             = function ( fancrawl_instagram_id, new_instagram_following_id, followed_by, callback ) {

    if ( followed_by ) {
      var followed_by_status = 1;
    } else {
      var followed_by_status = 0;
    }

    connection.query('SELECT added_follower_instagram_id, UNIX_TIMESTAMP(creation_date), UNIX_TIMESTAMP(now()) FROM beta_followers WHERE fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND added_follower_instagram_id = "'+new_instagram_following_id+'"', function(err, rows, fields) {
      if (err) throw err;

      // CHECK TIME DIFFERENCE
      time_difference(fancrawl_instagram_id, new_instagram_following_id, rows[0]['UNIX_TIMESTAMP(creation_date)'], rows[0]['UNIX_TIMESTAMP(now())'], function(fancrawl_instagram_id, new_instagram_following_id, code){
        var count = code;


        // check in secure detabase before unfollowin if not there then unfollow
        connection.query('SELECT * FROM s_followed_by WHERE fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND followed_by_username = "'+new_instagram_following_id+'"', function(err, rows, fields) {
          if (err) throw err;
          if (rows[0]) {
            // found in secure database so do not unfollow
            // on success update database with right values
            connection.query('UPDATE beta_followers SET count = 5, following_status = 1, followed_by_status = '+followed_by+' WHERE fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND added_follower_instagram_id = "'+new_instagram_following_id+'"', function(err, rows, fields) {
              if (err) throw err;
              console.log("its part of the s_followed_by so do not unfollow");
              callback( fancrawl_instagram_id, new_instagram_following_id );
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
                if (!error && response.statusCode == 200) {
                  var pbody = JSON.parse(body);
                  if( pbody ) {
                    if( pbody.data.meta && pbody.meta && pbody.meta.error_type && pbody.meta.error_type === "OAuthRateLimitException" ){
                      // check for rate limit reach... if so keep on looping
                      // {"meta":{"error_type":"OAuthRateLimitException","code":429,"error_message":"The maximum number of requests per hour has been exceeded. You have made 91 requests of the 60 allowed in the last hour."}}

                      if ( !usersInfo[ fancrawl_instagram_id ] ) {
                        usersInfo[ fancrawl_instagram_id ] = {};
                      }

                      usersInfo[ fancrawl_instagram_id ].OAuthRateLimitException = "OAuthRateLimitException";

                      clockManager( fancrawl_instagram_id, new_instagram_following_id, "unfollow" );

                    } else if ( pbody.data && pbody.data.outgoing_status && pbody.data.outgoing_status === "none") {
                      if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].OAuthRateLimitException ) {
                        delete usersInfo[ fancrawl_instagram_id ].OAuthRateLimitException;
                      }
                      connection.query('UPDATE beta_followers SET count = 5, following_status = 0, followed_by_status = '+followed_by_status+' where fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND added_follower_instagram_id = "'+new_instagram_following_id+'"', function(err, rows, fields) {
                        if (err) throw err;
                        console.log( "UN-FOLLOWED SUCCESSFULLY: ", new_instagram_following_id );
                        if ( callback ) {
                          console.log( "CALLBACK OF GO_UNFOLLOW FOR: ", new_instagram_following_id );
                          callback( fancrawl_instagram_id, new_instagram_following_id );
                        }
                      });
                    }
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

    }

//  ZERO = follow function ====================================================== X
  var GO_follow               = function ( fancrawl_instagram_id, new_instagram_following_id, callback ) {
    console.log("IN GO FOLLOW FOR: "+fancrawl_instagram_id+" & "+new_instagram_following_id);
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
          var pbody = JSON.parse(body);
          if( pbody ) {
            if( pbody.data.meta && pbody.meta && pbody.meta.error_type && pbody.meta.error_type === "OAuthRateLimitException" ){
              console.log("GO_FOLLOW - OAUTH RATE LIMIT EXCEPTION");
              // check for rate limit reach... if so keep on looping
              // {"meta":{"error_type":"OAuthRateLimitException","code":429,"error_message":"The maximum number of requests per hour has been exceeded. You have made 91 requests of the 60 allowed in the last hour."}}
              if ( !usersInfo[ fancrawl_instagram_id ] ) {
                usersInfo[ fancrawl_instagram_id ] = {};
              }
              usersInfo[ fancrawl_instagram_id ].OAuthRateLimitException = "OAuthRateLimitException";

              clockManager( fancrawl_instagram_id, new_instagram_following_id, "follow" );

            } else if( pbody.data && pbody.data.outgoing_status ){
              if ( pbody.data.outgoing_status === "follows" || pbody.data.outgoing_status === "requested" ) {
                if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].OAuthRateLimitException ) {
                  delete usersInfo[ fancrawl_instagram_id ].OAuthRateLimitException;
                }
                connection.query('INSERT INTO beta_followers SET fancrawl_instagram_id = '+fancrawl_instagram_id+', added_follower_instagram_id = '+new_instagram_following_id, function(err, rows, fields) {
                  if (err) throw err;

                  verifyRelationship( fancrawl_instagram_id, new_instagram_following_id );
                  console.log( "FOLLOWED SUCCESSFULLY: ", new_instagram_following_id );
                  if ( callback ) {
                    console.log( "CALL BACK FROM GO_FOLLOW FOR: ", new_instagram_following_id );
                    callback( fancrawl_instagram_id, new_instagram_following_id );
                  }
                });
              }
            } else {
              console.log("GO_follow - did not complete properly...");
            }
          }
        } else if (error) {
          console.log('GO_follow error ('+new_instagram_following_id+'): ', error);
        }
      });
    });
    }

//  ZERO = current users followers data ========================================= X
  var GET_stats               = function ( fancrawl_instagram_id, callback ) {
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
          uri: 'https://api.instagram.com/v1/users/'+fancrawl_instagram_id+'/',
          qs: {'access_token': rows[0].token},
          method: 'GET',
          headers: headers
      }

      request(options, function (error, response, body) {
        if (!error && response.statusCode == 200) {
          var pbody = JSON.parse(body);
          if( pbody ) {
            if( pbody.data.meta && pbody.meta && pbody.meta.error_type && pbody.meta.error_type === "OAuthRateLimitException" ){
              console.log("GO_FOLLOW - OAUTH RATE LIMIT EXCEPTION");
              // check for rate limit reach... if so keep on looping
              // {"meta":{"error_type":"OAuthRateLimitException","code":429,"error_message":"The maximum number of requests per hour has been exceeded. You have made 91 requests of the 60 allowed in the last hour."}}
              if ( !usersInfo[ fancrawl_instagram_id ] ) {
                usersInfo[ fancrawl_instagram_id ] = {};
              }
              usersInfo[ fancrawl_instagram_id ].OAuthRateLimitException = "OAuthRateLimitException";
              callback("N/A", "N/A");

            } else if( pbody.data ){
              if ( pbody.data.counts && pbody.data.counts.follows ) {
                if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].OAuthRateLimitException ) {
                  delete usersInfo[ fancrawl_instagram_id ].OAuthRateLimitException;
                }
                callback( pbody.data.counts.follows, pbody.data.counts.followed_by );
              }
            } else {
              console.log("GO_follow - did not complete properly...");
            }
          }
        } else if (error) {
          console.log('GO_follow error ('+new_instagram_following_id+'): ', error);
        }
      });
    });
    }

//  ZERO = Clock Manage  ======================================================== X
  var clockManager            = function ( fancrawl_instagram_id, new_instagram_following_id, process, callback ) {

    // look up relevant clock queue
    if ( process === "follow" || process === "unfollow" || process === "unfollow_followedby") {
      // console.log("in clock manager follow... unfollow... ");

        // console.log("CLOCK MANAGER POST: ",timer);
        var post_count = 0;
        for ( keys in timer[ fancrawl_instagram_id ].post_queue ) {
          post_count++;
        }
        // if < then 100 = add to queue and run callback
        if ( post_count < ( queueCap - 2 ) ) {
          timer[ fancrawl_instagram_id ].post_queue[ new_instagram_following_id ] = process;

          if ( callback ) {
            callback( fancrawl_instagram_id, new_instagram_following_id );
          }

        // else setTimeout 5 min recursing same stats
        } else {
          var time = 1000 * 60 * 5;
          setTimeout(
            function(){
            clockManager( fancrawl_instagram_id , new_instagram_following_id, process, callback);
          }, time );
        }

    // TIMER QUICK CONFIGURATIONS
    } else {
      // console.log("CLOCK MANAGER QUICK: ",timer);
      var quick_count = 0;
      for (keys in timer[ fancrawl_instagram_id ].quick_queue ) {
        quick_count++;
      }

      var post_count = 0;
      for ( keys in timer[ fancrawl_instagram_id ].post_queue ) {
        post_count++;
      }

      // if < then 100 = add to queue and run callback
      if ( quick_count < ( queueCap - 2 ) && post_count < ( queueCap - 2 ) ) {
      // console.log("CURRENT USER: ", fancrawl_instagram_id);
        // timer[ fancrawl_instagram_id ].quick_queue = JSON.parse('{"' + new_instagram_following_id + '":"' + process + '"}');
        timer[ fancrawl_instagram_id ].quick_queue[ new_instagram_following_id ] = process;
        if ( callback ) {
          callback( fancrawl_instagram_id, new_instagram_following_id, process );
        }

      // else setTimeout 10 seconds recursing same stats
      } else {
        var time = 1000 * 10;
        setTimeout(
          function(){
          clockManager( fancrawl_instagram_id , new_instagram_following_id, process, callback);
        }, time );
      }
    }
    };

//  ZERO = check if in secured databases ========================================
  var checkSecured            = function ( fancrawl_instagram_id, new_instagram_following_id, callback ) {
    // CHECK TO SEE IF IT IS IN SECURED DB IF SO SAVE AND PROCEED TO THE NEXT ONE
    connection.query('SELECT followed_by_id from s_followed_by where fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
      if (err) throw err;

      if ( rows && rows[0] && rows[0].followed_by_id && rows[0].followed_by_id === JSON.stringify( new_instagram_following_id ) ) {
        // followed_by new_instagram_following_id from secured database
        connection.query('SELECT following_id from s_following where fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
          if (err) throw err;
          if ( rows && rows[0] && rows[0].following_id && rows[0].following_id === JSON.stringify( new_instagram_following_id ) ) {
            // fanCrawl user already following this user
            if ( callback ) {
              callback( fancrawl_instagram_id, new_instagram_following_id, "both" );
            }

          } else {
            // fanCrawl user not following this user
            if ( callback ) {
              callback( fancrawl_instagram_id, new_instagram_following_id, "followed_by" );
            }
          }
        });
      } else {
        // not followed by new_instagram
        connection.query('SELECT following_id from s_following where fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
          if (err) throw err;
          if ( rows && rows[0] && rows[0].following_id && rows[0].following_id === JSON.stringify( new_instagram_following_id ) ) {
            // fanCrawl user already following this user
            if ( callback ) {
              callback( fancrawl_instagram_id, new_instagram_following_id, "following" );
            }
          } else {
            // fanCrawl user not following this user
            if ( callback ) {
              callback( fancrawl_instagram_id, new_instagram_following_id, "neither" );
            }
          }
        });
      }
    });
    };

//  ZERO = follow crawler function ==============================================
  var fetchNewFollowers       = function ( fancrawl_instagram_id, new_instagram_following_id ) {
    // CHECK STATE FOR STOPPED
    connection.query('SELECT state FROM access_right where fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
      if (err) throw err;

      // IF SO THEN STOP
      if ( rows[0].state === "stopped" ) {
        console.log("FETCH NEW FOLLOWERS STOPPED DUE TO STOPPED STATE FOR USER: ", fancrawl_instagram_id);

      // IN STARTED OR CLEANING STATE
      } else {
        // CHECK IF IT IS IN ANY SECURED TABLES
        // console.log("checking secure DB");
        checkSecured( fancrawl_instagram_id, new_instagram_following_id, function( fancrawl_instagram_id, new_instagram_following_id, status ) {
          // NOT IN ANY DATABASE SO CHECK RELATIOSHIP AND ADD TO DB
          if ( status === "neither" ) {
          // console.log("not in secure DB");
            clockManager( fancrawl_instagram_id, new_instagram_following_id, "new", function( fancrawl_instagram_id, new_instagram_following_id ) {
              // console.log("CLOCK MANAGER DONE LOADING NEXT USER");
              var nextUser = JSON.parse( new_instagram_following_id ) + 1;
              fetchNewFollowers( fancrawl_instagram_id, nextUser );
            });

          // IN SECURED DB SO SKIP USER
          } else {
            // console.log("in secure DB");
            // console.log("FETCH NEW FOLLOWERS FOUND USER THAT WAS ALREADY IN SECURED DB, SKIPPED IT");
            clockManager( fancrawl_instagram_id, new_instagram_following_id, "new", function( fancrawl_instagram_id, new_instagram_following_id ) {
              // console.log("CLOCK MANAGER DONE LOADING NEXT USER");
              var nextUser = JSON.parse( new_instagram_following_id ) + 1;
              fetchNewFollowers( fancrawl_instagram_id, nextUser );
            });
          }
        });
      }
    });
    };

//  ZERO = verify time passed before removing ===================================
  var verifyRelationship      = function ( fancrawl_instagram_id, new_instagram_following_id ) {
    connection.query('SELECT added_follower_instagram_id, UNIX_TIMESTAMP(creation_date), UNIX_TIMESTAMP(now()) FROM beta_followers WHERE fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND added_follower_instagram_id = "'+new_instagram_following_id+'"', function(err, rows, fields) {
      if (err) throw err;
      if ( rows && rows[0] ) {
        // CHECK TIME DIFFERENCE
        time_difference( fancrawl_instagram_id, new_instagram_following_id, rows[0]['UNIX_TIMESTAMP(creation_date)'], rows[0]['UNIX_TIMESTAMP(now())'], function( fancrawl_instagram_id, new_instagram_following_id, code ){
          connection.query('UPDATE beta_followers SET count = '+code+' WHERE fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND added_follower_instagram_id = "'+new_instagram_following_id+'"', function(err, rows, fields) {
            if (err) throw err;
          });

          var time_start  = JSON.parse(rows[0]['UNIX_TIMESTAMP(creation_date)']),
              time_now    = JSON.parse(rows[0]['UNIX_TIMESTAMP(now())']),
              time_diff     = (time_now - time_start) * 1000;


          // more then 2 days
              // console.log("VERIFY RELATIONSHIP: "+new_instagram_following_id+" code is "+code);
          if ( code === 4 ) {
            clockManager( fancrawl_instagram_id, new_instagram_following_id, "unfollow_verify" );

          // less then 2 days
          } else if ( code === 3 ) {
              // console.log("VERIFY RELATIONSHIP: "+new_instagram_following_id+" code is "+code);
            var two_days  = 1000 * 60 * 60 * 48,
                delay     = two_days - time_diff;

            setTimeout(
              function(){
                clockManager( fancrawl_instagram_id, new_instagram_following_id, code );
            }, delay); // time between adding new followers (1 min wait)

          // less then 1 day
          } else if ( code === 2 ) {
            var one_day   = 1000 * 60 * 60 * 24,
                delay     = one_day - time_diff;

            setTimeout(
              function(){
                clockManager( fancrawl_instagram_id, new_instagram_following_id, code );
            }, delay); // time between adding new followers (1 min wait)

          // less then 1 hour
          } else if ( code === 1 ) {
            var one_hour  = 1000 * 60 * 60,
                delay     = one_hour - time_diff;

            setTimeout(
              function(){
                clockManager( fancrawl_instagram_id, new_instagram_following_id, code );
            }, delay); // time between adding new followers (1 min wait)

          // less then 5 min
          } else if ( code === 0 ) {
            var five_min  = 1000 * 60 * 5,
                delay     = five_min - time_diff;

            setTimeout(
              function(){
                clockManager( fancrawl_instagram_id, new_instagram_following_id, code );
            }, delay); // time between adding new followers (1 min wait)
          } else {
            console.log("VERIFY RELATIONSHIP -  DID NOT FIND CODE: ", code);
          }
        });
      } else {
        console.log("VERIFY RELATIONSHIP - DID NOT FOUND IN DATABASE! ", new_instagram_following_id );
      }
    });
    };

//  ZERO = check on the cleaning process and updates state if done ==============
  var verifyCleaning          = function ( fancrawl_instagram_id, callback ) {
    if ( timer[ fancrawl_instagram_id ] ) {
      if ( timer[ fancrawl_instagram_id ].post_queue || timer[ fancrawl_instagram_id ].quick_queue ) {
        // console.log("VERIFY CLEANING FOUND QUEUES");
        var postCount = 0;
        for ( keys in timer[ fancrawl_instagram_id ].post_queue ) {
          postCount++;
        }
        var quickCount = 0;
        for ( keys in timer[ fancrawl_instagram_id ].quick_queue ) {
          quickCount++;
        }
        if ( postCount !== 0 || quickCount !== 0 ) {
          // console.log("POST COUNT: ", postCount );
          // console.log("QUICK COUNT: ", quickCount );
          // not done check again after some time....
          // still got data to go through wait longer to check
          var postDelay = postCount * 60 * 1000;
          var quickDelay = quickCount * 5 * 1000;
          var totalDelay = postDelay + quickDelay;


          // console.log("TOTAL DELAY: ", totalDelay );

          setTimeout(
            function(){
            verifyCleaning( fancrawl_instagram_id, callback );
          }, totalDelay);

        } else {
          // no post queue so can keep going
          if ( callback ) {
            console.log("VERIFY CLEANING CALLBACK");
            callback( fancrawl_instagram_id );
          }
        }

      // no post_queue check quick_queue
      } else {
        if ( callback ) {
          console.log("VERIFY CLEANING DID NOT FIND SHIT IN QUEUES");
          callback( fancrawl_instagram_id );
        }
      }
    }
   };

//  ZERO = check status of current database users =============================== X
  var cleanDatabase           = function ( fancrawl_instagram_id, callback ) {
    // console.log("XXXXXXX = IN CLEANING DATABASE: ", fancrawl_instagram_id );
    connection.query('SELECT added_follower_instagram_id FROM beta_followers WHERE fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND count not in (5) AND following_status = 0', function(err, rows, fields) {
      if (err) throw err;
      if ( rows && rows[0] ){
        for ( var i = 0; i < rows.length; i++ ) {
          connection.query('UPDATE beta_followers SET count = 5 WHERE fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND added_follower_instagram_id = "'+rows[i].added_follower_instagram_id+'"', function(err, rows, fields) {
            if (err) throw err;
          });
        }
      }
      connection.query('SELECT added_follower_instagram_id FROM beta_followers WHERE fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND count not in (5) AND following_status = 1', function(err, rows, fields) {
        if (err) throw err;
        if ( rows && rows[0] ) {

          // DATABASE HAS USERS TO DEAL WITH
          for ( var i = 0; i < rows.length; i++ ) {
            var new_instagram_following_id = rows[i].added_follower_instagram_id;

            verifyRelationship( fancrawl_instagram_id, new_instagram_following_id )
          }

          var quickCount = 0;
          var postCount = 0;

          for ( keys in timer[ fancrawl_instagram_id ].quick_queue ) {
            quickCount++;
          }
          var quickCountTime = quickCount * 1000 * 5;
          for ( keys in timer[ fancrawl_instagram_id ].post_queue ) {
            postCount++;
          }
          var postCountTime = postCount * 1000 * 80;
          var totalCountTime = quickCountTime + postCountTime;

          // console.log("CLEAN DATABASE - ROWS FOUND PRE SET TIMEOUT CALLBACK");
          setTimeout(
            function(){
            // console.log("CLEAN DATABASE - ROWS FOUND SET TIMEOUT CALLBACK");
            verifyCleaning( fancrawl_instagram_id, function( fancrawl_instagram_id, callback ) { callback( fancrawl_instagram_id ); });
          }, totalCountTime + 500 );

        } else {
          // DATABASE HAS NO USERS TO DEAL WITH ANYMORE
          // PROCEED WITH CALLBACK
          // ("CLEAN DATABASE - NO ROWS FOUND SO CALLBACK");
          callback( fancrawl_instagram_id );
        }
      });
    });
    };

//  ZERO = isolate scopes per users ============================================= X
  var startIndividual         = function ( fancrawl_instagram_id ) {

    // START USER SPECIFIC CLOCK
    if ( !timer[ fancrawl_instagram_id ] ) {
      timer_post( fancrawl_instagram_id ); // setup timer structure on start
      timer_quick( fancrawl_instagram_id ); // setup timer structure on start
    } else if ( !timer[ fancrawl_instagram_id ].post_queue ) {
      timer_post( fancrawl_instagram_id ); // setup timer structure on start
    } else if ( !timer[ fancrawl_instagram_id ].quick_queue ) {
      timer_quick( fancrawl_instagram_id ); // setup timer structure on start
    }

    connection.query('SELECT state FROM access_right where fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
      if (err) throw err;
      if( rows && rows[0] ) {

        // IF USER WAS STARTED
        if ( rows[0].state && rows[0].state === "started" ) {
          console.log("STARTED STATE: ", fancrawl_instagram_id);
          var state = rows[0].state;

          // UPDATE STATE to cleaning before starting again
          connection.query('UPDATE access_right set state = "cleaning" where fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
            if (err) throw err;

            // CLEAN DATABASE THEN PROCEED TO START AGAIN
            cleanDatabase( fancrawl_instagram_id, function( fancrawl_instagram_id ){


              // UPDATE STATE TO STARTED
              connection.query('UPDATE access_right set state = "started" where fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
                if (err) throw err;

                // FIND LAST USER ADDED AND ADDS NEXT ONE
                connection.query('select MAX(beta_followers.added_follower_instagram_id) from beta_followers where fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
                  if (err) throw err;
                  var new_instagram_following_id = JSON.parse(rows[0]['MAX(beta_followers.added_follower_instagram_id)']) + 1;

                  console.log("FINISHED CLEANING UP DATABASE FROM RESTART & PRE STARTED: ", fancrawl_instagram_id);

                  // START BY VERIFYING
                  // console.log("XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
                  // console.log("FETCHING - FROM START");
                  fetchNewFollowers( fancrawl_instagram_id, new_instagram_following_id );
                });
              });
            });
          });

        // IF USER WAS CLEANING
        } else if ( rows[0].state && rows[0].state === "cleaning" ) {
          // console.log("CLEANING STATE: ", fancrawl_instagram_id);
          var state = rows[0].state;
          // CLEAN DATABASE
          cleanDatabase( fancrawl_instagram_id, function( fancrawl_instagram_id ){
            connection.query('UPDATE access_right set state = "stopped" where fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
              if (err) throw err;
              console.log("FINISHED CLEANING UP DATABASE FROM RESTART & PRE CLEANING: ", fancrawl_instagram_id);
            });
          });
        } else {
          console.log("STOPPED STATE: ", fancrawl_instagram_id);
        }
      }
    });
    };

//  ZERO = server restart check ================================================= X
  var GO_start                = function () {
    console.log("SERVER RESTARTED - STARTING CLEANING PROCESS");
    connection.query('SELECT fancrawl_instagram_id FROM access_right', function(err, rows, fields) {
      if (err) throw err;
      if( rows && rows[0] ) {
        for (var i = 0; i < rows.length; i++){
          // EXTRACT USER FROM DATABASE IN STARTED OR CLEANING STATE
          if ( rows[i].fancrawl_instagram_id ){
            startIndividual( rows[i].fancrawl_instagram_id );
          }
        }
      }
    });
    }();

//  ZERO = Get list of followed_by user ========================================= X
  var GET_follows             = function ( fancrawl_instagram_id, pagination, write, callback ) {
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
          uri: 'https://api.instagram.com/v1/users/'+fancrawl_instagram_id+'/follows',
          qs: {'access_token': rows[0].token},
          method: 'GET',
          headers: headers,
      }

      if ( pagination ) {
        options.qs.cursor = pagination;
      }

      request(options, function (error, response, body) {
        var pbody = JSON.parse(body);
        if ( !error && response.statusCode == 200 ) {
          if ( pbody.data) {
            for ( var i = 0; i < pbody.data.length; i++ ) {
              if ( write ) {
                connection.query('INSERT INTO s_following set fancrawl_instagram_id = "'+fancrawl_instagram_id+'", following_full_name = '+JSON.stringify(pbody.data[i].full_name)+', following_username = "'+pbody.data[i].username+'", following_id = "'+pbody.data[i].id+'"', function(err, rows, fields) {
                  if (err) throw err;
                });
              }
            }
          }
        } else if (error) {
          console.log('GET_follows error ('+new_instagram_following_id+'): ', error);
        }

        if (pbody.pagination && pbody.pagination.next_cursor) {
          GET_follows( fancrawl_instagram_id, pbody.pagination.next_cursor, write, callback);
        } else {
          console.log("done with pagination of GET_follows for user: "+fancrawl_instagram_id);
          if ( callback ) {
            console.log("AT THE CALLBACK");
            callback(fancrawl_instagram_id);
          }
        }

      });
    });
    };

//  ZERO = Get list of followed_by user ========================================= X
  var GET_followed_by         = function ( fancrawl_instagram_id, pagination, write, callback ) {
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
          uri: 'https://api.instagram.com/v1/users/'+fancrawl_instagram_id+'/followed-by',
          qs: {'access_token': rows[0].token},
          method: 'GET',
          headers: headers,
      }

      if ( pagination ) {
        options.qs.cursor = pagination;
      }


      request(options, function (error, response, body) {
        var pbody = JSON.parse(body);
        if ( !error && response.statusCode == 200 ) {
          if ( pbody.data && pbody.data[0] ) {
            for ( var i = 0; i < pbody.data.length; i++ ) {
              if ( write ) {
                connection.query('INSERT INTO s_followed_by set fancrawl_instagram_id = "'+fancrawl_instagram_id+'", followed_by_full_name = '+JSON.stringify(pbody.data[i].full_name)+', followed_by_username = "'+pbody.data[i].username+'", followed_by_id = "'+pbody.data[i].id+'"', function(err, rows, fields) {
                  if (err) throw err;
                });
              }
            }
          }
        } else if (error) {
          console.log('GET_followed_by error ('+new_instagram_following_id+'): ', error);
        }

        if (pbody.pagination && pbody.pagination.next_cursor) {
          GET_followed_by( fancrawl_instagram_id, pbody.pagination.next_cursor, write, callback );
        } else {
          console.log("done with pagination of GET_followed_by for user: "+fancrawl_instagram_id);
          if ( callback ) {
            callback(fancrawl_instagram_id);
          }
        }

      });
    });
    };


//  =============================================================================
//  MAIN SECTIONS
//  =============================================================================

//  FIRST = load landing page '/' =============================================== X
  exports.login               = function ( req, res ) {
    console.log("loggedin");
    res.render('./partials/login.ejs');
    };

//  SECOND = link to instagram authentication api for access token ============== X
  exports.authorize_user      = function ( req, res ) {
    console.log("authorizing");
    var url = 'https://api.instagram.com/oauth/authorize/?client_id='+process.env.FANCRAWLCLIENTID+'&redirect_uri='+process.env.INSURIREDIRECT+'&response_type=code&state=a%20state&scope=likes+comments+relationships';
    res.redirect(url);
    };

//  THIRD = handle instagram response and check access rights =================== X
  exports.handleauth          = function ( req, res ) {
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
      console.log(pbody);
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

                // IF FIRST TIME AUTHENTICATION THEN START USER SPECIFIC CLOCK
                if ( !timer[ pbody.user.id ] ) {
                  timer_post( pbody.user.id ); // setup timer structure on start
                  timer_quick( pbody.user.id ); // setup timer structure on start
                } else if ( !timer[ pbody.user.id ].post_queue ) {
                  timer_post( pbody.user.id ); // setup timer structure on start
                } else if ( !timer[ pbody.user.id ].quick_queue ) {
                  timer_quick( pbody.user.id ); // setup timer structure on start
                }

                // check the existence of data in secured s_followed_by database for current user
                connection.query('SELECT count(*) from s_followed_by where fancrawl_instagram_id = "'+pbody.user.id+'"', function(err, rows, fields) {
                  if (err) throw err;

                  // if any users are found listed then proceed to check for s_following
                  if ( JSON.parse(rows[0]['count(*)']) && JSON.parse(rows[0]['count(*)']) > 0 ) {

                    // check the existence of data in secured s_following database for current user
                    connection.query('SELECT count(*) from s_following where fancrawl_instagram_id = "'+pbody.user.id+'"', function(err, rows, fields) {
                      if (err) throw err;
                      if ( JSON.parse(rows[0]['count(*)']) && JSON.parse(rows[0]['count(*)']) > 0 ) {

                        // redirect to the dashboard
                        res.redirect('/dashboard?user='+pbody.user.username+'&id='+pbody.user.id);
                      } else {
                        // goes to get following instagram and inserts them into the s_following table
                        GET_follows( pbody.user.id, "" , true, function(users){
                            console.log("GOT_follows and users are: ", users );

                            // redirect to the dashboard
                            res.redirect('/dashboard?user='+pbody.user.username+'&id='+pbody.user.id);
                        });
                      }
                    });

                  // otherwise go GET_followed_by for current user and then check for s_following database
                  } else {
                    // goes to get followed_by instagram and inserts them into the s_followed_by table
                    GET_followed_by( pbody.user.id, "" , true, function(users){
                      console.log("GOT_followed_by and users are: ", users );

                      // check the existence of data in secured s_following database for current user
                      connection.query('SELECT count(*) from s_following where fancrawl_instagram_id = "'+pbody.user.id+'"', function(err, rows, fields) {
                        if (err) throw err;
                        if ( JSON.parse(rows[0]['count(*)']) && JSON.parse(rows[0]['count(*)']) > 0 ) {

                          // redirect to the dashboard
                          res.redirect('/dashboard?user='+pbody.user.username+'&id='+pbody.user.id);
                        } else {
                          // goes to get following instagram and inserts them into the s_following table
                          GET_follows( pbody.user.id, "" , true, function(users){
                              console.log("GOT_follows and users are: ", users );

                              // redirect to the dashboard
                              res.redirect('/dashboard?user='+pbody.user.username+'&id='+pbody.user.id);
                          });
                        }
                      });
                    });
                  }
                });
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

//  FOURTH = go grab instagram follower/ed data and show it ===================== Y
  exports.dashboard           = function ( req, res ) {
    var metrics = {
                    'userName': '',
                    'userPicture': '',
                    'totalCrawled': 0,
                    'followedBy': 0,
                    'following': 0,
                    'latestFollowedBy': 0,
                    'latestFollowing': 0,
                    'latestFollowedByPercentage': '',
                    'latestFollowingPercentage': '',
                    'lfbpClass': 'up',
                    'lfpClass': 'up',
                    'actualFollowedBy': 0,
                    'actualFollowing': 0,
                    'actualFollowedByPercentage': '',
                    'actualFollowingPercentage': '',
                    'afbpClass': 'down',
                    'afpClass': 'down',
                    'status': '',
                    'cleaningTime' : 'Some time metric goes here',
                    'errorLogs': {}
                  };

    if ( usersInfo[req.query.id] && usersInfo[req.query.id].errorLogs ) {
      metrics.errorLogs = usersInfo[req.query.id].errorLogs;
    }

    //TODO add the weekly increase stats...
    //TODO add the daily monthly stats also...

    if (JSON.stringify(req.query).length !== 2 && req.query.user !== undefined && req.query.id !== undefined) {
      console.log("has valid structure");

      // check access rights from database.
      connection.query('SELECT fancrawl_full_name, fancrawl_username, fancrawl_profile_picture FROM access_right where fancrawl_instagram_id = '+ req.query.id, function(err, rows, fields) {
        if (err) throw err;

        if (rows[0] === undefined || rows[0].fancrawl_username === undefined || rows[0].fancrawl_username !== req.query.user){
          console.log("User not granted");
          res.redirect('/404/');
          return;

        } else {
          console.log("User granted");
          metrics.userName = rows[0].fancrawl_full_name;
          metrics.userPicture = rows[0].fancrawl_profile_picture;


          // TODO alter if API call excess... or blocked

          // check state for particular fancrawl_instagram_id
          connection.query('SELECT state FROM access_right where fancrawl_instagram_id = "'+req.query.id+'"', function(err, rows, fields) {
            if (err) throw err;
            console.log("/////////////////////////////////");
            console.log(rows[0].state);
            if (rows[0].state === "stopped" ){
              metrics.status = 'statusStopped';
            } else if (rows[0].state === "cleaning" ) {
              metrics.status = 'statusCleaning';
            } else if (rows[0].state === "started" ) {
              metrics.status = 'statusStarted';
            } else {
            }

            // count from mysql saved followed_by users
            connection.query('SELECT count(*) from s_followed_by where fancrawl_instagram_id = "'+req.query.id+'"', function(err, rows, fields) {
              if (err) throw err;
              metrics.followedBy = JSON.parse(rows[0]['count(*)']);

              // count from mysql saved following users
              connection.query('SELECT count(*) from s_following where fancrawl_instagram_id = "'+req.query.id+'"', function(err, rows, fields) {
                if (err) throw err;
                metrics.following = JSON.parse(rows[0]['count(*)']);

                // count from mysql all users attempted so far
                connection.query('SELECT count(*) from beta_followers where fancrawl_instagram_id = "'+req.query.id+'"', function(err, rows, fields) {
                  if (err) throw err;
                  metrics.totalCrawled = JSON.parse(rows[0]['count(*)']);

                  // count from mysql all users still processing that is not with a 4 value
                  connection.query('SELECT count(*) from beta_followers where fancrawl_instagram_id = "'+req.query.id+'" AND followed_by_status = 1', function(err, rows, fields) {
                    if (err) throw err;
                    metrics.latestFollowedBy = JSON.parse(rows[0]['count(*)']) + metrics.followedBy;

                    // count from mysql all users still processing that is not with a 4 value
                    connection.query('SELECT count(*) from beta_followers where fancrawl_instagram_id = "'+req.query.id+'" AND count not in (4) AND following_status = 1', function(err, rows, fields) {
                      if (err) throw err;
                      var quickCount = 0;
                      var postCount = 0;

                      for ( keys in timer[ req.query.id ].quick_queue ) {
                        quickCount++;
                      }
                      var quickCountTime = quickCount * 1000 * 5;
                      for ( keys in timer[ req.query.id ].post_queue ) {
                        postCount++;
                      }
                      var postCountTime = postCount * 1000 * 80;
                      var totalCountTime = quickCountTime + postCountTime;

                      metrics.latestFollowing = JSON.parse(rows[0]['count(*)'])  + metrics.following;

                      metrics.latestFollowedByPercentage = Math.floor( ( ( metrics.latestFollowedBy / metrics.followedBy ) * 100 ) - 100);
                      metrics.latestFollowingPercentage = Math.floor( ( ( metrics.latestFollowing / metrics.following ) * 100 ) - 100);

                      if ( metrics.latestFollowedByPercentage >= 0 ) {
                        metrics.lfbpClass = 'up';
                      } else {
                        metrics.lfbpClass = 'down';
                      }

                      if ( metrics.latestFollowingPercentage >= 0 ) {
                        metrics.lfpClass = 'up';
                      } else {
                        metrics.lfpClass = 'down';
                      }
                      // console.log('Done with s_following list');

                      // var number = metrics.latestFollowing - metrics.following,
                      var milliseconds    = totalCountTime,
                          seconds         = milliseconds / 1000,
                          minutes         = seconds / 60,
                          hours           = minutes / 60,
                          days            = hours / 24,
                          totalDays       = Math.floor( days ),
                          totalHours      = Math.floor( ( days % 1 ) * 24 ),
                          totalMinutes    = Math.floor( ( ( ( ( days % 1 ) * 24) % 1 ) * 60 ) );
                          totalSeconds    = Math.floor( ( ( ( ( ( days % 1 ) * 24) % 1 ) * 60 ) % 1 ) * 60 );

                          if ( totalDays !== 0 ) {
                            if ( totalHours !== 0 && totalMinutes !== 0 ) {
                              var timeLeft = totalDays+"d "+totalHours+"h & "+totalMinutes+"m left...";
                            } else if ( totalHours === 0 ) {
                              var timeLeft = totalDays+"d & "+totalMinutes+"m left...";
                            } else if ( totalMinutes === 0 ) {
                              var timeLeft = totalDays+"d "+totalHours+"h left...";
                            }
                          } else if ( totalHours !== 0 ) {
                            if ( totalMinutes === 0 ) {
                              var timeLeft = totalHours+"hours left...";
                            } else {
                              var timeLeft = totalHours+"h & "+totalMinutes+"m left...";
                            }
                          } else if ( totalMinutes !== 0 ){
                            if ( totalSeconds === 0 ) {
                              var timeLeft = totalMinutes+"min left...";
                            } else {
                              var timeLeft = totalMinutes+"m & "+totalSeconds+"s left...";
                            }
                          } else {
                            var timeLeft = totalSeconds+"sec left...";
                          }

                      metrics.cleaningTime = timeLeft;

                      GET_stats( req.query.id, function( follows, followed_by ){
                        metrics.actualFollowedBy = followed_by;
                        metrics.actualFollowing = follows;

                        metrics.actualFollowedByPercentage = Math.floor( ( ( metrics.actualFollowedBy / metrics.followedBy ) * 100 ) - 100);
                        metrics.actualFollowingPercentage = Math.floor( ( ( metrics.actualFollowing / metrics.following ) * 100 ) - 100);

                        if ( metrics.actualFollowedByPercentage >= 0 ) {
                          metrics.afbpClass = 'up';
                        } else {
                          metrics.afbpClass = 'down';
                        }

                        if ( metrics.actualFollowingPercentage >= 0 ) {
                          metrics.afpClass = 'up';
                        } else {
                          metrics.afpClass = 'down';
                        }
                        res.render('./partials/dashboard.ejs',  metrics );
                      });

                    });
                  });
                });
              });
            });
          });
        }

      });

    } else {
      console.log("access denied");
      res.redirect('/404/');
      return;
    }
    return;
    };

//  ZERO = trigger FanCrawl ===================================================== Y
  exports.trigger             = function ( req, res ) {
    var original_url        = req.headers.referer,
        url_split           = original_url.split("?"),
        req_query           = JSON.parse('{"' + decodeURI(url_split[1].replace(/&/g, "\",\"").replace(/=/g,"\":\"")) + '"}'); // req_query = { user: 'ig_user_name', id: 'ig_id_number' };

    var fancrawl_instagram_id = req_query.id;

    // STARTING FANCRAWL
    // dashboard sent a switchFancrawl on so start FanCrawl
    if ( req.body.switchFancrawl && req.body.switchFancrawl === "on") {
      console.log("switchFancrawl detected");


      // START USER SPECIFIC CLOCK
      if ( !timer[ fancrawl_instagram_id ] ) {
        timer_post( fancrawl_instagram_id ); // setup timer structure on start
        timer_quick( fancrawl_instagram_id ); // setup timer structure on start
      } else if ( !timer[ fancrawl_instagram_id ].post_queue ) {
        timer_post( fancrawl_instagram_id ); // setup timer structure on start
      } else if ( !timer[ fancrawl_instagram_id ].quick_queue ) {
        timer_quick( fancrawl_instagram_id ); // setup timer structure on start
      }

      connection.query('UPDATE access_right set state = "started" where fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
        if (err) throw err;
        console.log("cleanDB for: ", fancrawl_instagram_id);
        cleanDatabase( fancrawl_instagram_id, function( fancrawl_instagram_id ){
          // start fetching process
          connection.query('select MAX(beta_followers.added_follower_instagram_id) from beta_followers where fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
            if (err) throw err;

            var new_instagram_following_id = JSON.parse(rows[0]['MAX(beta_followers.added_follower_instagram_id)']) + 1;

            console.log("XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
            console.log("FETCHING - FROM TRIGGER");
            fetchNewFollowers( fancrawl_instagram_id, new_instagram_following_id );
          });
        });
        res.redirect("/dashboard?user="+req_query.user+"&id="+fancrawl_instagram_id);
      });

    // CLEANING FANCRAWL
    // dashboard sent a switchClean on so clean database
    } else if ( req.body.switchclean && req.body.switchclean === "on") {
      console.log("switchclean detected");
      connection.query('UPDATE access_right set state = "cleaning" where fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
        if (err) throw err;
        // RESET post_timer & quick_timer
        console.log("EMPTY TIMER QUEUES FROM SWITCH: ", fancrawl_instagram_id);
        if ( timer[ fancrawl_instagram_id ] && timer[ fancrawl_instagram_id ].post_queue && timer[ fancrawl_instagram_id ].quick_queue ) {
          timer[ fancrawl_instagram_id ].post_queue = {};
          timer[ fancrawl_instagram_id ].quick_queue = {};
        }

        // cleaning database process
        cleanDatabase( fancrawl_instagram_id, function( fancrawl_instagram_id ){
          //done cleaning so set to stopped
          connection.query('UPDATE access_right set state = "stopped" where fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
            if (err) throw err;
            console.log("FINISHED CLEANING UP DATABASE FROM TRIGGER FOR USER: ", fancrawl_instagram_id );
          });
        });
        res.redirect("/dashboard?user="+req_query.user+"&id="+fancrawl_instagram_id);
      });

    // STOPPING FANCRAWL
    } else {
      console.log("no switch on so turn off fancrawl");
      // change state to stopped in database for user and redirect back to dashboard
      connection.query('UPDATE access_right set state = "stopped" where fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
        if (err) throw err;
        // RESET post_timer & quick_timer
        console.log("EMPTY TIMER QUEUES FROM SWITCH: ", fancrawl_instagram_id);
        if ( timer[ fancrawl_instagram_id ] && timer[ fancrawl_instagram_id ].post_queue && timer[ fancrawl_instagram_id ].quick_queue ) {
          timer[ fancrawl_instagram_id ].post_queue = {};
          timer[ fancrawl_instagram_id ].quick_queue = {};
        }

        res.redirect("/dashboard?user="+req_query.user+"&id="+fancrawl_instagram_id);
      });
    }
    };

