//  app/instagramUtils.js

//  TODO - fix node-sass on server side
//  TODO - Check clock load after callout time... seems like duplicates between long and short...

//  =============================================================================
//  SET UP AND GLOBAL VARIABLES
//  =============================================================================

var crypto                    = require('crypto'),
    request                   = require('request'),
    mysql                     = require('mysql'),
    nodemailer                = require('nodemailer'),
    usersInfo                 = {},
    timer                     = {},
    setTimeouts               = {},
    specialCounter            = 0,
    queueCap                  = 200,
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

// TODO: ADD A FUNCTION THAT CHECKS IF USERS THAT FOLLOW BACK ARE STILL FOLLOWING BACK... DO THIS IN SPARE TIME

//  ZERO = send email notification ==============================================
  var sendMail                = function ( fancrawl_instagram_id, subject, error ) {

    // create reusable transporter object using SMTP transport
    var transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
            user: process.env.FANCRAWLEMAIL,
            pass: process.env.FANCRAWLEMAILPASS
        }
    });

    connection.query('SELECT fancrawl_username, email, eNoti from access_right where fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
      if (err) throw err;
      if ( rows && rows[0] && ( rows[0].eNoti !== 0 ) && ( rows[0].email !== null ) ) {

        // setup e-mail data with unicode symbols
        var mailOptions = {
            from: 'Jules Moretti <'+process.env.FANCRAWLEMAIL+'>', // sender address
            to: rows[0].email , // list of receivers
            subject: 'FanCrawl.io - ' + subject +": "+rows[0].fancrawl_username, // Subject line
            text: error, // plaintext body
            html: error // html body
            // html: '<b>Hello world</b></br><div class="width:100px; height: 200px; background-color: red;">YOLLO</div>' // html body
        };

        // send mail with defined transport object
        transporter.sendMail( mailOptions, function( error, info ) {
          if ( error ) {
            console.log( error );
            sendMail( 571377691, 'mail error', 'The function sendMail got the following error: ' + error );

          } else {
            console.log( 'Message sent: ' + info.response );
          };
        });
      }
    });
    };

  sendMail( 571377691, 'server was restarted', 'Rebooted' );

  // var htmlBody = '<b>Hello world</b></br><div style="width:100px; height: 200px; background-color: red;">YOLLO</div>'
      // sendMail( 571377691, 'server was restarted', htmlBody );

//  ZERO = shuts down clock process
  var STOP                    = function ( fancrawl_instagram_id, blockNotification, callback ) {

    connection.query('UPDATE access_right set state = "stopped" where fancrawl_instagram_id = "'+ fancrawl_instagram_id +'"', function(err, rows, fields) {
      if (err) throw err;
    });

    // RESET post_timer & quick_timer
    timerPostStructure( fancrawl_instagram_id, "force" );
    timerQuickStructure( fancrawl_instagram_id, "force" );
    console.log("EMPTY TIMER QUEUES FROM SWITCH: ", fancrawl_instagram_id);

    if ( setTimeouts && setTimeouts[ fancrawl_instagram_id ] ) {
      for ( keys in setTimeouts[ fancrawl_instagram_id ] ) {
        clearTimeout( setTimeouts[ fancrawl_instagram_id ][ keys ] );
      }
    }

    if ( blockNotification ) {
      sendMail( fancrawl_instagram_id, "IG blocked account", "Go on Instagram and try liking a photo from your stream, if a captcha comes up then follow procedure, then log out of Instagram.com then sign back into http://fancrawl.io to re-register with FanCrawl. To reduce this try to post photos more frequently. Thank you." );
    }

    if ( callback ) {
      callback;
    }
    };

//  ZERO = manage setTimout of timers ===========================================
  var callTimer               = function ( fancrawl_instagram_id, state) {
    if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].access_token ) {
        setTimeout(
          function(){
              callTimer( arguments[0], arguments[1] );
        }, 1000 * 60 * 1, fancrawl_instagram_id, state ); // 1 min wait
    } else {
      // waits half a second and rechecks timer state
      if ( state === "quick_short" ) {
        setTimeout(
          function(){
              timer_quick( arguments[0] );
        }, 500, fancrawl_instagram_id ); // 0.5 sec

      // waits half a second and rechecks timer state
      } else if ( state === "quick_long" ) {
        setTimeout(
          function(){
              if ( timer[ arguments[0] ] ) {
                timer[ arguments[0] ].quick_seconds = false;
                timer_quick( arguments[0] );
              }
        }, Math.floor( ( Math.random() * 500 ) + 1000 ), fancrawl_instagram_id ); // 1 ~ 1.5 sec

      } else if ( state === "post_short" ) {

        setTimeout(
          function(){
            timer_post( arguments[0] );
        }, 5000, fancrawl_instagram_id ); // 5 sec

      } else if ( state === "post_long" ) {
        setTimeout(
          function(){
            if ( timer[ arguments[0] ] ) {
              timer[ arguments[0] ].post_minute = false;
              timer_post( arguments[0] );
            }
        }, Math.floor( ( Math.random() * 10000 ) + 60000 ), fancrawl_instagram_id ); // (1~1.25 minute delay)
      }
    }
    };

//  ZERO = manage setTimout of timers ===========================================
  var timerPostStructure      = function ( fancrawl_instagram_id, state ) {
    if ( !timer[ fancrawl_instagram_id ] ) {
      timer[ fancrawl_instagram_id ]                        = {};
    }
    if ( !timer[ fancrawl_instagram_id ].post_queue ) {
      timer[ fancrawl_instagram_id ].post_queue             = {}; // handles sequence of people to follow or unfollow
      timer[ fancrawl_instagram_id ].post_queue.follow      = {}; // handles sequence of people to follow or unfollow
      timer[ fancrawl_instagram_id ].post_queue.unfollow    = {}; // handles sequence of people to follow or unfollow
      timer[ fancrawl_instagram_id ].post_counter           = 0; // handles sequence of people to follow or unfollow
      timer[ fancrawl_instagram_id ].post_minute            = false; // keep track of a minute has gone by
    }
    if ( state === "force" ) {
      timer[ fancrawl_instagram_id ].post_queue             = {}; // handles sequence of people to follow or unfollow
      timer[ fancrawl_instagram_id ].post_queue.follow      = {}; // handles sequence of people to follow or unfollow
      timer[ fancrawl_instagram_id ].post_queue.unfollow    = {}; // handles sequence of people to follow or unfollow
    }
    };

//  ZERO = manage setTimout of timers ===========================================
  var timerQuickStructure     = function ( fancrawl_instagram_id, state ) {
    if ( !timer[ fancrawl_instagram_id ] ) {
      timer[ fancrawl_instagram_id ]                        = {};
    }
    if ( !timer[ fancrawl_instagram_id ].quick_queue ) {
      timer[ fancrawl_instagram_id ].quick_queue            = {}; // handles relationship sequences
      timer[ fancrawl_instagram_id ].quick_queue.verify     = {}; // handles sequence of people to verify
      timer[ fancrawl_instagram_id ].quick_queue.new        = {}; // handles sequence of people to add
      timer[ fancrawl_instagram_id ].quick_counter          = 0; // handles new versus verify
      timer[ fancrawl_instagram_id ].quick_seconds          = false; // keep track of minimum seconds separation
    }
    if ( state  === "force" ) {
      timer[ fancrawl_instagram_id ].quick_queue            = {}; // handles relationship sequences
      timer[ fancrawl_instagram_id ].quick_queue.verify     = {}; // handles sequence of people to verify
      timer[ fancrawl_instagram_id ].quick_queue.new        = {}; // handles sequence of people to add
    }
    };

//  ZERO = neutral timer function for post requests =============================
  var timer_post              = function ( fancrawl_instagram_id ) {

    // checks that timer structure exists
    // timerPostStructure( fancrawl_instagram_id );

    // IF POST_MINUTE = FALSE
    if ( timer[ fancrawl_instagram_id ].post_minute === false ) {
      // ENABLE
      timer[ fancrawl_instagram_id ].post_minute = true;
      // SETTIMEOUT LONG
      callTimer( fancrawl_instagram_id, "post_long" );

        // CHECK STATE OF USER
        connection.query('SELECT state FROM access_right where fancrawl_instagram_id = "'+ fancrawl_instagram_id +'"', function(err, rows, fields) {
          if (err) throw err;

          // IF STOPPED DELETE QUEUES
          if ( rows[0].state === 'stopped' ) {

            // RESET post_timer & quick_timer
            timerPostStructure( fancrawl_instagram_id, "force" );
            timerQuickStructure( fancrawl_instagram_id, "force" );

          // PROCESS STARTED OR CLEANING SO CARRY ON
          } else if ( rows[0].state === 'started' || rows[0].state === 'cleaning' ) {
            // normal behavior
            var postQueueCount      = Object.keys( timer[ fancrawl_instagram_id ].post_queue.unfollow ).length,
                followCount         = [],  // pulls out the FanCrawl id that has a follow process
                unfollowCount       = [];  // pulls out the FanCrawl id that has a follow process

            for ( keys in timer[ fancrawl_instagram_id ].post_queue.unfollow ) {
              unfollowCount.push( keys );
            }

            for ( keys in timer[ fancrawl_instagram_id ].post_queue.follow ) {
              followCount.push( keys );
            }

            if ( postQueueCount !== 0 ) {
              // ramp cap conditions
              if ( postQueueCount > queueCap ) {
                timer[ fancrawl_instagram_id ].counterCap = 5;
              } else if ( postQueueCount > ( queueCap * 0.75 ) ) {
                timer[ fancrawl_instagram_id ].counterCap = 4;
              } else if ( postQueueCount > ( queueCap * 0.5 ) ) {
                timer[ fancrawl_instagram_id ].counterCap = 3;
              } else {
                timer[ fancrawl_instagram_id ].counterCap = 2;
              }
            } else {
              timer[ fancrawl_instagram_id ].counterCap = 0;
            }

            if ( postQueueCount < queueCap ) {
              // console.log("THE TIMER!: ", timer);

              if ( timer[ fancrawl_instagram_id ].post_counter === 0 ) {
                // follow first if followCounter has something
                if ( followCount[0] ) {
                  var last_instagram_following_id = followCount[0];

                  POST_follow( fancrawl_instagram_id, last_instagram_following_id, function( fancrawl_instagram_id, last_instagram_following_id ){
                    delete timer[ fancrawl_instagram_id ].post_queue.follow[ last_instagram_following_id ];

                    if ( fancrawl_instagram_id === 571377691 || fancrawl_instagram_id === "571377691" ) {
                      console.log("Special counter = " + specialCounter + " and counterCap = " + timer[ fancrawl_instagram_id ].counterCap );
                      console.log("TIMER POST FOLLOW - deleted "+fancrawl_instagram_id+": "+last_instagram_following_id+" of process POST_FOLLOW");
                      console.log( timer[ fancrawl_instagram_id ] );
                      specialCounter++;
                    }
                  });
                } else if ( unfollowCount[0] ){
                  var last_instagram_following_id = unfollowCount[0];
                  var process = timer[ fancrawl_instagram_id ].post_queue.unfollow[ last_instagram_following_id ];

                  if ( process === "unfollow" ) {
                    POST_unfollow( fancrawl_instagram_id, last_instagram_following_id, "", function( fancrawl_instagram_id, last_instagram_following_id ){
                      delete timer[ fancrawl_instagram_id ].post_queue.unfollow[ last_instagram_following_id ];

                      if ( fancrawl_instagram_id === 571377691 || fancrawl_instagram_id === "571377691" ) {
                        console.log("Special counter = " + specialCounter + " and counterCap = " + timer[ fancrawl_instagram_id ].counterCap );
                        console.log("TIMER POST UNFOLLOW - deleted "+fancrawl_instagram_id+": "+last_instagram_following_id+" of process POST_UNFOLLOW");
                        console.log( timer[ fancrawl_instagram_id ] );
                        specialCounter++;
                      }
                    });
                  } else if ( process === "unfollow_followedby" ) {
                    POST_unfollow( fancrawl_instagram_id, last_instagram_following_id, true, function( fancrawl_instagram_id, last_instagram_following_id ){
                      delete timer[ fancrawl_instagram_id ].post_queue.unfollow[ last_instagram_following_id ];
                      if ( fancrawl_instagram_id === 571377691 || fancrawl_instagram_id === "571377691" ) {
                        console.log("Special counter = " + specialCounter + " and counterCap = " + timer[ fancrawl_instagram_id ].counterCap );
                        console.log("TIMER POST UNFOLLOW_FOLLOWEDBY - marked "+fancrawl_instagram_id+": "+last_instagram_following_id+" of process POST_UNFOLLOW");
                        console.log( timer[ fancrawl_instagram_id ] );
                        specialCounter++;
                      }
                    });
                  } else {
                    console.log("TIMER POST XXXX - No process found... "+process);

                  }
                }
                timer[ fancrawl_instagram_id ].post_counter = timer[ fancrawl_instagram_id ].counterCap;
              } else {
                if ( unfollowCount[0] ) {
                  var last_instagram_following_id = unfollowCount[0];
                  var process = timer[ fancrawl_instagram_id ].post_queue.unfollow[ last_instagram_following_id ];

                  if ( process === "unfollow" ) {
                    POST_unfollow( fancrawl_instagram_id, last_instagram_following_id, "", function( fancrawl_instagram_id, last_instagram_following_id ){
                      delete timer[ fancrawl_instagram_id ].post_queue.unfollow[ last_instagram_following_id ];
                      if ( fancrawl_instagram_id === 571377691 || fancrawl_instagram_id === "571377691" ) {
                        console.log("Special counter = " + specialCounter + " and counterCap = " + timer[ fancrawl_instagram_id ].counterCap );
                        console.log("TIMER POST UNFOLLOW - deleted "+fancrawl_instagram_id+": "+last_instagram_following_id+" of process POST_UNFOLLOW");
                        console.log( timer[ fancrawl_instagram_id ] );
                        specialCounter++;
                      }
                    });
                  } else if ( process === "unfollow_followedby" ) {
                    POST_unfollow( fancrawl_instagram_id, last_instagram_following_id, true, function( fancrawl_instagram_id, last_instagram_following_id ){
                      delete timer[ fancrawl_instagram_id ].post_queue.unfollow[ last_instagram_following_id ];
                      if ( fancrawl_instagram_id === 571377691 || fancrawl_instagram_id === "571377691" ) {
                        console.log("Special counter = " + specialCounter + " and counterCap = " + timer[ fancrawl_instagram_id ].counterCap );
                        console.log("TIMER POST UNFOLLOW_FOLLOWEDBY "+fancrawl_instagram_id+": "+last_instagram_following_id+" of process POST_UNFOLLOW");
                        console.log( timer[ fancrawl_instagram_id ] );
                        specialCounter++;
                      }
                    });
                  } else {
                    console.log("TIMER POST XXXX - No process found... "+process);
                  }
                } else if ( followCount[0] ) {
                  var last_instagram_following_id = followCount[0];

                  POST_follow( fancrawl_instagram_id, last_instagram_following_id, function( fancrawl_instagram_id, last_instagram_following_id ){
                    delete timer[ fancrawl_instagram_id ].post_queue.follow[ last_instagram_following_id ];
                    if ( fancrawl_instagram_id === 571377691 || fancrawl_instagram_id === "571377691" ) {
                      console.log("Special counter = " + specialCounter + " and counterCap = " + timer[ fancrawl_instagram_id ].counterCap );
                      console.log("TIMER POST FOLLOW - deleted "+fancrawl_instagram_id+": "+last_instagram_following_id+" of process POST_FOLLOW");
                      console.log( timer[ fancrawl_instagram_id ] );
                      specialCounter++;
                    }
                  });
                }
                timer[ fancrawl_instagram_id ].post_counter--;
              }

            } else {
              console.log("clockManager is not working properly.... "+postQueueCount+" keys in the post_timer");
            }
          }
        });
      /////////////////////////////////////////////////////////////////////

    // IF TRUE TO SETTIMEOUT SHORT
    } else {
      callTimer( fancrawl_instagram_id, "post_short" );
    }
    };

//  ZERO = neutral timer function for regular request ===========================
  var timer_quick             = function ( fancrawl_instagram_id ) {

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
          if ( rows && rows[0] && rows[0].state && rows[0].state === 'stopped' ) {
            // RESET post_timer
            timerPostStructure( fancrawl_instagram_id, "force" );
            timerQuickStructure( fancrawl_instagram_id, "force" );

          // PROCESS STARTED OR CLEANING SO CARRY ON
          } else if ( rows && rows[0] && rows[0].state && rows[0].state === 'started' || rows[0].state === 'cleaning' ) {

            // var count = [];
            var count_verify = [];
            var count_new = [];

            for ( keys in timer[ fancrawl_instagram_id ].quick_queue.verify ) {
              count_verify.push(keys);
            }

            for ( keys in timer[ fancrawl_instagram_id ].quick_queue.new ) {
              count_new.push(keys);
            }

            if ( count_verify.length === 0 && count_new.length === 0 ) {
              // lists are empty so do nothing

            } else if ( count_verify.length === 0 ) {

              if ( count_new.length ) {

                // get new
                var new_instagram_following_id = count_new[0];
                var process = timer[ fancrawl_instagram_id ].quick_queue.new[ new_instagram_following_id ];
              }
            } else if ( count_new.length === 0 ) {

              if ( count_verify.length ) {

                // get verify
                var new_instagram_following_id = count_verify[0];
                var process = timer[ fancrawl_instagram_id ].quick_queue.verify[ new_instagram_following_id ];
              }
            } else {
              if ( timer[ fancrawl_instagram_id ].quick_counter === 0 ) {
                timer[ fancrawl_instagram_id ].quick_counter = 3;
                var new_instagram_following_id = count_new[0];
                var process = timer[ fancrawl_instagram_id ].quick_queue.new[ new_instagram_following_id ];
              } else {
                timer[ fancrawl_instagram_id ].quick_counter--;
                var new_instagram_following_id = count_verify[0];
                var process = timer[ fancrawl_instagram_id ].quick_queue.verify[ new_instagram_following_id ];
              }
            }

            if ( process ) {
              if ( process === "new" ) {

                // check relationship and unfollow with proper
                GET_relationship( fancrawl_instagram_id, new_instagram_following_id, function( fancrawl_instagram_id, new_instagram_following_id, relationship ){
                  if ( relationship === "not_exist" ) {
                    // DELETE FROM LIST
                    delete timer[ fancrawl_instagram_id ].quick_queue.new[ new_instagram_following_id ];
                    // console.log("NEW ADDED USER DID NOT EXIST - Deleted from quick list");

                  } else if ( relationship === "access_token" ) {
                    // error to deal with...
                    if ( !usersInfo[ fancrawl_instagram_id ] ) {
                      usersInfo[ fancrawl_instagram_id ] = {};
                    }
                    if ( !usersInfo[ fancrawl_instagram_id ].access_token ) {
                      STOP( fancrawl_instagram_id, true );
                    }
                    usersInfo[ fancrawl_instagram_id ].access_token = "FanCrawl blocked from IG - Go to your IG app to unblock.";

                  } else if ( relationship === "APINotAllowedError" ) {
                    // error to deal with...
                    if ( !usersInfo[ fancrawl_instagram_id ] ) {
                      usersInfo[ fancrawl_instagram_id ] = {};
                    }
                    connection.query('UPDATE beta_followers SET count = 5 WHERE fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND added_follower_instagram_id = "'+new_instagram_following_id+'"', function(err, rows, fields) {
                      if (err) throw err;
                      usersInfo[ fancrawl_instagram_id ].APINotAllowedError = "There has been a special API Error - Report this issue.";
                      delete timer[ fancrawl_instagram_id ].quick_queue.new[ new_instagram_following_id ];
                    });

                  } else if ( relationship === "oauth_limit" ) {
                    // error to deal with...
                    if ( !usersInfo[ fancrawl_instagram_id ] ) {
                      usersInfo[ fancrawl_instagram_id ] = {};
                    }
                    usersInfo[ fancrawl_instagram_id ].oauth_limit = "oauth_limit error";

                    sendMail( "571377691", "OAUTH Limit error", JSON.stringify(pbody) + " from user: " + fancrawl_instagram_id );


                  } else if ( relationship === "followed_by" || relationship === "followed_by_and_requested" || relationship === "both" ) {
                    // console.log("ADDED TO CLOCK MANAGER FOLLOW: ", fancrawl_instagram_id );
                    if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].access_token ) {
                      delete usersInfo[ fancrawl_instagram_id ].access_token;
                    }
                    if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].oauth_limit ) {
                      delete usersInfo[ fancrawl_instagram_id ].oauth_limit;
                    }
                    if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].APINotAllowedError ) {
                      delete usersInfo[ fancrawl_instagram_id ].APINotAllowedError;
                    }

                    delete timer[ fancrawl_instagram_id ].quick_queue.new[ new_instagram_following_id ];
                    clockManager( fancrawl_instagram_id, new_instagram_following_id, "unfollow_followedby" );

                  } else if ( relationship === "neither" || relationship === "follows" || relationship === "requested" ) {
                    if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].access_token ) {
                      delete usersInfo[ fancrawl_instagram_id ].access_token;
                    }
                    if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].oauth_limit ) {
                      delete usersInfo[ fancrawl_instagram_id ].oauth_limit;
                    }
                    if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].APINotAllowedError ) {
                      delete usersInfo[ fancrawl_instagram_id ].APINotAllowedError;
                    }

                    delete timer[ fancrawl_instagram_id ].quick_queue.new[ new_instagram_following_id ];
                    clockManager( fancrawl_instagram_id, new_instagram_following_id, "follow");
                  }
                });

              } else if ( process === "unfollow_verify" ) {

                // check relationship and then time difference if needs be
                GET_relationship( fancrawl_instagram_id, new_instagram_following_id, function( fancrawl_instagram_id, new_instagram_following_id, relationship ){
                  // console.log("RELATIONSHIP RESPONSE STATUS FOR USER "+fancrawl_instagram_id+" & "+new_instagram_following_id+" = "+relationship );
                  if ( relationship === "access_token" ) {
                    // error to deal with...
                    if ( !usersInfo[ fancrawl_instagram_id ] ) {
                      usersInfo[ fancrawl_instagram_id ] = {};
                    }
                    if ( !usersInfo[ fancrawl_instagram_id ].access_token ) {
                      STOP( fancrawl_instagram_id, true );
                    }
                    usersInfo[ fancrawl_instagram_id ].access_token = "FanCrawl blocked from IG - Go to your IG app to unblock.";

                  } else if ( relationship === "APINotAllowedError" ) {
                    // error to deal with...

                    if ( !usersInfo[ fancrawl_instagram_id ] ) {
                      usersInfo[ fancrawl_instagram_id ] = {};
                    }
                    connection.query('UPDATE beta_followers SET count = 5 WHERE fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND added_follower_instagram_id = "'+new_instagram_following_id+'"', function(err, rows, fields) {
                      if (err) throw err;
                      usersInfo[ fancrawl_instagram_id ].APINotAllowedError = "There has been a special API Error - Report this issue.";
                      delete timer[ fancrawl_instagram_id ].quick_queue.verify[ new_instagram_following_id ];
                    });

                  } else if ( relationship === "oauth_limit" ) {
                    // error to deal with...
                    if ( !usersInfo[ fancrawl_instagram_id ] ) {
                      usersInfo[ fancrawl_instagram_id ] = {};
                    }
                    usersInfo[ fancrawl_instagram_id ].oauth_limit = "The maximum number of IG requests per hour has been exceeded.";

                  } else if ( relationship === "followed_by" || relationship === "followed_by_and_requested" || relationship === "both" ) {
                    if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].access_token ) {
                      delete usersInfo[ fancrawl_instagram_id ].access_token;
                    }
                    if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].oauth_limit ) {
                      delete usersInfo[ fancrawl_instagram_id ].oauth_limit;
                    }
                    if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].APINotAllowedError ) {
                      delete usersInfo[ fancrawl_instagram_id ].APINotAllowedError;
                    }

                    delete timer[ fancrawl_instagram_id ].quick_queue.verify[ new_instagram_following_id ];
                    clockManager( fancrawl_instagram_id, new_instagram_following_id, "unfollow_followedby" );

                  // neither or just follow or just requested
                  } else if ( relationship === "not_exist" ) {
                    if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].access_token ) {
                      delete usersInfo[ fancrawl_instagram_id ].access_token;
                    }
                    if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].oauth_limit ) {
                      delete usersInfo[ fancrawl_instagram_id ].oauth_limit;
                    }
                    if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].APINotAllowedError ) {
                      delete usersInfo[ fancrawl_instagram_id ].APINotAllowedError;
                    }

                    delete timer[ fancrawl_instagram_id ].quick_queue.verify[ new_instagram_following_id ];
                    connection.query('UPDATE beta_followers SET count = 5, following_status = 0, followed_by_status = 0 WHERE fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND added_follower_instagram_id = "'+new_instagram_following_id+'"', function(err, rows, fields) {
                      if (err) throw err;
                      console.log("USER DELETED THERE ACCOUNT");
                    });


                  } else {
                    if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].access_token ) {
                      delete usersInfo[ fancrawl_instagram_id ].access_token;
                    }
                    if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].oauth_limit ) {
                      delete usersInfo[ fancrawl_instagram_id ].oauth_limit;
                    }
                    if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].APINotAllowedError ) {
                      delete usersInfo[ fancrawl_instagram_id ].APINotAllowedError;
                    }

                    delete timer[ fancrawl_instagram_id ].quick_queue.verify[ new_instagram_following_id ];
                    clockManager( fancrawl_instagram_id, new_instagram_following_id, "unfollow" );
                  }
                });

              } else if ( process === 3 || process === "3" || process === 2 || process === "2" || process === 1 || process === "1" || process === 0 || process === "0" ) {

                // check relationship and then time difference if needs be
                GET_relationship( fancrawl_instagram_id, new_instagram_following_id, function( fancrawl_instagram_id, new_instagram_following_id, relationship ){
                  if ( relationship === "access_token" ) {
                    // error to deal with...
                    if ( !usersInfo[ fancrawl_instagram_id ] ) {
                      usersInfo[ fancrawl_instagram_id ] = {};
                    }
                    if ( !usersInfo[ fancrawl_instagram_id ].access_token ) {
                      STOP( fancrawl_instagram_id, true );
                    }
                    usersInfo[ fancrawl_instagram_id ].access_token = "FanCrawl blocked from IG - Go to your IG app to unblock.";

                  } else if ( relationship === "APINotAllowedError" ) {
                    // error to deal with...
                    if ( !usersInfo[ fancrawl_instagram_id ] ) {
                      usersInfo[ fancrawl_instagram_id ] = {};
                    }
                    connection.query('UPDATE beta_followers SET count = 5 WHERE fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND added_follower_instagram_id = "'+new_instagram_following_id+'"', function(err, rows, fields) {
                      if (err) throw err;
                      usersInfo[ fancrawl_instagram_id ].APINotAllowedError = "There has been a special API Error - Report this issue.";
                      delete timer[ fancrawl_instagram_id ].quick_queue.verify[ new_instagram_following_id ];
                    });

                  } else if ( relationship === "oauth_limit" ) {
                    // error to deal with...
                    if ( !usersInfo[ fancrawl_instagram_id ] ) {
                      usersInfo[ fancrawl_instagram_id ] = {};
                    }
                    usersInfo[ fancrawl_instagram_id ].oauth_limit = "The maximum number of IG requests per hour has been exceeded.";

                  } else if ( relationship === "followed_by" || relationship === "followed_by_and_requested" || relationship === "both" ) {
                    if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].access_token ) {
                      delete usersInfo[ fancrawl_instagram_id ].access_token;
                    }
                    if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].oauth_limit ) {
                      delete usersInfo[ fancrawl_instagram_id ].oauth_limit;
                    }
                    if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].APINotAllowedError ) {
                      delete usersInfo[ fancrawl_instagram_id ].APINotAllowedError;
                    }

                    delete timer[ fancrawl_instagram_id ].quick_queue.verify[ new_instagram_following_id ];
                    clockManager( fancrawl_instagram_id, new_instagram_following_id, "unfollow_followedby" );

                  // neither or just follow or just requested
                  } else {
                    if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].access_token ) {
                      delete usersInfo[ fancrawl_instagram_id ].access_token;
                    }
                    if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].oauth_limit ) {
                      delete usersInfo[ fancrawl_instagram_id ].oauth_limit;
                    }
                    if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].APINotAllowedError ) {
                      delete usersInfo[ fancrawl_instagram_id ].APINotAllowedError;
                    }

                    // delete from queue
                    delete timer[ fancrawl_instagram_id ].quick_queue.verify[ new_instagram_following_id ];
                    // console.log("TIMER QUICK - deleted "+fancrawl_instagram_id+": "+new_instagram_following_id+" of process "+process);
                    // check time difference and wait for 48 hours and repeat
                    verifyRelationship( fancrawl_instagram_id, new_instagram_following_id );
                  }
                });
              } else {
                console.log("TIMER QUICK XXXX - No process found... "+process+" for user "+new_instagram_following_id);
              }
            }

          } else {
            console.log( "state undefined from timer_quick" )
          }
        });
      /////////////////////////// //////////////////////////////////////////

    // IF TRUE TO SETTIMEOUT SHORT
    } else {
      callTimer( fancrawl_instagram_id, "quick_short" );
    }
    };

//  ZERO = time difference calculator ===========================================
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

// No limits - 5000/hour total pack per user
//  ZERO = check user relationship ==============================================
  var GET_relationship            = function ( fancrawl_instagram_id, new_instagram_following_id, callback ) {

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

      request( options, function ( error, response, body ) {

        // if ( fancrawl_instagram_id === 571377691 || fancrawl_instagram_id === '571377691' ) {
        //   console.log("relationship "+new_instagram_following_id+" : ", body);
        // }

        // CHECK FOR BODY
        if (!error && response.statusCode === 200) {

          if ( typeof body === "string" ) {
            var pbody = JSON.parse( body );
          } else if ( typeof body === "object" ) {
            var pbody = body;
          } else {
            console.log( "NOT A STRING NOR OBJECT: ", body );
            var pbody = body;
          }

          if ( pbody && pbody.data ) {

            // FOLLOWED_BY BACK
            if ( pbody.data.outgoing_status && pbody.data.incoming_status ) {

              // NOT FOLLOWED NOR BEING FOLLOWED
              if( pbody.data.incoming_status === "none" ) {

                // NEITHER YOU OR THE ARE FOLLOWING ONE ANOTHER
                if( pbody.data.outgoing_status === "none" ) {
                  // {"meta":{"code":200},"data":{"outgoing_status":"none","target_user_is_private":true,"incoming_status":"none"}}
                  // console.log( "RELATIONSHIP: you "+fancrawl_instagram_id+" and user "+new_instagram_following_id+" are not following one another" );
                  callback(fancrawl_instagram_id, new_instagram_following_id, "neither");

                // ONLY FOLLOWS NEW USER
                } else if( pbody.data.outgoing_status === "requested"  ) {
                  // {"meta":{"code":200},"data":{"outgoing_status":"requested","target_user_is_private":true,"incoming_status":"none"}}
                  // console.log( "RELATIONSHIP: you "+fancrawl_instagram_id+" have requested to follow this user: "+new_instagram_following_id );
                  callback(fancrawl_instagram_id, new_instagram_following_id, "requested");


                // ONLY FOLLOWS NEW USER
                } else if( pbody.data.outgoing_status === "follows"  ) {
                  // {"meta":{"code":200},"data":{"outgoing_status":"follows","target_user_is_private":true,"incoming_status":"none"}}
                  // console.log( "RELATIONSHIP: you "+fancrawl_instagram_id+" are only following user: "+new_instagram_following_id );
                  callback(fancrawl_instagram_id, new_instagram_following_id, "follows");
                }

              } else if( pbody.data.incoming_status === "followed_by" ) {

                // ONLY FOLLOWED_BY BACK
                if( pbody.data.outgoing_status === "none" ) {
                  // {"meta":{"code":200},"data":{"outgoing_status":"none","target_user_is_private":true,"incoming_status":"followed_by"}}
                  // console.log( "RELATIONSHIP: "+new_instagram_following_id+" is following you "+fancrawl_instagram_id+" back" );
                  callback(fancrawl_instagram_id, new_instagram_following_id, "followed_by");

                // BOTH FOLLOW AND FOLLOWED_BY BACK
                } else if( pbody.data.outgoing_status === "requested" ) {
                  // {"meta":{"code":200},"data":{"outgoing_status":"requested","target_user_is_private":true,"incoming_status":"followed_by"}}
                  // console.log( "RELATIONSHIP: you "+fancrawl_instagram_id+" have requested to follow user "+new_instagram_following_id+" and he is following you back" );
                  callback(fancrawl_instagram_id, new_instagram_following_id, "followed_by_and_requested");

                // BOTH FOLLOW AND FOLLOWED_BY BACK
                } else if( pbody.data.outgoing_status === "follows" ) {
                  // {"meta":{"code":200},"data":{"outgoing_status":"follows","target_user_is_private":true,"incoming_status":"followed_by"}}
                  // console.log( "RELATIONSHIP: you "+fancrawl_instagram_id+" are following user "+new_instagram_following_id+" and he is following you back" );
                  callback(fancrawl_instagram_id, new_instagram_following_id, "both");

                }
              }

            } else {
              console.log("RELATIONSHIP: you "+fancrawl_instagram_id+"did not pick up on body of user "+new_instagram_following_id+" - ", body);
              callback(fancrawl_instagram_id, new_instagram_following_id, "error");
            }

          } else {
            console.log("RELATIONSHIP: "+fancrawl_instagram_id+" got an error from pbody "+new_instagram_following_id+" - ", pbody );
            callback(fancrawl_instagram_id, new_instagram_following_id, "error");
          }

        } else if ( response.statusCode !== 200 ) {
          // body: '{"meta":{"error_type":"APINotFoundError","code":400,"error_message":"this user does not exist"}}' }

          if ( response.statusCode !== 400 ) {
            console.log( 'response from line 785:', response );
          }
          if ( typeof body === "string" ) {
            var pbody = JSON.parse( body );
          } else if ( typeof body === "object" ) {
            var pbody = body;
          } else {
            console.log( "NOT A STRING NOR OBJECT: ", body );
            var pbody = body;
          }

          // DOES NOT EXIST - POST_FOLLOW THE NEXT USER
          if ( pbody.meta && pbody.meta.error_message && pbody.meta.error_message === "this user does not exist") {
            // {"meta":{"error_type":"APINotFoundError","code":400,"error_message":"this user does not exist"}}
            // console.log("RELATIONSHIP: "+new_instagram_following_id+" does not exist");
            callback(fancrawl_instagram_id, new_instagram_following_id, "not_exist");

          } else if ( pbody.meta && pbody.meta.error_type && pbody.meta.error_type === "APINotAllowedError") {
            // {"meta":{"error_type":"APINotAllowedError","code":400,"error_message":"you cannot view this resource"}}
            // sendMail( "571377691", "API Error", JSON.stringify(pbody) + " from user: " + fancrawl_instagram_id + "of relationships trying to follow: " + new_instagram_following_id );
            callback(fancrawl_instagram_id, new_instagram_following_id, "APINotAllowedError");

          // OAUTH TOKEN EXPIRED
          } else if( pbody.meta && pbody.meta.error_message && pbody.meta.error_message === "The access_token provided is invalid." ) {
            // {"meta":{"error_type":"OAuthParameterException","code":400,"error_message":"The access_token provided is invalid."}}
            console.log( "RELATIONSHIP: "+fancrawl_instagram_id+" MUST LOG IN AGAIN - NEED NEW TOKEN - OR VALIDATE ACCOUNT AGAIN");
            callback(fancrawl_instagram_id, new_instagram_following_id, "access_token");

          // OAUTH TIME LIMIT REACHED LET TIMER KNOW AND TRIES AGAIN
          } else if( pbody.meta && pbody.meta.error_type && pbody.meta.error_type === "OAuthRateLimitException" ) {
            // {"meta":{"error_type":"OAuthRateLimitException","code":429,"error_message":"The maximum number of requests per hour has been exceeded. You have made 91 requests of the 60 allowed in the last hour."}}
            console.log("RELATIONSHIP: LIMIT REACH FOR: "+fancrawl_instagram_id+" - ", body);
            callback(fancrawl_instagram_id, new_instagram_following_id, "oauth_limit");
          } else {
            console.log("RELATIONSHIP: "+fancrawl_instagram_id+" got a weird statusCode "+new_instagram_following_id+" - ", body);
            sendMail( 571377691, 'get relationship weird statusCode', 'The function GET_relationship got the following body: ' + body );
            callback(fancrawl_instagram_id, new_instagram_following_id, "error");
          }

        } else {
          console.log("RELATIONSHIP: "+fancrawl_instagram_id+" got an error "+new_instagram_following_id+" - ", error);
          sendMail( 571377691, 'get relationship error', 'The function GET_relationship got the following error: ' + error );
          callback(fancrawl_instagram_id, new_instagram_following_id, "error");
        }



      });
    });
    };

// 60/hour limit
//  ZERO = unfollow function ====================================================
  var POST_unfollow             = function ( fancrawl_instagram_id, new_instagram_following_id, followed_by, callback ) {

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
              // console.log("its part of the s_followed_by so do not unfollow");
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
              // console.log("G0_UNFOLLOW: "+new_instagram_following_id+" & "+body);
                if (!error && response.statusCode == 200) {
                  var pbody = JSON.parse(body);
                  if( pbody ) {
                    if( pbody.data.meta && pbody.meta && pbody.meta.error_type && pbody.meta.error_type === "OAuthRateLimitException" ){
                      // check for rate limit reach... if so keep on looping
                      // {"meta":{"error_type":"OAuthRateLimitException","code":429,"error_message":"The maximum number of requests per hour has been exceeded. You have made 91 requests of the 60 allowed in the last hour."}}

                      if ( !usersInfo[ fancrawl_instagram_id ] ) {
                        usersInfo[ fancrawl_instagram_id ] = {};
                      }
                      CONSOLE.LOG("POST_UNFOLLOW: OAUTH LIMIT RATE FOR: ", fancrawl_instagram_id );

                      sendMail( "571377691", "OAUTH Limit error", JSON.stringify(pbody) + " from user: " + fancrawl_instagram_id );

                      usersInfo[ fancrawl_instagram_id ].OAuthRateLimitException = "OAuthRateLimitException";

                      clockManager( fancrawl_instagram_id, new_instagram_following_id, "unfollow" );

                    } else if ( pbody.data && pbody.data.outgoing_status && pbody.data.outgoing_status === "none") {
                      if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].OAuthRateLimitException ) {
                        delete usersInfo[ fancrawl_instagram_id ].OAuthRateLimitException;
                      }
                      connection.query('UPDATE beta_followers SET count = 5, following_status = 0, followed_by_status = '+followed_by_status+' where fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND added_follower_instagram_id = "'+new_instagram_following_id+'"', function(err, rows, fields) {
                        if (err) throw err;
                        // console.log( "UN-FOLLOWED SUCCESSFULLY: ", new_instagram_following_id );
                        if ( callback ) {
                          // console.log( "CALLBACK OF POST_UNFOLLOW FOR: ", new_instagram_following_id );
                          callback( fancrawl_instagram_id, new_instagram_following_id );
                        }
                      });
                    }
                  }

                } else if (error) {
                  console.log('POST_unfollow error ('+new_instagram_following_id+'): ', error);
                  sendMail( 571377691, 'post unfollow error', 'The function POST_unfollow got the following error: ' + error );
                }
              });
            });
          }
        });

      });
    });

    }

// 60/hour limit
//  ZERO = follow function ======================================================
  var POST_follow               = function ( fancrawl_instagram_id, new_instagram_following_id, callback ) {
    // console.log("IN GO FOLLOW FOR: "+fancrawl_instagram_id+" & "+new_instagram_following_id);
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
              console.log("POST_FOLLOW - OAUTH RATE LIMIT EXCEPTION");
              // check for rate limit reach... if so keep on looping
              // {"meta":{"error_type":"OAuthRateLimitException","code":429,"error_message":"The maximum number of requests per hour has been exceeded. You have made 91 requests of the 60 allowed in the last hour."}}
              if ( !usersInfo[ fancrawl_instagram_id ] ) {
                usersInfo[ fancrawl_instagram_id ] = {};
              }

              sendMail( "571377691", "OAUTH Limit error", JSON.stringify(pbody) + " from user: " + fancrawl_instagram_id );

              usersInfo[ fancrawl_instagram_id ].OAuthRateLimitException = "The maximum number of IG requests per hour has been exceeded.";

              clockManager( fancrawl_instagram_id, new_instagram_following_id, "follow" );

            } else if( pbody.data && pbody.data.outgoing_status ){
              if ( pbody.data.outgoing_status === "follows" || pbody.data.outgoing_status === "requested" ) {
                if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].OAuthRateLimitException ) {
                  delete usersInfo[ fancrawl_instagram_id ].OAuthRateLimitException;
                }
                connection.query('INSERT INTO beta_followers SET fancrawl_instagram_id = '+fancrawl_instagram_id+', added_follower_instagram_id = '+new_instagram_following_id, function(err, rows, fields) {
                  if (err) throw err;

                  verifyRelationship( fancrawl_instagram_id, new_instagram_following_id );
                  // console.log( "FOLLOWED SUCCESSFULLY: ", new_instagram_following_id );
                  if ( callback ) {
                    // console.log( "CALL BACK FROM POST_FOLLOW FOR: ", new_instagram_following_id );
                    callback( fancrawl_instagram_id, new_instagram_following_id );
                  }
                });
              }
            } else {
              console.log("POST_follow - did not complete properly... for: "+fancrawl_instagram_id+" on user: "+new_instagram_following_id);
            }
          }
        } else if (error) {
          console.log('POST_follow error ('+new_instagram_following_id+'): ', error);
          sendMail( 571377691, 'go follow error', 'The function POST_follow got the following error: ' + error );
        }
      });
    });
    }

// No limits - 5000/hour total pack per user
//  ZERO = current users followers data =========================================
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
              console.log("POST_FOLLOW - OAUTH RATE LIMIT EXCEPTION");
              // check for rate limit reach... if so keep on looping
              // {"meta":{"error_type":"OAuthRateLimitException","code":429,"error_message":"The maximum number of requests per hour has been exceeded. You have made 91 requests of the 60 allowed in the last hour."}}
              if ( !usersInfo[ fancrawl_instagram_id ] ) {
                usersInfo[ fancrawl_instagram_id ] = {};
              }
              usersInfo[ fancrawl_instagram_id ].OAuthRateLimitException = "OAuthRateLimitException";
              callback("N/A", "N/A" );

            } else if( pbody.data ){
              if ( pbody.data.counts ) {
                if ( pbody.data.counts.follows || pbody.data.counts.follows === 0 ) {
                  if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].OAuthRateLimitException ) {
                    delete usersInfo[ fancrawl_instagram_id ].OAuthRateLimitException;
                  }
                  if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].OAuthAccessTokenException ) {
                    delete usersInfo[ fancrawl_instagram_id ].OAuthAccessTokenException;
                  }
                  callback( pbody.data.counts.follows, pbody.data.counts.followed_by );
                }
              }
            } else {
              console.log("POST_follow - did not complete properly...");
            }
          }
        } else if (error) {
          console.log('POST_follow error: ', error);
          sendMail( 571377691, 'get stats error', 'The function GET_stats got the following error: ' + error );
          callback( "N/A" , "N/A" );
        } else {
          if ( !usersInfo[ fancrawl_instagram_id ] ) {
            usersInfo[ fancrawl_instagram_id ] = {};
          }
          usersInfo[ fancrawl_instagram_id ].OAuthAccessTokenException = "Refresh token by signing out and back in";
          callback( "N/A" , "N/A" );
        }
      });
    });
    }

//  ZERO = Clock Manage  ========================================================
  var clockManager            = function ( fancrawl_instagram_id, new_instagram_following_id, process, callback ) {
    timerPostStructure( fancrawl_instagram_id );

    // look up relevant clock queue
    if ( process === "follow" ) {

      var post_countFollow = Object.keys( timer[ fancrawl_instagram_id ].post_queue.follow ).length;

        if ( post_countFollow < ( queueCap - 2 ) ) {
          timer[ fancrawl_instagram_id ].post_queue.follow[ new_instagram_following_id ] = process;

          if ( callback ) {
            callback( fancrawl_instagram_id, new_instagram_following_id );
          }

        // else setTimeout 5 min recursing same stats
        } else {
          var time = 1000 * 60 * 5;
          setTimeouts[ fancrawl_instagram_id ][ new_instagram_following_id ] = setTimeout(
            function(){
            clockManager( arguments[0] , arguments[1], arguments[2], arguments[3] );
            delete setTimeouts[ arguments[0] ][ arguments[1] ];
          }, time, fancrawl_instagram_id, new_instagram_following_id, process, callback );
        }

    } else if ( process === "unfollow" || process === "unfollow_followedby") {

      var post_countUnfollow = Object.keys( timer[ fancrawl_instagram_id ].post_queue.unfollow ).length;

        if ( post_countUnfollow < ( queueCap - 2 ) ) {
          timer[ fancrawl_instagram_id ].post_queue.unfollow[ new_instagram_following_id ] = process;

          if ( callback ) {
            callback( fancrawl_instagram_id, new_instagram_following_id );
          }

        // else setTimeout 5 min recursing same stats
        } else {
          var time = 1000 * 60 * 5;
          setTimeouts[ fancrawl_instagram_id ][ new_instagram_following_id ] = setTimeout(
            function(){
            clockManager( arguments[0] , arguments[1], arguments[2], arguments[3] );
            delete setTimeouts[ arguments[0] ][ arguments[1] ];
          }, time, fancrawl_instagram_id, new_instagram_following_id, process, callback );
        }
    // TIMER QUICK CONFIGURATIONS
    } else if ( process === "new" ) {

      // var quick_count = Object.keys( timer[ fancrawl_instagram_id ].quick_queue ).length;
      var quick_count_new = Object.keys( timer[ fancrawl_instagram_id ].quick_queue.new ).length;
      // var post_count = Object.keys( timer[ fancrawl_instagram_id ].post_queue.unfollow ).length + Object.keys( timer[ fancrawl_instagram_id ].post_queue.follow ).length;

      // if < then 100 = add to queue and run callback
      // if ( quick_count_new < ( queueCap - 2 ) && post_count < ( queueCap - 2 ) ) {
      if ( quick_count_new < ( queueCap - 2 ) ) {
        // console.log("CURRENT USER: ", fancrawl_instagram_id);
        timer[ fancrawl_instagram_id ].quick_queue.new[ new_instagram_following_id ] = process;
        if ( callback ) {
          callback( fancrawl_instagram_id, new_instagram_following_id, process );
        }

      // else setTimeout 10 seconds recursing same stats
      } else {
        var time = 1000 * 10;
        setTimeouts[ fancrawl_instagram_id ][ new_instagram_following_id ] = setTimeout(
          function(){
          clockManager( arguments[0] , arguments[1], arguments[2], arguments[3] );
          delete setTimeouts[ arguments[0] ][ arguments[1] ];
        }, time, fancrawl_instagram_id , new_instagram_following_id, process, callback );
      }
    } else {
      // if process = "unfollow_verify" or 3,2,1,0

      // var quick_count = Object.keys( timer[ fancrawl_instagram_id ].quick_queue ).length;
      var quick_count_verify = Object.keys( timer[ fancrawl_instagram_id ].quick_queue.verify ).length;
      // var post_count = Object.keys( timer[ fancrawl_instagram_id ].post_queue.unfollow ).length + Object.keys( timer[ fancrawl_instagram_id ].post_queue.follow ).length;

      // if < then 100 = add to queue and run callback
      // if ( quick_count_verify < ( queueCap - 2 ) && post_count < ( queueCap - 2 ) ) {
      if ( quick_count_verify < ( queueCap - 2 ) ) {
        // console.log("CURRENT USER: ", fancrawl_instagram_id);
        timer[ fancrawl_instagram_id ].quick_queue.verify[ new_instagram_following_id ] = process;
        if ( callback ) {
          callback( fancrawl_instagram_id, new_instagram_following_id, process );
        }

      // else setTimeout 10 seconds recursing same stats
      } else {
        var time = 1000 * 10;
        setTimeouts[ fancrawl_instagram_id ][ new_instagram_following_id ] = setTimeout(
          function(){
          clockManager( arguments[0] , arguments[1], arguments[2], arguments[3] );
          delete setTimeouts[ arguments[0] ][ arguments[1] ];
        }, time, fancrawl_instagram_id , new_instagram_following_id, process, callback );
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

//  ZERO = check if in already in beta_followers databases ======================
  var checkIfInDatabase       = function ( fancrawl_instagram_id, new_instagram_following_id, callback ) {
    connection.query('SELECT added_follower_instagram_id FROM beta_followers WHERE fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
      if (err) throw err;
      if ( rows && rows[0] ) {
        for ( var i = 0; i < rows.length; i++ ) {
          if ( rows[i].added_follower_instagram_id === new_instagram_following_id ) {
            callback( fancrawl_instagram_id, new_instagram_following_id, true );
            return;
          }
        }
        callback( fancrawl_instagram_id, new_instagram_following_id, false );
      } else {
        callback( fancrawl_instagram_id, new_instagram_following_id, false );
      }
    });
    };

//  ZERO = follow crawler function ==============================================
  var fetchNewFollowers       = function ( fancrawl_instagram_id, new_instagram_following_id ) {
    // CHECK STATE FOR STOPPED
    connection.query('SELECT state FROM access_right where fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
      if (err) throw err;

      // IF SO THEN STOP
      if ( rows[0].state === "stopped" || rows[0].state === "cleaning" ) {
        console.log("FETCH NEW FOLLOWERS STOPPED DUE TO STOPPED STATE FOR USER: ", fancrawl_instagram_id);

      // IN STARTED OR CLEANING STATE
      } else {
        // CHECK IF IT IS IN ANY SECURED TABLES
        // console.log("checking secure DB");
        checkSecured( fancrawl_instagram_id, new_instagram_following_id, function( fancrawl_instagram_id, new_instagram_following_id, status ) {
          // NOT IN ANY DATABASE SO CHECK RELATIOSHIP AND ADD TO DB
          if ( status === "neither" ) {
          // console.log("not in secure DB");
            checkIfInDatabase( fancrawl_instagram_id, new_instagram_following_id, function( fancrawl_instagram_id, new_instagram_following_id, result ){
              if ( result === true ) {
                var nextUser = JSON.parse( new_instagram_following_id ) + 1;
                fetchNewFollowers( fancrawl_instagram_id, nextUser );
              } else {

                var quick_count = Object.keys( timer[ fancrawl_instagram_id ].quick_queue.new ).length;

                // if < then 100 = add to queue and run callback
                if ( quick_count < ( queueCap - 4 ) ) {
                  clockManager( fancrawl_instagram_id, new_instagram_following_id, "new", function( fancrawl_instagram_id, new_instagram_following_id ) {
                    var nextUser = JSON.parse( new_instagram_following_id ) + 1;
                    fetchNewFollowers( fancrawl_instagram_id, nextUser );
                  });
                } else {
                  var time = 1000 * 30;
                  setTimeouts[ fancrawl_instagram_id ][ new_instagram_following_id ] = setTimeout(
                    function(){
                    fetchNewFollowers( arguments[0], arguments[1] );
                    delete setTimeouts[ arguments[0] ][ arguments[1] ];
                  }, time, fancrawl_instagram_id, new_instagram_following_id );
                }

              }
            });

          // IN SECURED DB SO SKIP USER
          } else {
            // console.log("in secure DB");
            // console.log("FETCH NEW FOLLOWERS FOUND USER THAT WAS ALREADY IN SECURED DB, SKIPPED IT");
            // console.log("CLOCK MANAGER DONE LOADING NEXT USER");
            var nextUser = JSON.parse( new_instagram_following_id ) + 1;
            fetchNewFollowers( fancrawl_instagram_id, nextUser );
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
          // console.log("VERIFY RELATIONSHIP CODE: "+code+" for user "+new_instagram_following_id);
          var time_start  = JSON.parse(rows[0]['UNIX_TIMESTAMP(creation_date)']),
              time_now    = JSON.parse(rows[0]['UNIX_TIMESTAMP(now())']),
              time_diff   = (time_now - time_start) * 1000;


          // more then 2 days
          // console.log("VERIFY RELATIONSHIP: "+new_instagram_following_id+" code is "+code);
          if ( code === 4 ) {
            clockManager( fancrawl_instagram_id, new_instagram_following_id, "unfollow_verify" );

          // less then 2 days
          } else if ( code === 3 ) {
              // console.log("VERIFY RELATIONSHIP: "+new_instagram_following_id+" code is "+code);

            var two_days  = 1000 * 60 * 60 * 48,
                delay     = two_days - time_diff;

            setTimeouts[ fancrawl_instagram_id ][ new_instagram_following_id ] = setTimeout(
              function(){
                clockManager( arguments[0], arguments[1], arguments[2] );
                delete setTimeouts[ arguments[0] ][ arguments[1] ];
            }, delay, fancrawl_instagram_id, new_instagram_following_id, code ); // time between adding new followers (1 min wait)

          // less then 1 day
          } else if ( code === 2 ) {
            var one_day   = 1000 * 60 * 60 * 24,
                delay     = one_day - time_diff;

            setTimeouts[ fancrawl_instagram_id ][ new_instagram_following_id ] = setTimeout(
              function(){
                clockManager( arguments[0], arguments[1], arguments[2] );
                delete setTimeouts[ arguments[0] ][ arguments[1] ];
            }, delay, fancrawl_instagram_id, new_instagram_following_id, code ); // time between adding new followers (1 min wait)

          // less then 1 hour
          } else if ( code === 1 ) {
            var one_hour  = 1000 * 60 * 60,
                delay     = one_hour - time_diff;

            setTimeouts[ fancrawl_instagram_id ][ new_instagram_following_id ] = setTimeout(
              function(){
                clockManager( arguments[0], arguments[1], arguments[2] );
                delete setTimeouts[ arguments[0] ][ arguments[1] ];
            }, delay, fancrawl_instagram_id, new_instagram_following_id, code ); // time between adding new followers (1 min wait)

          // less then 5 min
          } else if ( code === 0 ) {
            var five_min  = 1000 * 60 * 5,
                delay     = five_min - time_diff;

            setTimeouts[ fancrawl_instagram_id ][ new_instagram_following_id ] = setTimeout(
              function(){
                clockManager( arguments[0], arguments[1], arguments[2] );
                delete setTimeouts[ arguments[0] ][ arguments[1] ];
            }, delay, fancrawl_instagram_id, new_instagram_following_id, code ); // time between adding new followers (1 min wait)
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
        var postCount = Object.keys( timer[ fancrawl_instagram_id ].post_queue.follow ).length + Object.keys( timer[ fancrawl_instagram_id ].post_queue.unfollow ).length;
        var quickCount = Object.keys( timer[ fancrawl_instagram_id ].quick_queue.verify ).length;

        if ( postCount !== 0 || quickCount !== 0 ) {
          // console.log("VERIFY CLEANING - POST COUNT: "+postCount+" for "+fancrawl_instagram_id );
          // console.log("VERIFY CLEANING - QUICK COUNT: "+quickCount+" for "+fancrawl_instagram_id );
          // not done check again after some time....
          // still got data to go through wait longer to check
          var postDelay = postCount * 60 * 1000;
          var quickDelay = quickCount * 5 * 1000;
          var totalDelay = postDelay + quickDelay;


          // console.log("VERIFY CLEANING - "+fancrawl_instagram_id+": "+JSON.stringify( timer[ fancrawl_instagram_id ] ) );
          setTimeout(
            function(){
            verifyCleaning( arguments[0], arguments[1] );
          }, totalDelay, fancrawl_instagram_id, callback );

        } else {
          // no post queue so can keep going
          if ( callback ) {
            // console.log("VERIFY CLEANING CALLBACK");
            callback( fancrawl_instagram_id );
          }
        }

      // no post_queue check quick_queue
      } else {
        if ( callback ) {
          // console.log("VERIFY CLEANING DID NOT FIND ITEMS IN QUEUES");
          callback( fancrawl_instagram_id );
        }
      }
    }
   };

//  ZERO = database duplicates and resets there count to zero to be rechecked ===
  var checkDuplicate          = function (fancrawl_instagram_id, callback ) {
    connection.query('SELECT added_follower_instagram_id FROM beta_followers WHERE fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
      if (err) throw err;
      // need to check for duplicate
      if ( rows && rows[0] ) {
        for ( var i = 0; i < ( rows.length - 1); i++ ) {
          for ( var j = ( i + 1 ); j < rows.length; j++ ) {
            if ( rows[i].added_follower_instagram_id === rows[j].added_follower_instagram_id ) {
              // console.log("Found Duplicate ID #: ", rows[i].added_follower_instagram_id );
              // console.log("should delete all dups and add it back to DB as a 0 value to be checked again");
              var new_instagram_following_id = rows[i].added_follower_instagram_id;
              connection.query('DELETE FROM beta_followers WHERE added_follower_instagram_id = "'+new_instagram_following_id+'" AND fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
                if (err) throw err;
                // console.log("fancrawl_instagram_id", fancrawl_instagram_id);
                // console.log("new_instagram_following_id", new_instagram_following_id);
                                  // insert into beta_followers set fancrawl_instagram_id = 571377691, added_follower_instagram_id = 871
                connection.query('INSERT INTO beta_followers SET fancrawl_instagram_id = "'+fancrawl_instagram_id+'", added_follower_instagram_id = "'+new_instagram_following_id+'"', function(err, rows, fields) {
                  if (err) throw err;
                  // console.log("should restart the check duplicate with same callback");
                  checkDuplicate( fancrawl_instagram_id, callback );
                });
              });
              return;
            }
          }
        }
        // console.log("NO DUPLICATE FOUND SO FINISHED / CALLBACK");
        if ( callback ) {
          callback( fancrawl_instagram_id );
        }
      } else {
        if ( callback ) {
          callback( fancrawl_instagram_id );
        }
      }
    });
    };

//  ZERO = check status of current database users ===============================
  var cleanDatabase           = function ( fancrawl_instagram_id, callback ) {
    // console.log("XXXXXXX = IN CLEANING DATABASE: ", fancrawl_instagram_id );
    checkDuplicate (fancrawl_instagram_id, function (fancrawl_instagram_id){
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
          console.log("XXXXXXX = IN CLEANING DATABASE: ", fancrawl_instagram_id );

            // DATABASE HAS USERS TO DEAL WITH
            for ( var i = 0; i < rows.length; i++ ) {
              var new_instagram_following_id = rows[i].added_follower_instagram_id;

              verifyRelationship( fancrawl_instagram_id, new_instagram_following_id )
            }

            var postCount = Object.keys( timer[ fancrawl_instagram_id ].post_queue.follow ).length + Object.keys( timer[ fancrawl_instagram_id ].post_queue.unfollow ).length;
            var quickCount = Object.keys( timer[ fancrawl_instagram_id ].quick_queue ).length;

            var postCountTime = postCount * 1000 * 80;
            var totalCountTime = quickCount + postCountTime;

            // console.log("CLEAN DATABASE - ROWS FOUND PRE SET TIMEOUT CALLBACK");
            setTimeout(
              function(){
              // console.log("CLEAN DATABASE - ROWS FOUND SET TIMEOUT CALLBACK");
              verifyCleaning( arguments[0], function( fancrawl_instagram_id ) {
                // console.log("CALLLLLLLLBACKKKKKK");
                // console.log(fancrawl_instagram_id);
                callback( fancrawl_instagram_id );
              });
            }, totalCountTime + 1000, fancrawl_instagram_id );

          } else {
            // DATABASE HAS NO USERS TO DEAL WITH ANYMORE
            // PROCEED WITH CALLBACK
            // console.log("CLEAN DATABASE - NO ROWS FOUND SO CALLBACK");
            callback( fancrawl_instagram_id );
          }
        });
      });
    });
    };

//  ZERO = isolate scopes per users =============================================
  var startIndividual         = function ( fancrawl_instagram_id ) {

    // START USER SPECIFIC CLOCK
    timerPostStructure( fancrawl_instagram_id );
    timerQuickStructure( fancrawl_instagram_id );

    // START CLOCK TRACKERS
    if ( !setTimeouts[ fancrawl_instagram_id ] ) {
      setTimeouts[ fancrawl_instagram_id ] = {};
    }

    // START CLOCKS ONLY ONCE! (RIGHT AWAY)
    timer_post( fancrawl_instagram_id );
    timer_quick( fancrawl_instagram_id );

    // START CLOCKS ONLY ONCE! (WITH DELAY)
    // callTimer( fancrawl_instagram_id, "quick_long" );
    // callTimer( fancrawl_instagram_id, "post_long" );

    connection.query('SELECT state FROM access_right where fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
      if (err) throw err;
      if( rows && rows[0] ) {

        GET_relationship( fancrawl_instagram_id, 571377691, function( fancrawl_instagram_id, new_instagram_following_id, response ){
          if ( response === "error" || response === "access_token" || response === "oauth_limit" ) {
            // do nothing
            connection.query('UPDATE access_right set state = "stopped" where fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
              if (err) throw err;
              console.log("API error or access_token missing or oauth_limit rate reached so stopped account "+fancrawl_instagram_id+" on server restart");
              console.log("STOPPED STATE: ", fancrawl_instagram_id);
              sendMail( fancrawl_instagram_id, "IG blocked account", "Go on Instagram and try liking a photo from your stream, if a captcha comes up then follow procedure, then log out of Instagram.com then sign back into http://fancrawl.io to re-register with FanCrawl. To reduce this try to post photos more frequently. Thank you." );
            });
          } else {

            // IF USER WAS STARTED
            if ( rows[0].state && rows[0].state === "started" ) {
              console.log("STARTED STATE: ", fancrawl_instagram_id);
              var state = rows[0].state;

              connection.query('select added_follower_instagram_id, count from beta_followers where fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND count not in (5)', function(err, rows, fields) {
                if (err) throw err;

                var obj = {};
                if ( rows && rows[0] ) {

                  var i = 0;
                  var func = function(){

                    verifyRelationship( arguments[0], arguments[1][i].added_follower_instagram_id );
                    if ( i < rows.length - 1 ) {
                      i++;
                    } else {
                      clearInterval( setTimeouts[ fancrawl_instagram_id ].startIndividualSetTimeout );
                    }
                  };

                  setTimeouts[ fancrawl_instagram_id ].startIndividualSetTimeout = setInterval( func, 250, fancrawl_instagram_id, rows );

                  connection.query('SELECT MAX(added_follower_instagram_id) AS added_follower_instagram_id from beta_followers where fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
                    if (err) throw err;
                    var currentUser = JSON.parse( fancrawl_instagram_id );

                    if ( rows && rows[0] ) {
                      var new_instagram_following_id = JSON.parse( rows[0].added_follower_instagram_id );

                      if ( new_instagram_following_id < currentUser ) {
                        var newUser = ( currentUser + 1 );
                        fetchNewFollowers( fancrawl_instagram_id, newUser );
                        console.log("STARTING FETCHING FOR USER "+fancrawl_instagram_id+", STARTING WITH: ", newUser );
                      } else {
                        fetchNewFollowers( fancrawl_instagram_id, new_instagram_following_id );
                        console.log("STARTING FETCHING FOR USER "+fancrawl_instagram_id+", STARTING WITH: ", new_instagram_following_id );
                      }
                    } else {
                      var new_instagram_following_id = ( currentUser + 1 );
                    }

                  });


                } else {

                  // console.log("FINISHED CLEANING UP DATABASE FROM RESTART & PRE STARTED: ", fancrawl_instagram_id);

                  var newUser = ( JSON.parse(fancrawl_instagram_id) + 1 );
                  fetchNewFollowers( fancrawl_instagram_id, newUser );

                  // console.log("STARTING FETCHING FOR USER "+fancrawl_instagram_id+", STARTING WITH: ", newUser );

                }

              });

            // IF USER WAS CLEANING
            } else if ( rows[0].state && rows[0].state === "cleaning" ) {
              console.log("CLEANING STATE: ", fancrawl_instagram_id);

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
      }
    });
    };

//  ZERO = server restart check =================================================
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

// No limits - 5000/hour total pack per user
//  ZERO = Get list of followed_by user =========================================
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
          console.log('GET_follows error ('+fancrawl_instagram_id+'): ', error);
          sendMail( 571377691, 'get follows error', 'The function GET_follows got the following error: ' + error );
        }

        if (pbody.pagination && pbody.pagination.next_cursor) {
          GET_follows( fancrawl_instagram_id, pbody.pagination.next_cursor, write, callback);

        } else {
          // console.log("done with pagination of GET_follows for user: "+fancrawl_instagram_id);
          if ( callback ) {
            // console.log("AT THE CALLBACK");
            callback( fancrawl_instagram_id );
          }
        }

      });
    });
    };

// No limits - 5000/hour total pack per user
//  ZERO = Get list of followed_by user =========================================
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
          console.log('GET_followed_by error ('+fancrawl_instagram_id+'): ', error);
          sendMail( 571377691, 'get followed by', 'The function GET_followed_by got the following error: ' + error );
        }

        if (pbody.pagination && pbody.pagination.next_cursor) {
          GET_followed_by( fancrawl_instagram_id, pbody.pagination.next_cursor, write, callback );
        } else {
          // console.log("done with pagination of GET_followed_by for user: "+fancrawl_instagram_id);
          if ( callback ) {
            callback( fancrawl_instagram_id );
          }
        }

      });
    });
    };

//  ZERO = Get last week metric =================================================
  var lastWeek                = function ( fancrawl_instagram_id, callback ) {
    connection.query('SELECT TO_DAYS( NOW() ) AS "now", TO_DAYS( creation_date ) AS "dates", COUNT(*) AS count FROM beta_followers WHERE fancrawl_instagram_id = "'+fancrawl_instagram_id+'" and followed_by_status = 1 and creation_date BETWEEN SUBDATE(CURDATE(), INTERVAL 6 day) AND NOW() GROUP BY DATE_FORMAT(creation_date, "%d");', function(err, rows, fields) {
      if (err) throw err;
      if ( rows && rows[0] ) {
        var result = [];
        var obj = {};
        var now = rows[0].now;

        for ( var i = 0; i < rows.length; i++ ) {
          var temp = rows[i].dates;
          var day = ( now - temp );
          obj[day] = rows[i].count;
        }

        for ( var j = 0; j < 6; j++ ) {
          if ( !obj[j] ) {
            obj[j] = 0;
          }
        }

        for ( keys in obj ) {
          result.push(obj[keys]);
        }
        callback(result);
      } else {
        callback([]);
      }
    });
    };

  var check_media_hash_tag    = function ( fancrawl_instagram_id, body, hash_tag, pagination, callback ) {

    var duplicates = false;
    // console.log(body.data[0].user);
    for ( var i = 0; i < body.data.length; i++ ) {
      if ( body && body.data && body.data[i] && body.data[i].type === 'image' && body.data[i].id && body.data[i].created_time && body.data[i].user && body.data[i].user.id ) {
        // checks if it is already in hash_tag database... if not saves it in there
        // check_media_hash_tag( body.data[i].user.id , body.data[i].id, hash_tag, body.data[i].created_time );
        connection.query('SELECT hash_tag, instagram_photo_id, created_time from hash_tags where hash_tag = "' + hash_tag + '" AND instagram_photo_id = "' + body.data[i].id + '"', function(err, rows, fields) {
          if (err) throw err;

          // if something exist in the database
          if ( rows && rows[0] ) {
            // console.log("Already in the database");
            duplicates = true;

          // otherwise
          } else {
            connection.query('INSERT INTO hash_tags set hash_tag = "' + hash_tag + '", instagram_user_id = "' + body.data[i].user.id + '", instagram_photo_id = "' + body.data[i].id + '", created_time = FROM_UNIXTIME(' + body.data[i].created_time + ')' , function(err, rows, fields) {
              if (err) throw err;
              console.log("Inserted in the database");
            });
          }
        });
      }
    }

    if ( duplicates ) {
      // callback(  )
    } else {
      // callback( fancrawl_instagram_id, hash_tag, pagination )
    }

    };


//  ZERO = Get media list of tags ===============================================
  var GET_hash_tag_media      = function ( fancrawl_instagram_id, hash_tag, pagination, callback ) {
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

      if ( pagination ) {
        // Configure the request
        var options = {
            uri: pagination,
            method: 'GET',
            headers: headers,
        }
      } else {
        var options = {
            uri: 'https://api.instagram.com/v1/tags/'+ hash_tag +'/media/recent',
            qs: {'access_token': rows[0].token},
            method: 'GET',
            headers: headers,
        }
      }

      request(options, function (error, response, body) {
        var pbody = JSON.parse( body );

        if ( !error && response.statusCode == 200 ) {
          if ( pbody.data && pbody.data[0] ) {
            check_media_hash_tag( fancrawl_instagram_id, pbody, hash_tag, pbody.pagination.next_url, function( fancrawl_instagram_id, hash_tag, pagination ){
              // GET_hash_tag_media( fancrawl_instagram_id, hash_tag, pagination );
            });
          }
        } else if ( error ) {
          console.log('GET_hash_tag_media error ('+fancrawl_instagram_id+'): ', error);
          sendMail( 571377691, 'get hash tag media error', 'The function GET_hash_tag_media got the following error: ' + error );
        }

        // if ( pbody.pagination && pbody.pagination.next_url ) {
          // GET_hash_tag_media( fancrawl_instagram_id, hash_tag, pbody.pagination.next_url );
          // pagination = pbody.pagination.next_url;
        // } else {

          // pagination = null;
        // }

        // if ( callback ) {

          // callback( fancrawl_instagram_id , tag, pagination );
        // }

      });
    });
    };

// check_media_hash_tag( 571377691, 40, "yellow", 1419540028 );

// GET_hash_tag_media( 571377691, "fountain" );

  // var insertHashTag           = function ( tag, fancrawl_instagram_id, callback )

//  =============================================================================
//  MAIN SECTIONS
//  =============================================================================

//  FIRST = load landing page '/' ===============================================
  exports.login               = function ( req, res ) {
    console.log("loggedin");
    res.render('./partials/login.ejs');
    };

//  SECOND = link to instagram authentication api for access token ==============
  exports.authorize_user      = function ( req, res ) {
    console.log("authorizing");
    var url = 'https://api.instagram.com/oauth/authorize/?client_id='+process.env.FANCRAWLCLIENTID+'&redirect_uri='+process.env.INSURIREDIRECT+'&response_type=code&state=a%20state&scope=likes+comments+relationships';
    res.redirect(url);
    };

//  THIRD = handle instagram response and check access rights ===================
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

      if ( typeof body === "string" ) {
        var pbody = JSON.parse( body );
        console.log("HANDLEN AUTH - it was a string");
        console.log(pbody);
      } else if ( typeof body === "object" ) {
        var pbody = body;
        console.log("HANDLEN AUTH - it was an object");
        console.log(pbody);
      } else {
        var pbody = body;
        console.log( "Body of Handleauth is neither a string or object: ", body );
      }


      if ( error || !pbody || !pbody.user || !pbody.user.id || !pbody.user.username ) {
        if ( error ) {
          console.log("Didn't work - most likely the Instagram secret key has been changed... For developer: Try rebooting the server. " + error);
        } else if ( pbody ) {
          console.log("Didn't work - most likely the Instagram secret key has been changed... For developer: Try rebooting the server. " + pbody);
        } else {
          console.log("Didn't work - most likely the Instagram secret key has been changed... For developer: Try rebooting the server. ");
        }
        res.redirect('/404/');
        return;
      } else {

        connection.query('SELECT fancrawl_username FROM access_right where fancrawl_instagram_id = '+ pbody.user.id, function(err, rows, fields) {
          if (err) throw err;

          // already signed in
          if ( rows && rows[0] && rows[0].fancrawl_username && rows[0].fancrawl_username === pbody.user.username){
            console.log("User "+pbody.user.id+" already existed and so granted");

            if ( usersInfo[ pbody.user.id ] ) {
              delete usersInfo[ pbody.user.id ];
            }

              connection.query('UPDATE access_right set fancrawl_full_name = "'+pbody.user.full_name+'", code = "'+req.query.code+'", token = "'+pbody.access_token+'", fancrawl_profile_picture = "'+pbody.user.profile_picture+'" where fancrawl_instagram_id = '+ pbody.user.id, function(err, rows, fields) {
                if (err) throw err;

                // IF FIRST TIME AUTHENTICATION THEN START USER SPECIFIC CLOCK
                if ( !setTimeouts[ pbody.user.id ] ) {
                  // START CLOCK TRACKERS
                  setTimeouts[ pbody.user.id ] = {};
                }

                if ( !timer[ pbody.user.id ] ) {
                  // START USER SPECIFIC CLOCK
                  timerPostStructure( pbody.user.id );
                  timerQuickStructure( pbody.user.id );

                  // START CLOCKS ONLY ONCE! (RIGHT AWAY)
                  // timer_post( fancrawl_instagram_id );
                  // timer_quick( fancrawl_instagram_id );

                  // START CLOCKS ONLY ONCE! (DELAYED)
                  callTimer( pbody.user.id, "quick_long" );
                  callTimer( pbody.user.id, "post_long" );
                }

                // redirect to the dashboard
                res.redirect('/dashboard?user='+pbody.user.username+'&id='+pbody.user.id);

              });
            return;

          // first time logging in
          } else {

            connection.query('INSERT INTO access_right set fancrawl_full_name = "'+pbody.user.full_name+'", fancrawl_username = "'+pbody.user.username+'", fancrawl_instagram_id = "'+pbody.user.id+'", code = "'+req.query.code+'", token = "'+pbody.access_token+'", fancrawl_profile_picture = "'+pbody.user.profile_picture+'"', function(err, rows, fields) {
              if (err) throw err;

              console.log("User "+pbody.user.id+" creation");
              sendMail( 571377691, 'NEW USER', pbody.user.full_name+' signed as '+pbody.user.username+' ('+pbody.user.id+'), just signed on to FanCrawl for the first time! WOOP WOOP!' );

              // IF FIRST TIME AUTHENTICATION THEN START USER SPECIFIC CLOCK
              if ( !setTimeouts[ pbody.user.id ] ) {
                // START CLOCK TRACKERS
                setTimeouts[ pbody.user.id ] = {};
              }

              if ( !timer[ pbody.user.id ] ) {
                // START USER SPECIFIC CLOCK
                timerPostStructure( pbody.user.id );
                timerQuickStructure( pbody.user.id );

                // START CLOCKS ONLY ONCE! (RIGHT AWAY)
                timer_post( pbody.user.id );
                timer_quick( pbody.user.id );

                // START CLOCKS ONLY ONCE! (WITH DELAY)
                // callTimer( pbody.user.id, "quick_long" );
                // callTimer( pbody.user.id, "post_long" );
              }

              GET_stats( pbody.user.id, function( follows, followed_by ){

                if ( follows === "N/A" ) {
                  console.log( "Error when first signing in from GET_STATS, follows" );
                  if (err) throw err;
                }

                if ( followed_by === "N/A" ) {
                  console.log( "Error when first signing in from GET_STATS, followed_by" );
                  if (err) throw err;
                }

                connection.query('UPDATE access_right set or_followed_by = '+followed_by+', or_following = '+follows+' where fancrawl_instagram_id = "'+pbody.user.id+'"', function(err, rows, fields) {
                  if (err) throw err;
                  // redirect to the dashboard
                  res.redirect('/dashboard?user='+pbody.user.username+'&id='+pbody.user.id);
                });
              });

              // goes to get followed_by instagram and inserts them into the s_followed_by table
              GET_followed_by( pbody.user.id, "" , true, function(users){
                // goes to get following instagram and inserts them into the s_following table
                GET_follows( pbody.user.id, "" , true );
              });
            });

            return;
          }
        });
      }
    });
    };

//  FOURTH = go grab instagram follower/ed data and show it =====================
  exports.dashboard           = function ( req, res ) {
    var metrics = {
                    'admin': false,
                    'fullName': '',
                    'userName': '',
                    'userID': '',
                    'userPicture': '',
                    'totalCrawled': 0,
                    'followingFromFanCrawl': 0,
                    'followingFromFanCrawlPercentage': 0,
                    'followingFromFanCrawlResult' : 'some text',
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
                    'email': '',
                    'eNoti': 0,
                    'cleaningTime' : 'Some time metric goes here',
                    'errorLogs': {},
                    'data': [230,245,269,274,292,320,368]
                  };

    if ( usersInfo[req.query.id] && JSON.stringify( usersInfo[req.query.id] ).length > 2 ) {
      metrics.errorLogs = usersInfo[req.query.id];
    }

    if (JSON.stringify(req.query).length !== 2 && req.query.user !== undefined && req.query.id !== undefined) {
      // console.log("has valid structure");

      // check access rights from database.
      connection.query('SELECT state, fancrawl_full_name, fancrawl_username, email, eNoti, fancrawl_profile_picture, or_followed_by, or_following FROM access_right where fancrawl_instagram_id = '+ req.query.id, function(err, rows, fields) {
        if (err) throw err;


        if (rows[0] === undefined || rows[0].fancrawl_username === undefined || rows[0].fancrawl_username !== req.query.user){
          console.log("User not granted");
          res.redirect('/404/');
          return;

        } else {
          console.log("User "+req.query.id+" granted");

          if ( req.query.user === "jules_moretti" ) {
            metrics.admin = true;
          }

          metrics.fullName = rows[0].fancrawl_full_name;
          metrics.userName = rows[0].fancrawl_username;
          metrics.userID = req.query.id;
          metrics.userPicture = rows[0].fancrawl_profile_picture;

          // console.log(rows[0].state);
          if ( rows[0].state === "stopped" ){
            metrics.status = 'statusStopped';
          } else if ( rows[0].state === "cleaning" ) {
            metrics.status = 'statusCleaning';
          } else if ( rows[0].state === "started" ) {
            metrics.status = 'statusStarted';
          } else {
          }

          metrics.email = rows[0].email;
          metrics.eNoti = rows[0].eNoti;
          metrics.followedBy = rows[0].or_followed_by ;
          metrics.following = rows[0].or_following ;

          // count from MySQL all users attempted so far
          connection.query('SELECT count(*) from beta_followers where fancrawl_instagram_id = "'+req.query.id+'"', function(err, rows, fields) {
            if (err) throw err;
            metrics.totalCrawled = JSON.parse(rows[0]['count(*)']);

            // count from mysql all users still processing that is not with a 4 value
            connection.query('SELECT count(*) from beta_followers where fancrawl_instagram_id = "'+req.query.id+'" AND followed_by_status = 1', function(err, rows, fields) {
              if (err) throw err;
              metrics.followingFromFanCrawl = JSON.parse(rows[0]['count(*)']);
              metrics.latestFollowedBy = metrics.followingFromFanCrawl + metrics.followedBy;


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

                GET_stats( req.query.id, function( follows, followed_by, error ){
                  metrics.actualFollowedBy = followed_by;
                  metrics.actualFollowing = follows;

                  metrics.followingFromFanCrawlPercentage = metrics.followingFromFanCrawl / ( metrics.actualFollowedBy - metrics.followedBy ) * 100;

                  metrics.followingFromFanCrawlResult = metrics.followingFromFanCrawl + " (" + Math.floor( metrics.followingFromFanCrawlPercentage ) + "%)";

                  metrics.actualFollowedByPercentage = Math.floor( ( ( metrics.actualFollowedBy / metrics.followedBy ) * 100 ) - 100);
                  metrics.actualFollowingPercentage = Math.floor( ( ( metrics.actualFollowing / metrics.following ) * 100 ) - 100);

                  if ( metrics.actualFollowedByPercentage >= 0 ) {
                    metrics.afbpClass = 'up_by';
                  } else {
                    metrics.afbpClass = 'down_by';
                  }

                  if ( metrics.actualFollowingPercentage >= 0 ) {
                    metrics.afpClass = 'up_ing';
                  } else {
                    metrics.afpClass = 'down_ing';
                  }
                  lastWeek( req.query.id , function(result){
                    var data = [];
                    if ( metrics.actualFollowedBy !== "N/A" ){
                      data.push(metrics.actualFollowedBy);

                      for ( var i = 1; i < result.length; i++ ) {
                        var temp = data[0] - result[i];
                        var newTemp = [];
                        newTemp.push(temp);
                        var old = data
                        var data = newTemp.concat(old);
                      }

                      // data = data.splice(data.length - 7,7);
                      if ( data.length > 0 ) {
                        metrics.data = data;
                      }

                    } else {
                      metrics.data = [0];
                    }

                    if ( usersInfo[ req.query.id ] ) {
                      for ( keys in usersInfo[ req.query.id ]) {
                        if ( !metrics[ keys ] ){
                          metrics.errorLogs[ keys ] = usersInfo[ req.query.id ][ keys ];
                        }
                      }
                    }
                    res.render('./partials/dashboard.ejs',  metrics );
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

//  ZERO = load list of users from FanCrawl =====================================
  exports.users          = function ( req, res ) {
    var metrics               = {
                                'admin': false,
                                'users': {},
                                'orders': {},
                                'fullName': '',
                                'userName': '',
                                'userID': '',
                                'userPicture': '',
                                'creation_date': '',
                                'sort': ''
                                };


    if (JSON.stringify(req.query).length !== 2 && req.query.user !== undefined && req.query.id !== undefined) {
      // console.log("has valid structure");

      // check access rights from database.
      connection.query('SELECT fancrawl_full_name, fancrawl_username, fancrawl_instagram_id, fancrawl_profile_picture FROM access_right where fancrawl_instagram_id = '+ req.query.id, function(err, rows, fields) {
        if (err) throw err;

        if (rows[0] === undefined || rows[0].fancrawl_username === undefined || rows[0].fancrawl_username !== req.query.user){
          console.log("User not granted");
          res.redirect('/404/');
          return;
        } else {
          metrics.admin           = true;
          metrics.fullName        = rows[0].fancrawl_full_name;
          metrics.userName        = rows[0].fancrawl_username;
          metrics.userID          = rows[0].fancrawl_instagram_id;
          metrics.userPicture     = rows[0].fancrawl_profile_picture;

          connection.query('SELECT state, fancrawl_full_name, fancrawl_username, fancrawl_instagram_id, fancrawl_profile_picture, date_format(creation_date, "%e %b %Y") AS "creation_date", unix_timestamp(creation_date) as unix_ts from access_right', function(err, rows, fields) {
            if (err) throw err;
            if ( rows && rows[0] ){
              for ( var i = 0; i < rows.length; i++ ) {
                metrics.users[ rows[i].fancrawl_instagram_id ] = rows[i];
              }
            }

            if ( !req.query.sort ) {
              metrics.sort = "alpha";
            } else if ( req.query.sort === "id" ) {
              // return in id sequence
              metrics.sort = "id";
            } else if ( req.query.sort === "alpha" ) {
              // return in alphabetical order
              metrics.sort = "alpha";
            } else if ( req.query.sort === "date" ) {
              // return by date order
              console.log("ITS A DATE")
              metrics.sort = "date";
            }

            metrics.orders.sortId = [];
            //sort by id
            for ( keys in metrics.users ) {
              metrics.orders.sortId.push( keys );
            }

            var sortDate = {};
            // sort by time
            for ( keys in metrics.users ) {
              if ( sortDate[ metrics.users[ keys ].unix_ts ] ) {
                sortDate[ metrics.users[ keys ].unix_ts ].push( keys );
              } else {
                sortDate[ metrics.users[ keys ].unix_ts ] = [];
                sortDate[ metrics.users[ keys ].unix_ts ].push( keys ) ;
              }
            }

            metrics.orders.sortDate = [];
            for ( keys in sortDate ) {
              if ( sortDate[ keys ].length === 0 ) {
                metrics.orders.sortDate.push( sortDate[ keys ][0] );
              } else {
                for ( var i = 0; i < sortDate[ keys ].length; i++ ) {
                  metrics.orders.sortDate.push( sortDate[ keys ][i] );
                }
              }
            }

            var sortAlpha = {};

            // sort by alpha
            for ( keys in metrics.users ) {
              // return parsed letter
              if ( sortAlpha[ parseInt( metrics.users[ keys ].fancrawl_full_name[0], 36 ) ] ) {
                sortAlpha[ parseInt( metrics.users[ keys ].fancrawl_full_name[0], 36 ) ].push( keys );
              } else {
                sortAlpha[ parseInt( metrics.users[ keys ].fancrawl_full_name[0], 36 ) ] = [ keys ];
              }
            };

            metrics.orders.sortAlpha = [];

            for ( keys in sortAlpha ) {
              if ( sortAlpha[ keys ].length === 0 ) {
                metrics.orders.sortAlpha.push( sortAlpha[ keys ][0] );
              } else {
                for (var i = 0; i < sortAlpha[ keys ].length; i++) {
                  metrics.orders.sortAlpha.push( sortAlpha[ keys ][i] );
                };
              }
            }

            metrics.parsedOrders = JSON.stringify( metrics.orders );
            metrics.parsedUsers = JSON.stringify( metrics.users );

            res.render('./partials/users.ejs',  metrics );
          });
        }
      });
    } else {
      res.redirect('/404/');
    }
    };

//  ZERO = trigger FanCrawl =====================================================
  exports.trigger             = function ( req, res ) {
    var original_url          = req.headers.referer,
        url_split             = original_url.split("?"),
        req_query             = JSON.parse('{"' + decodeURI(url_split[1].replace(/&/g, "\",\"").replace(/=/g,"\":\"")) + '"}'); // req_query = { user: 'ig_user_name', id: 'ig_id_number' };

    var fancrawl_instagram_id = req_query.id;

    // STARTING FANCRAWL
    // dashboard sent a switchFancrawl on so start FanCrawl
    if ( req.body.switchFancrawl && req.body.switchFancrawl === "on") {
      console.log("switchFancrawl detected");


      // START USER SPECIFIC CLOCK
      timerPostStructure( fancrawl_instagram_id, "force" );
      timerQuickStructure( fancrawl_instagram_id, "force" );

      GET_relationship( fancrawl_instagram_id, 571377691, function( fancrawl_instagram_id, new_instagram_following_id, response ){
        if ( response === "error" || response === "access_token" || response === "oauth_limit" ) {
          // do nothing

          if ( !usersInfo[ fancrawl_instagram_id ] ) {
            usersInfo[ fancrawl_instagram_id ] = {};
          }
          if ( !usersInfo[ fancrawl_instagram_id ].access_token ) {
            STOP( fancrawl_instagram_id, true );
          }
          usersInfo[ fancrawl_instagram_id ].access_token = "FanCrawl blocked from IG - Go to your IG app to unblock.";

          res.redirect("/dashboard?user="+req_query.user+"&id="+fancrawl_instagram_id);

        } else {
          connection.query('UPDATE access_right set state = "started" where fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
            if (err) throw err;

            res.redirect("/dashboard?user="+req_query.user+"&id="+fancrawl_instagram_id);

            // start fetching process
            connection.query('select added_follower_instagram_id, count from beta_followers where fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
              if (err) throw err;

              var obj = {};

              if ( rows && rows[0] ) {

                var i = 0;
                var func = function(){

                  verifyRelationship( arguments[0], arguments[1][i].added_follower_instagram_id );
                  if ( i < rows.length - 1 ) {
                    i++;
                  } else {
                    clearInterval( setTimeouts[ fancrawl_instagram_id ].startIndividualSetTimeout );
                  }
                };

                setTimeouts[ fancrawl_instagram_id ].startIndividualSetTimeout = setInterval( func, 250, fancrawl_instagram_id, rows );

                connection.query('SELECT MAX(added_follower_instagram_id) AS added_follower_instagram_id from beta_followers where fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
                  if (err) throw err;
                  var currentUser = JSON.parse( fancrawl_instagram_id );

                  if ( rows && rows[0] ) {
                    var new_instagram_following_id = JSON.parse( rows[0].added_follower_instagram_id );

                    if ( new_instagram_following_id < currentUser ) {
                      var newUser = ( currentUser + 1 );
                      fetchNewFollowers( fancrawl_instagram_id, newUser );
                      console.log("STARTING FETCHING FOR USER "+fancrawl_instagram_id+", STARTING WITH: ", newUser );
                    } else {
                      fetchNewFollowers( fancrawl_instagram_id, new_instagram_following_id );
                      console.log("STARTING FETCHING FOR USER "+fancrawl_instagram_id+", STARTING WITH: ", new_instagram_following_id );
                    }
                  } else {
                    var new_instagram_following_id = ( currentUser + 1 );
                  }

                });
              } else {
                console.log("XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");
                console.log("FETCHING - FROM TRIGGER: 1 more then its ID...");

                var newUser = ( JSON.parse(fancrawl_instagram_id) + 1 );
                fetchNewFollowers( fancrawl_instagram_id, newUser );
              }

            });
          });
        }
      });

    // CLEANING FANCRAWL
    // dashboard sent a switchClean on so clean database
    } else if ( req.body.switchclean && req.body.switchclean === "on") {
      console.log("switchclean detected");
      connection.query('UPDATE access_right set state = "cleaning" where fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
        if (err) throw err;

        res.redirect("/dashboard?user="+req_query.user+"&id="+fancrawl_instagram_id);

        // RESET post_timer & quick_timer
        timerPostStructure( fancrawl_instagram_id, "force" );
        timerQuickStructure( fancrawl_instagram_id, "force" );
        console.log("EMPTY TIMER QUEUES FROM SWITCH: ", fancrawl_instagram_id);

        // cleaning database process
        cleanDatabase( fancrawl_instagram_id, function( fancrawl_instagram_id ){
          //done cleaning so set to stopped
          connection.query('UPDATE access_right set state = "stopped" where fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
            if (err) throw err;
            console.log("FINISHED CLEANING UP DATABASE FROM TRIGGER FOR USER: ", fancrawl_instagram_id );
          });
        });
      });

    // STOPPING FANCRAWL
    } else {
      console.log("no switch on so turn off fancrawl");
      // change state to stopped in database for user and redirect back to dashboard
      connection.query('UPDATE access_right set state = "stopped" where fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
        if (err) throw err;

        res.redirect("/dashboard?user="+req_query.user+"&id="+fancrawl_instagram_id);

        STOP( fancrawl_instagram_id, false );

      });
    }


    // UPDATING EMAIL NOTIFICATIONS
    if ( req.body.email && req.body.switchMail ) {
      connection.query('UPDATE access_right set email = "'+ req.body.email +'", eNoti = 1 where fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
        if (err) throw err;
      })
    } else if ( req.body.email ) {
      connection.query('UPDATE access_right set email = "'+ req.body.email +'", eNoti = 0 where fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
        if (err) throw err;
      })
    }
    };

