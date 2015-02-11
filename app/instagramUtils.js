
//  =============================================================================
//  SET UP AND GLOBAL VARIABLES
//  =============================================================================

var crypto                                = require('crypto'),
    request                               = require('request'),
    mysql                                 = require('mysql'),
    nodemailer                            = require('nodemailer'),
    usersInfo                             = {},
    timer                                 = {},
    setTimeouts                           = {},
    processCounter                        = 0,
    queueCap                              = 10,
    connection                            = mysql.createConnection({
                                              host: 'localhost',
                                              port: 3306,
                                              // socketPath: '...tmp/mysql/mysql.sock',
                                              user: 'root',
                                              password: process.env.MYSQLPASSWORD,
                                              database: 'fancrawl',
                                              multipleStatements: true
                                            });

//  =============================================================================
//  TIMER OPERATIONS
//  =============================================================================

//  -----------------------------------------------------------------------------
//  creates a structure to hold user processing order for POST requests
//  -----------------------------------------------------------------------------
    // FROM | startIndividual
    //      -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
    //  TO  |
//  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  var timerPostStructure                  = function ( fancrawl_instagram_id ) {

      console.log( "timerPostStructure" );

      var fancrawl_instagram_id = fancrawl_instagram_id;

      if ( !timer[ fancrawl_instagram_id ] ) {
        timer[ fancrawl_instagram_id ]                        = {};
      }

      timer[ fancrawl_instagram_id ].post_queue               = {}; // handles sequence of people to follow or unfollow
      timer[ fancrawl_instagram_id ].post_queue.unfollow      = {}; // handles sequence of people to follow or unfollow
      timer[ fancrawl_instagram_id ].post_queue.follow        = {}; // handles sequence of people to follow or unfollow

      timer[ fancrawl_instagram_id ].post_counter_cap         = 0; // handles new versus verify
      timer[ fancrawl_instagram_id ].post_counter             = 0; // handles sequence of people to follow or unfollow
      timer[ fancrawl_instagram_id ].post_minute              = false; // keep track of a minute has gone by
      timer[ fancrawl_instagram_id ].post_called              = false; // keep track with the timer being called separation
    };

//  -----------------------------------------------------------------------------
//  creates a structure to hold user processing order for GET requests
//  -----------------------------------------------------------------------------
    // FROM | startIndividual
    //      -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
    //  TO  |
//  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  var timerQuickStructure                 = function ( fancrawl_instagram_id ) {

      console.log( "timerQuickStructure" );

      var fancrawl_instagram_id = fancrawl_instagram_id;

      if ( !timer[ fancrawl_instagram_id ] ) {
        timer[ fancrawl_instagram_id ]                        = {};
      }
      timer[ fancrawl_instagram_id ].quick_queue              = {}; // handles relationship sequences
      timer[ fancrawl_instagram_id ].quick_queue.verify       = {}; // handles sequence of people to verify
      timer[ fancrawl_instagram_id ].quick_queue.hash         = {}; // handles sequence of hash to go get
      timer[ fancrawl_instagram_id ].quick_queue.new          = {}; // handles sequence of new people to add

      timer[ fancrawl_instagram_id ].quick_counter_cap        = 0; // handles new versus verify
      timer[ fancrawl_instagram_id ].quick_counter            = 0; // handles new versus verify
      timer[ fancrawl_instagram_id ].quick_seconds            = false; // keep track of minimum seconds separation
      timer[ fancrawl_instagram_id ].quick_called             = false; // keep track with the timer being called separation

    };

//  -----------------------------------------------------------------------------
//  POST requests clock that handles follow and unfollow of users
//  -----------------------------------------------------------------------------
    // FROM | startIndividual
    //      -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
    //  TO  | callTimer - STOP - POST_follow - POST_unfollow
//  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  var timer_post                          = function ( fancrawl_instagram_id ) {

      console.log( "timer_post" );

      var fancrawl_instagram_id = fancrawl_instagram_id;

      if ( !timer[ fancrawl_instagram_id ].post_called ) {

        // IF POST_MINUTE = FALSE
        if ( timer[ fancrawl_instagram_id ].post_minute === false ) {
          // ENABLE
          timer[ fancrawl_instagram_id ].post_minute = true;
          // SETTIMEOUT LONG
          callTimer( fancrawl_instagram_id, "post_long" );
          if ( fancrawl_instagram_id === "571377691" ) {
            console.log( "------ TIMER OF : " + fancrawl_instagram_id, timer[ fancrawl_instagram_id ] );
          }

          // RUN SOME STUFF HERE //////////////////////////////////////////////
            // CHECK STATE OF USER
            connection.query('SELECT state FROM access_right where fancrawl_instagram_id = "'+ fancrawl_instagram_id +'"', function(err, rows, fields) {
              if (err) throw err;

              // IF STOPPED DELETE QUEUES
              if ( rows[0].state === 'stopped' ) {

                // RESET post_timer & quick_timer as well as any setTimouts
                STOP( fancrawl_instagram_id );

              // PROCESS STARTED OR CLEANING SO CARRY ON
              } else if ( rows[0].state === 'started' || rows[0].state === 'cleaning' ) {

                var followCount         = Object.keys( timer[ fancrawl_instagram_id ].post_queue.follow ),  // pulls out the FanCrawl id that has a follow process
                    unfollowCount       = Object.keys( timer[ fancrawl_instagram_id ].post_queue.unfollow );  // pulls out the FanCrawl id that has a follow process

                // if follow and unfollow queues are empty
                if ( !followCount.length && !unfollowCount.length ) {
                  // do nothing
                  timer[ fancrawl_instagram_id ].post_counter_cap = 0;

                // if both follow and unfollow queue has something
                } else if ( followCount.length && unfollowCount.length ) {

                  if ( unfollowCount.length > ( queueCap * 0.5 ) ) {

                    timer[ fancrawl_instagram_id ].post_counter_cap = 3;

                  } else {

                    timer[ fancrawl_instagram_id ].post_counter_cap = 2;

                  }

                  if ( timer[ fancrawl_instagram_id ].post_counter === 0 ) {

                    // go follow
                    var last_instagram_following_id = timer[ fancrawl_instagram_id ].post_queue.follow[ followCount[0] ].new_instagram_following_id;

                    POST_follow( fancrawl_instagram_id, last_instagram_following_id, followCount[0], function( fancrawl_instagram_id, last_instagram_following_id, processCounter ){

                      if ( timer[ fancrawl_instagram_id ].post_queue.follow[ processCounter ].last_id ) {

                        var last_id = timer[ fancrawl_instagram_id ].post_queue.follow[ processCounter ].last_id;
                        var hash_tag = timer[ fancrawl_instagram_id ].post_queue.follow[ processCounter ].hash_tag;

                        connection.query('UPDATE users_hash_tags SET last_id = "'+ last_id +'" WHERE fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND hash_tag = "'+ hash_tag +'"', function(err, rows, fields) {
                          if (err) throw err;
                          console.log( "UPDATED LAST_ID AS:" + last_id, hash_tag );
                        });

                      }

                      delete timer[ fancrawl_instagram_id ].post_queue.follow[ processCounter ];
                      if ( fancrawl_instagram_id === 571377691 || fancrawl_instagram_id === "571377691" ) {
                        console.log("TIMER POST FOLLOW - deleted "+fancrawl_instagram_id+": "+last_instagram_following_id+" of process POST_FOLLOW");
                      }
                    });

                    timer[ fancrawl_instagram_id ].post_counter = timer[ fancrawl_instagram_id ].post_counter_cap;

                  } else {

                    // go unfollow
                    var last_instagram_following_id = timer[ fancrawl_instagram_id ].post_queue.unfollow[ unfollowCount[0] ].new_instagram_following_id;
                    var process = timer[ fancrawl_instagram_id ].post_queue.unfollow[ unfollowCount[0] ].process;

                    if ( process === "unfollow" ) {

                      POST_unfollow( fancrawl_instagram_id, last_instagram_following_id, "", unfollowCount[0], function( fancrawl_instagram_id, last_instagram_following_id, processCounter ){

                        if ( timer[ fancrawl_instagram_id ].post_queue.unfollow[ processCounter ] && timer[ fancrawl_instagram_id ].post_queue.unfollow[ processCounter ].last_id ) {

                          var last_id = timer[ fancrawl_instagram_id ].post_queue.unfollow[ processCounter ].last_id;
                          var hash_tag = timer[ fancrawl_instagram_id ].post_queue.unfollow[ processCounter ].hash_tag;

                          connection.query('UPDATE users_hash_tags SET last_id = "'+ last_id +'" WHERE fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND hash_tag = "'+ hash_tag +'"', function(err, rows, fields) {
                            if (err) throw err;
                            console.log( "UPDATED LAST_ID AS:" + last_id, hash_tag );
                          });

                        }

                        delete timer[ fancrawl_instagram_id ].post_queue.unfollow[ processCounter ];
                        if ( fancrawl_instagram_id === 571377691 || fancrawl_instagram_id === "571377691" ) {
                          console.log("TIMER POST UNFOLLOW - deleted "+fancrawl_instagram_id+": "+last_instagram_following_id+" of process POST_UNFOLLOW");
                        }
                      });

                    } else if ( process === "unfollow_followedby" ) {

                      POST_unfollow( fancrawl_instagram_id, last_instagram_following_id, true, unfollowCount[0], function( fancrawl_instagram_id, last_instagram_following_id, processCounter ){

                        if ( timer[ fancrawl_instagram_id ].post_queue.unfollow[ processCounter ].last_id ) {

                          var last_id = timer[ fancrawl_instagram_id ].post_queue.unfollow[ processCounter ].last_id;
                          var hash_tag = timer[ fancrawl_instagram_id ].post_queue.unfollow[ processCounter ].hash_tag;

                          connection.query('UPDATE users_hash_tags SET last_id = "'+ last_id +'" WHERE fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND hash_tag = "'+ hash_tag +'"', function(err, rows, fields) {
                            if (err) throw err;
                            console.log( "UPDATED LAST_ID AS:" + last_id, hash_tag );
                          });

                        }

                        delete timer[ fancrawl_instagram_id ].post_queue.unfollow[ processCounter ];
                        if ( fancrawl_instagram_id === 571377691 || fancrawl_instagram_id === "571377691" ) {
                          console.log("TIMER POST UNFOLLOW_FOLLOWEDBY "+fancrawl_instagram_id+": "+last_instagram_following_id+" of process POST_UNFOLLOW");
                        }
                      });

                    } else {

                      console.log("TIMER POST XXXX - No process found... "+process);

                    }

                    timer[ fancrawl_instagram_id ].post_counter--;

                  }

                // singles
                } else {
                  timer[ fancrawl_instagram_id ].post_counter_cap = 0;

                  // go follow
                  if ( followCount.length ) {
                    var last_instagram_following_id = timer[ fancrawl_instagram_id ].post_queue.follow[ followCount[0] ].new_instagram_following_id;

                    POST_follow( fancrawl_instagram_id, last_instagram_following_id, followCount[0], function( fancrawl_instagram_id, last_instagram_following_id, processCounter ){

                      if ( timer[ fancrawl_instagram_id ].post_queue.follow[ processCounter ].last_id ) {

                        var last_id = timer[ fancrawl_instagram_id ].post_queue.follow[ processCounter ].last_id;
                        var hash_tag = timer[ fancrawl_instagram_id ].post_queue.follow[ processCounter ].hash_tag;

                        connection.query('UPDATE users_hash_tags SET last_id = "'+ last_id +'" WHERE fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND hash_tag = "'+ hash_tag +'"', function(err, rows, fields) {
                          if (err) throw err;
                          console.log( "UPDATED LAST_ID AS:" + last_id, hash_tag );
                        });

                      }

                      delete timer[ fancrawl_instagram_id ].post_queue.follow[ processCounter ];
                      if ( fancrawl_instagram_id === 571377691 || fancrawl_instagram_id === "571377691" ) {
                        console.log("TIMER POST FOLLOW - deleted "+fancrawl_instagram_id+": "+last_instagram_following_id+" of process POST_FOLLOW");
                      }
                    });

                  // go unfollow
                  } else if ( unfollowCount.length ) {

                    var last_instagram_following_id = timer[ fancrawl_instagram_id ].post_queue.unfollow[ unfollowCount[0] ].new_instagram_following_id;
                    var process = timer[ fancrawl_instagram_id ].post_queue.unfollow[ unfollowCount[0] ].process;

                    if ( process === "unfollow" ) {

                      POST_unfollow( fancrawl_instagram_id, last_instagram_following_id, "", unfollowCount[0], function( fancrawl_instagram_id, last_instagram_following_id, processCounter ){

                        if ( timer[ fancrawl_instagram_id ].post_queue.unfollow[ processCounter ].last_id ) {

                          var last_id = timer[ fancrawl_instagram_id ].post_queue.unfollow[ processCounter ].last_id;
                          var hash_tag = timer[ fancrawl_instagram_id ].post_queue.unfollow[ processCounter ].hash_tag;

                          connection.query('UPDATE users_hash_tags SET last_id = "'+ last_id +'" WHERE fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND hash_tag = "'+ hash_tag +'"', function(err, rows, fields) {
                            if (err) throw err;
                            console.log( "UPDATED LAST_ID AS:" + last_id, hash_tag );
                          });

                        }

                        delete timer[ fancrawl_instagram_id ].post_queue.unfollow[ processCounter ];
                        if ( fancrawl_instagram_id === 571377691 || fancrawl_instagram_id === "571377691" ) {
                          console.log("TIMER POST UNFOLLOW - deleted "+fancrawl_instagram_id+": "+last_instagram_following_id+" of process POST_UNFOLLOW");
                        }
                      });

                    } else if ( process === "unfollow_followedby" ) {

                      POST_unfollow( fancrawl_instagram_id, last_instagram_following_id, true, unfollowCount[0], function( fancrawl_instagram_id, last_instagram_following_id, processCounter ){

                        if ( timer[ fancrawl_instagram_id ].post_queue.unfollow[ processCounter ].last_id ) {

                          var last_id = timer[ fancrawl_instagram_id ].post_queue.unfollow[ processCounter ].last_id;
                          var hash_tag = timer[ fancrawl_instagram_id ].post_queue.unfollow[ processCounter ].hash_tag;

                          connection.query('UPDATE users_hash_tags SET last_id = "'+ last_id +'" WHERE fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND hash_tag = "'+ hash_tag +'"', function(err, rows, fields) {
                            if (err) throw err;
                            console.log( "UPDATED LAST_ID AS:" + last_id, hash_tag );
                          });

                        }

                        delete timer[ fancrawl_instagram_id ].post_queue.unfollow[ processCounter ];
                        if ( fancrawl_instagram_id === 571377691 || fancrawl_instagram_id === "571377691" ) {
                          console.log("TIMER POST UNFOLLOW_FOLLOWEDBY "+fancrawl_instagram_id+": "+last_instagram_following_id+" of process POST_UNFOLLOW");
                        }
                      });

                    } else {

                      console.log("TIMER POST XXXX - No process found of singles... " + process);

                    }
                  }

                }
              }
            });
          /////////////////////////////////////////////////////////////////////

        // IF TRUE TO SETTIMEOUT SHORT
        } else {
          callTimer( fancrawl_instagram_id, "post_short" );
        }

      } else {
        timer[ fancrawl_instagram_id ].post_called = true;
      }

    };

//  -----------------------------------------------------------------------------
//  GET requests clock that handles new, relationship, hash_tags and users
//  -----------------------------------------------------------------------------
    // FROM | startIndividual
    //      -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
    //  TO  | callTimer - STOP - verifyRelationship - GET_hash_tag_media - GET_relationship - sendMail - clockManager - STOP
//  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  var timer_quick                         = function ( fancrawl_instagram_id ) {

      console.log( "timer_quick" );

      var fancrawl_instagram_id = fancrawl_instagram_id;

      if ( fancrawl_instagram_id = "571377691" ) {
        console.log("CALLED TIMER: ", fancrawl_instagram_id );
      }

      if ( timer[ fancrawl_instagram_id ].quick_called === false ) {

        // IF POST_MINUTE = FALSE
        if ( timer[ fancrawl_instagram_id ].quick_seconds === false ) {
          // ENABLE
          timer[ fancrawl_instagram_id ].quick_seconds = true;
          // SETTIMEOUT LONG
          callTimer( fancrawl_instagram_id, "quick_long" );

          if ( fancrawl_instagram_id === "571377691" ) {
            // console.log( "------ TIMER OF : " + fancrawl_instagram_id, timer[ fancrawl_instagram_id ].quick_queue.hash );
            // console.log( "------ TIMER OF : " + fancrawl_instagram_id, timer[ fancrawl_instagram_id ] );
          }

          // RUN SOME STUFF HERE //////////////////////////////////////////////
            connection.query('SELECT state, fancrawl_instagram_id FROM access_right where fancrawl_instagram_id = "'+ fancrawl_instagram_id +'"', function(err, rows, fields) {
              if (err) throw err;

              // IF STOPPED DELETE QUEUES
              if ( rows && rows[0] && rows[0].state && rows[0].state === 'stopped' ) {

                // RESET post_timer & quick_timer as well as any setTimouts
                STOP( fancrawl_instagram_id );

              // PROCESS STARTED OR CLEANING SO CARRY ON
              } else if ( rows && rows[0] && rows[0].state && rows[0].state === 'started' || rows[0].state === 'cleaning' ) {

                if ( setTimeouts && setTimeouts[ rows[0].fancrawl_instagram_id ] && setTimeouts[ rows[0].fancrawl_instagram_id ].databaseData && typeof setTimeouts[ rows[0].fancrawl_instagram_id ].databaseData === "object" ) {
                  var count_databaseData    = Object.keys( setTimeouts[ rows[0].fancrawl_instagram_id ].databaseData );
                } else {
                  var count_databaseData    = [];
                }

                if ( timer && timer[ rows[0].fancrawl_instagram_id ] && timer[ rows[0].fancrawl_instagram_id ].quick_queue && timer[ rows[0].fancrawl_instagram_id ].quick_queue.verify && typeof timer[ rows[0].fancrawl_instagram_id ].quick_queue.verify === "object" ) {
                  var count_verify          = Object.keys( timer[ rows[0].fancrawl_instagram_id ].quick_queue.verify );
                } else {
                  var count_verify          = [];
                }

                if ( timer && timer[ rows[0].fancrawl_instagram_id ] && timer[ rows[0].fancrawl_instagram_id ].quick_queue && timer[ rows[0].fancrawl_instagram_id ].quick_queue.new && typeof timer[ rows[0].fancrawl_instagram_id ].quick_queue.new === "object" ) {
                  var count_new             = Object.keys( timer[ rows[0].fancrawl_instagram_id ].quick_queue.new );
                } else {
                  var count_new             = [];
                }

                if ( timer && timer[ rows[0].fancrawl_instagram_id ] && timer[ rows[0].fancrawl_instagram_id ].quick_queue && timer[ rows[0].fancrawl_instagram_id ].quick_queue.hash && typeof timer[ rows[0].fancrawl_instagram_id ].quick_queue.hash === "object" ) {
                  var count_hash            = Object.keys( timer[ rows[0].fancrawl_instagram_id ].quick_queue.hash );
                } else {
                  var count_hash            = [];
                }


                // all 4 empty - nothing to do
                if ( count_databaseData.length === 0 && count_verify.length === 0 && count_new.length === 0 && count_hash.length === 0 ) {

                  timer[ rows[0].fancrawl_instagram_id ].quick_counter_cap = 0;
                  return;

                // all 4 have data
                } else if ( count_databaseData.length !== 0 && count_verify.length !== 0 && count_new.length !== 0 && count_hash.length !== 0 ) {

                  timer[ rows[0].fancrawl_instagram_id ].quick_counter_cap = 4;

                  if ( timer[ rows[0].fancrawl_instagram_id ].quick_counter === 0 ) {

                    // get new
                    var new_instagram_following_id = timer[ rows[0].fancrawl_instagram_id ].quick_queue.new[ count_new[0] ].new_instagram_following_id;
                    var process = "new";
                    var uniqueProcessCounter = count_new[0];

                    timer[ rows[0].fancrawl_instagram_id ].quick_counter = 3;

                  } else if ( timer[ rows[0].fancrawl_instagram_id ].quick_counter === 1 ) {

                    // get verify
                    var new_instagram_following_id = timer[ rows[0].fancrawl_instagram_id ].quick_queue.verify[ count_verify[0] ].new_instagram_following_id;
                    var process = timer[ rows[0].fancrawl_instagram_id ].quick_queue.verify[ count_verify[0] ].process;
                    var uniqueProcessCounter = count_verify[0];

                    timer[ rows[0].fancrawl_instagram_id ].quick_counter = 0;

                  } else if ( timer[ rows[0].fancrawl_instagram_id ].quick_counter === 2 ) {

                    // get databaseData
                    if ( count_verify.length < ( queueCap - 2 ) ) {
                      verifyRelationship( rows[0].fancrawl_instagram_id, setTimeouts[ rows[0].fancrawl_instagram_id ].databaseData[ count_databaseData[0] ].added_follower_instagram_id );
                      delete setTimeouts[ rows[0].fancrawl_instagram_id ].databaseData[ count_databaseData[0] ];
                    }

                    timer[ rows[0].fancrawl_instagram_id ].quick_counter = 1;
                    return;

                  } else if ( timer[ rows[0].fancrawl_instagram_id ].quick_counter >= 3 ) {

                    // get new from hash library
                    if ( timer[ rows[0].fancrawl_instagram_id ].quick_queue.hash[ count_hash[0] ].pagination ) {
                      GET_hash_tag_media( rows[0].fancrawl_instagram_id, timer[ rows[0].fancrawl_instagram_id ].quick_queue.hash[ count_hash[0] ].hash_tag, timer[ rows[0].fancrawl_instagram_id ].quick_queue.hash[ count_hash[0] ].pagination );
                    } else {
                      GET_hash_tag_media( rows[0].fancrawl_instagram_id, timer[ rows[0].fancrawl_instagram_id ].quick_queue.hash[ count_hash[0] ].hash_tag );
                    }

                    timer[ rows[0].fancrawl_instagram_id ].quick_counter = 2;
                    return;

                  }


                // all 3 have data but hash
                } else if ( count_databaseData.length !== 0 && count_verify.length !== 0 && count_new.length !== 0 && count_hash.length === 0 ) {

                  timer[ rows[0].fancrawl_instagram_id ].quick_counter_cap = 3;

                  if ( timer[ rows[0].fancrawl_instagram_id ].quick_counter === 0 ) {

                    // get new
                    var new_instagram_following_id = timer[ rows[0].fancrawl_instagram_id ].quick_queue.new[ count_new[0] ].new_instagram_following_id;
                    var process = "new";
                    var uniqueProcessCounter = count_new[0];

                    timer[ rows[0].fancrawl_instagram_id ].quick_counter = 2;

                  } else if ( timer[ rows[0].fancrawl_instagram_id ].quick_counter === 1 ) {

                    // get verify
                    var new_instagram_following_id = timer[ rows[0].fancrawl_instagram_id ].quick_queue.verify[ count_verify[0] ].new_instagram_following_id;
                    var process = timer[ rows[0].fancrawl_instagram_id ].quick_queue.verify[ count_verify[0] ].process;
                    var uniqueProcessCounter = count_verify[0];

                    timer[ rows[0].fancrawl_instagram_id ].quick_counter = 0;

                  } else if ( timer[ rows[0].fancrawl_instagram_id ].quick_counter >= 2 ) {

                    // get databaseData
                    if ( count_verify.length < ( queueCap - 2 ) ) {
                      verifyRelationship( rows[0].fancrawl_instagram_id, setTimeouts[ rows[0].fancrawl_instagram_id ].databaseData[ count_databaseData[0] ].added_follower_instagram_id );
                      delete setTimeouts[ rows[0].fancrawl_instagram_id ].databaseData[ count_databaseData[0] ];
                    }

                    timer[ rows[0].fancrawl_instagram_id ].quick_counter = 1;
                    return;

                  }

                // all 3 have data but new
                } else if ( count_databaseData.length !== 0 && count_verify.length !== 0 && count_new.length === 0 && count_hash.length !== 0 ) {

                  timer[ rows[0].fancrawl_instagram_id ].quick_counter_cap = 3;

                  if ( timer[ rows[0].fancrawl_instagram_id ].quick_counter === 0 ) {

                    // get verify
                    var new_instagram_following_id = timer[ rows[0].fancrawl_instagram_id ].quick_queue.verify[ count_verify[0] ].new_instagram_following_id;
                    var process = timer[ rows[0].fancrawl_instagram_id ].quick_queue.verify[ count_verify[0] ].process;
                    var uniqueProcessCounter = count_verify[0];

                    timer[ rows[0].fancrawl_instagram_id ].quick_counter = 2;

                  } else if ( timer[ rows[0].fancrawl_instagram_id ].quick_counter === 1 ) {

                    // get databaseData
                    if ( count_verify.length < ( queueCap - 2 ) ) {
                      verifyRelationship( rows[0].fancrawl_instagram_id, setTimeouts[ rows[0].fancrawl_instagram_id ].databaseData[ count_databaseData[0] ].added_follower_instagram_id );
                      delete setTimeouts[ rows[0].fancrawl_instagram_id ].databaseData[ count_databaseData[0] ];
                    }

                    timer[ rows[0].fancrawl_instagram_id ].quick_counter = 0;
                    return;

                  } else if ( timer[ rows[0].fancrawl_instagram_id ].quick_counter >= 2 ) {

                    // get hash
                    if ( timer[ rows[0].fancrawl_instagram_id ].quick_queue.hash[ count_hash[0] ].pagination ) {
                      GET_hash_tag_media( rows[0].fancrawl_instagram_id, timer[ rows[0].fancrawl_instagram_id ].quick_queue.hash[ count_hash[0] ].hash_tag, timer[ rows[0].fancrawl_instagram_id ].quick_queue.hash[ count_hash[0] ].pagination );
                    } else {
                      GET_hash_tag_media( rows[0].fancrawl_instagram_id, timer[ rows[0].fancrawl_instagram_id ].quick_queue.hash[ count_hash[0] ].hash_tag );
                    }

                    timer[ rows[0].fancrawl_instagram_id ].quick_counter = 1;
                    return;

                  }

                // all 3 have data but verify
                } else if ( count_databaseData.length !== 0 && count_verify.length === 0 && count_new.length !== 0 && count_hash.length !== 0 ) {

                  timer[ rows[0].fancrawl_instagram_id ].quick_counter_cap = 3;

                  if ( timer[ rows[0].fancrawl_instagram_id ].quick_counter === 0 ) {

                    // get new
                    var new_instagram_following_id = timer[ rows[0].fancrawl_instagram_id ].quick_queue.new[ count_new[0] ].new_instagram_following_id;
                    var process = "new";
                    var uniqueProcessCounter = count_new[0];

                    timer[ rows[0].fancrawl_instagram_id ].quick_counter = 2;

                  } else if ( timer[ rows[0].fancrawl_instagram_id ].quick_counter === 1 ) {

                    // get databaseData
                    if ( count_verify.length < ( queueCap - 2 ) ) {
                      verifyRelationship( rows[0].fancrawl_instagram_id, setTimeouts[ rows[0].fancrawl_instagram_id ].databaseData[ count_databaseData[0] ].added_follower_instagram_id );
                      delete setTimeouts[ rows[0].fancrawl_instagram_id ].databaseData[ count_databaseData[0] ];
                    }

                    timer[ rows[0].fancrawl_instagram_id ].quick_counter = 0;
                    return;

                  } else if ( timer[ rows[0].fancrawl_instagram_id ].quick_counter >= 2 ) {

                    // get hash
                    if ( timer[ rows[0].fancrawl_instagram_id ].quick_queue.hash[ count_hash[0] ].pagination ) {
                      GET_hash_tag_media( rows[0].fancrawl_instagram_id, timer[ rows[0].fancrawl_instagram_id ].quick_queue.hash[ count_hash[0] ].hash_tag, timer[ rows[0].fancrawl_instagram_id ].quick_queue.hash[ count_hash[0] ].pagination );
                    } else {
                      GET_hash_tag_media( rows[0].fancrawl_instagram_id, timer[ rows[0].fancrawl_instagram_id ].quick_queue.hash[ count_hash[0] ].hash_tag );
                    }

                    timer[ rows[0].fancrawl_instagram_id ].quick_counter = 1;
                    return;

                  }

                // all 3 have data but previous
                } else if ( count_databaseData.length === 0 && count_verify.length !== 0 && count_new.length !== 0 && count_hash.length !== 0 ) {

                  timer[ rows[0].fancrawl_instagram_id ].quick_counter_cap = 3;

                  if ( timer[ rows[0].fancrawl_instagram_id ].quick_counter === 0 ) {

                    // get new
                    var new_instagram_following_id = timer[ rows[0].fancrawl_instagram_id ].quick_queue.new[ count_new[0] ].new_instagram_following_id;
                    var process = "new";
                    var uniqueProcessCounter = count_new[0];

                    timer[ rows[0].fancrawl_instagram_id ].quick_counter = 2;

                  } else if ( timer[ rows[0].fancrawl_instagram_id ].quick_counter === 1 ) {

                    // get verify
                    var new_instagram_following_id = timer[ rows[0].fancrawl_instagram_id ].quick_queue.verify[ count_verify[0] ].new_instagram_following_id;
                    var process = timer[ rows[0].fancrawl_instagram_id ].quick_queue.verify[ count_verify[0] ].process;
                    var uniqueProcessCounter = count_verify[0];

                    timer[ rows[0].fancrawl_instagram_id ].quick_counter = 0;

                  } else if ( timer[ rows[0].fancrawl_instagram_id ].quick_counter >= 2 ) {

                    // get hash
                    if ( timer[ rows[0].fancrawl_instagram_id ].quick_queue.hash[ count_hash[0] ].pagination ) {
                      GET_hash_tag_media( rows[0].fancrawl_instagram_id, timer[ rows[0].fancrawl_instagram_id ].quick_queue.hash[ count_hash[0] ].hash_tag, timer[ rows[0].fancrawl_instagram_id ].quick_queue.hash[ count_hash[0] ].pagination );
                    } else {
                      GET_hash_tag_media( rows[0].fancrawl_instagram_id, timer[ rows[0].fancrawl_instagram_id ].quick_queue.hash[ count_hash[0] ].hash_tag );
                    }

                    timer[ rows[0].fancrawl_instagram_id ].quick_counter = 1;
                    return;

                  }


                // only 2 but new & hash
                } else if ( count_databaseData.length !== 0 && count_verify.length !== 0 && count_new.length === 0 && count_hash.length == 0 ) {

                  timer[ rows[0].fancrawl_instagram_id ].quick_counter_cap = 2;

                  if ( timer[ rows[0].fancrawl_instagram_id ].quick_counter >= 1 ) {

                    // get databaseData
                    if ( count_verify.length < ( queueCap - 2 ) ) {
                      verifyRelationship( rows[0].fancrawl_instagram_id, setTimeouts[ rows[0].fancrawl_instagram_id ].databaseData[ count_databaseData[0] ].added_follower_instagram_id );
                      delete setTimeouts[ rows[0].fancrawl_instagram_id ].databaseData[ count_databaseData[0] ];
                    }

                    timer[ rows[0].fancrawl_instagram_id ].quick_counter = 0;
                    return;

                  } else {

                    // get verify
                    var new_instagram_following_id = timer[ rows[0].fancrawl_instagram_id ].quick_queue.verify[ count_verify[0] ].new_instagram_following_id;
                    var process = timer[ rows[0].fancrawl_instagram_id ].quick_queue.verify[ count_verify[0] ].process;
                    var uniqueProcessCounter = count_verify[0];

                    timer[ rows[0].fancrawl_instagram_id ].quick_counter = 1;

                  }

                // only 2 but verify & hash
                } else if ( count_databaseData.length !== 0 && count_verify.length === 0 && count_new.length !== 0 && count_hash.length === 0 ) {

                  timer[ rows[0].fancrawl_instagram_id ].quick_counter_cap = 2;

                  if ( timer[ rows[0].fancrawl_instagram_id ].quick_counter >= 1 ) {

                    // get databaseData
                    if ( count_verify.length < ( queueCap - 2 ) ) {
                      verifyRelationship( rows[0].fancrawl_instagram_id, setTimeouts[ rows[0].fancrawl_instagram_id ].databaseData[ count_databaseData[0] ].added_follower_instagram_id );
                      delete setTimeouts[ rows[0].fancrawl_instagram_id ].databaseData[ count_databaseData[0] ];
                    }

                    timer[ rows[0].fancrawl_instagram_id ].quick_counter = 0;
                    return;

                  } else {

                    // get new
                    var new_instagram_following_id = timer[ rows[0].fancrawl_instagram_id ].quick_queue.new[ count_new[0] ].new_instagram_following_id;
                    var process = "new";
                    var uniqueProcessCounter = count_new[0];

                    timer[ rows[0].fancrawl_instagram_id ].quick_counter = 1;

                  }

                // only 2 but verify & new
                } else if ( count_databaseData.length !== 0 && count_verify.length === 0 && count_new.length === 0 && count_hash.length !== 0 ) {

                  timer[ rows[0].fancrawl_instagram_id ].quick_counter_cap = 2;

                  if ( timer[ rows[0].fancrawl_instagram_id ].quick_counter >= 1 ) {

                    // get databaseData
                    if ( count_verify.length < ( queueCap - 2 ) ) {
                      verifyRelationship( rows[0].fancrawl_instagram_id, setTimeouts[ rows[0].fancrawl_instagram_id ].databaseData[ count_databaseData[0] ].added_follower_instagram_id );
                      delete setTimeouts[ rows[0].fancrawl_instagram_id ].databaseData[ count_databaseData[0] ];
                    }

                    timer[ rows[0].fancrawl_instagram_id ].quick_counter = 0;
                    return;

                  } else {

                    // get hash
                    if ( timer[ rows[0].fancrawl_instagram_id ].quick_queue.hash[ count_hash[0] ].pagination ) {
                      GET_hash_tag_media( rows[0].fancrawl_instagram_id, timer[ rows[0].fancrawl_instagram_id ].quick_queue.hash[ count_hash[0] ].hash_tag, timer[ rows[0].fancrawl_instagram_id ].quick_queue.hash[ count_hash[0] ].pagination );
                    } else {
                      GET_hash_tag_media( rows[0].fancrawl_instagram_id, timer[ rows[0].fancrawl_instagram_id ].quick_queue.hash[ count_hash[0] ].hash_tag );
                    }

                    timer[ rows[0].fancrawl_instagram_id ].quick_counter = 1;
                    return;

                  }

                // only 2 but previous & hash
                } else if ( count_databaseData.length === 0 && count_verify.length !== 0 && count_new.length !== 0 && count_hash.length === 0 ) {

                  timer[ rows[0].fancrawl_instagram_id ].quick_counter_cap = 2;

                  if ( timer[ rows[0].fancrawl_instagram_id ].quick_counter >= 1 ) {

                    // get verify
                    var new_instagram_following_id = timer[ rows[0].fancrawl_instagram_id ].quick_queue.verify[ count_verify[0] ].new_instagram_following_id;
                    var process = timer[ rows[0].fancrawl_instagram_id ].quick_queue.verify[ count_verify[0] ].process;
                    var uniqueProcessCounter = count_verify[0];

                    timer[ rows[0].fancrawl_instagram_id ].quick_counter = 0;

                  } else {

                    // get new
                    var new_instagram_following_id = timer[ rows[0].fancrawl_instagram_id ].quick_queue.new[ count_new[0] ].new_instagram_following_id;
                    var process = "new";
                    var uniqueProcessCounter = count_new[0];

                    timer[ rows[0].fancrawl_instagram_id ].quick_counter = 1;

                  }

                // only 2 but previous & new
                } else if ( count_databaseData.length === 0 && count_verify.length !== 0 && count_new.length === 0 && count_hash.length !== 0 ) {

                  timer[ rows[0].fancrawl_instagram_id ].quick_counter_cap = 2;

                  if ( timer[ rows[0].fancrawl_instagram_id ].quick_counter >= 1 ) {

                    // get verify
                    var new_instagram_following_id = timer[ rows[0].fancrawl_instagram_id ].quick_queue.verify[ count_verify[0] ].new_instagram_following_id;
                    var process = timer[ rows[0].fancrawl_instagram_id ].quick_queue.verify[ count_verify[0] ].process;
                    var uniqueProcessCounter = count_verify[0];

                    timer[ rows[0].fancrawl_instagram_id ].quick_counter = 0;

                  } else {

                    // get hash
                    if ( timer[ rows[0].fancrawl_instagram_id ].quick_queue.hash[ count_hash[0] ].pagination ) {
                      GET_hash_tag_media( rows[0].fancrawl_instagram_id, timer[ rows[0].fancrawl_instagram_id ].quick_queue.hash[ count_hash[0] ].hash_tag, timer[ rows[0].fancrawl_instagram_id ].quick_queue.hash[ count_hash[0] ].pagination );
                    } else {
                      GET_hash_tag_media( rows[0].fancrawl_instagram_id, timer[ rows[0].fancrawl_instagram_id ].quick_queue.hash[ count_hash[0] ].hash_tag );
                    }

                    timer[ rows[0].fancrawl_instagram_id ].quick_counter = 1;
                    return;

                  }

                // only 2 but previous & verify
                } else if ( count_databaseData.length === 0 && count_verify.length === 0 && count_new.length !== 0 && count_hash.length !== 0 ) {

                  timer[ rows[0].fancrawl_instagram_id ].quick_counter_cap = 2;

                  if ( timer[ rows[0].fancrawl_instagram_id ].quick_counter >= 1 ) {

                    // get new
                    var new_instagram_following_id = timer[ rows[0].fancrawl_instagram_id ].quick_queue.new[ count_new[0] ].new_instagram_following_id;
                    var process = "new";
                    var uniqueProcessCounter = count_new[0];

                    timer[ rows[0].fancrawl_instagram_id ].quick_counter = 0;

                  } else {

                    // get hash
                    if ( timer[ rows[0].fancrawl_instagram_id ].quick_queue.hash[ count_hash[0] ].pagination ) {
                      GET_hash_tag_media( rows[0].fancrawl_instagram_id, timer[ rows[0].fancrawl_instagram_id ].quick_queue.hash[ count_hash[0] ].hash_tag, timer[ rows[0].fancrawl_instagram_id ].quick_queue.hash[ count_hash[0] ].pagination );
                    } else {
                      GET_hash_tag_media( rows[0].fancrawl_instagram_id, timer[ rows[0].fancrawl_instagram_id ].quick_queue.hash[ count_hash[0] ].hash_tag );
                    }

                    timer[ rows[0].fancrawl_instagram_id ].quick_counter = 1;
                    return;

                  }


                // singles
                } else {

                  timer[ rows[0].fancrawl_instagram_id ].quick_counter_cap = 1;

                  if ( count_databaseData.length !== 0 ) {

                    // get databaseData
                    if ( count_verify.length < ( queueCap - 2 ) ) {
                      verifyRelationship( rows[0].fancrawl_instagram_id, setTimeouts[ rows[0].fancrawl_instagram_id ].databaseData[ count_databaseData[0] ].added_follower_instagram_id );
                      delete setTimeouts[ rows[0].fancrawl_instagram_id ].databaseData[ count_databaseData[0] ];
                    }

                    timer[ rows[0].fancrawl_instagram_id ].quick_counter = 0;
                    return;

                  } else if ( count_verify.length !== 0 ) {

                    // get verify
                    var new_instagram_following_id = timer[ rows[0].fancrawl_instagram_id ].quick_queue.verify[ count_verify[0] ].new_instagram_following_id;
                    var process = timer[ rows[0].fancrawl_instagram_id ].quick_queue.verify[ count_verify[0] ].process;
                    var uniqueProcessCounter = count_verify[0];

                    timer[ rows[0].fancrawl_instagram_id ].quick_counter = 0;

                  } else if ( count_new.length !== 0 ) {

                    // get new
                    var new_instagram_following_id = timer[ rows[0].fancrawl_instagram_id ].quick_queue.new[ count_new[0] ].new_instagram_following_id;
                    var process = "new";
                    var uniqueProcessCounter = count_new[0];

                    timer[ rows[0].fancrawl_instagram_id ].quick_counter = 0;

                  } else if ( count_hash.length !== 0 ) {

                    // get hash
                    if ( timer[ rows[0].fancrawl_instagram_id ].quick_queue.hash[ count_hash[0] ].pagination ) {
                      GET_hash_tag_media( rows[0].fancrawl_instagram_id, timer[ rows[0].fancrawl_instagram_id ].quick_queue.hash[ count_hash[0] ].hash_tag, timer[ rows[0].fancrawl_instagram_id ].quick_queue.hash[ count_hash[0] ].pagination );
                    } else {
                      GET_hash_tag_media( rows[0].fancrawl_instagram_id, timer[ rows[0].fancrawl_instagram_id ].quick_queue.hash[ count_hash[0] ].hash_tag );
                    }

                    timer[ rows[0].fancrawl_instagram_id ].quick_counter = 0;
                    return;

                  }

                }

                if ( process ) {

                  if ( process === "new" ) {
                    if ( rows[0].fancrawl_instagram_id = "571377691" ) {
                      console.log("BEFORE GET RELATIONSHIP OF TIMER_QUICK: ", fancrawl_instagram_id, new_instagram_following_id, uniqueProcessCounter );
                    }
                    // check relationship and unfollow with proper

                    GET_relationship( fancrawl_instagram_id, new_instagram_following_id, uniqueProcessCounter, function( blank_slot, a_fancrawl_instagram_id, new_instagram_following_id, relationship, uniqueProcessCounter ) {

                      if ( fancrawl_instagram_id = "571377691" && relationship === "neither" ) {
                        console.log("AFTER GET RELATIONSHIP OF TIMER_QUICK: ", a_fancrawl_instagram_id, new_instagram_following_id, uniqueProcessCounter, relationship );
                      }

                      var fancrawl_instagram_id = a_fancrawl_instagram_id;

                      if ( relationship === "not_exist" ) {

                        delete timer[ fancrawl_instagram_id ].quick_queue.new[ uniqueProcessCounter ];

                      } else if ( relationship === "access_token" ) {

                        if ( !usersInfo[ fancrawl_instagram_id ] ) {
                          usersInfo[ fancrawl_instagram_id ] = {};
                        }

                        if ( !usersInfo[ fancrawl_instagram_id ].access_token ) {
                          STOP( fancrawl_instagram_id, true );
                        }

                        usersInfo[ fancrawl_instagram_id ].access_token = "FanCrawl blocked from IG - Go to your IG app to unblock.";

                      } else if ( relationship === "APINotAllowedError" ) {

                        delete timer[ fancrawl_instagram_id ].quick_queue.new[ uniqueProcessCounter ];

                        connection.query('UPDATE beta_followers SET count = 5 WHERE fancrawl_instagram_id = "'+ fancrawl_instagram_id +'" AND added_follower_instagram_id = "'+ new_instagram_following_id +'"', function(err, rows, fields) {
                          if (err) throw err;
                        });

                      } else if ( relationship === "oauth_limit" ) {

                        if ( !usersInfo[ fancrawl_instagram_id ] ) {
                          usersInfo[ fancrawl_instagram_id ] = {};
                        }

                        usersInfo[ fancrawl_instagram_id ].oauth_limit = "oauth_limit error";

                        sendMail( "571377691", "OAUTH Limit error", JSON.stringify(pbody) + " from user: " + fancrawl_instagram_id );

                      // new_instagram user follows FanCrawl user
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

                        if ( timer && timer[ rows[0].fancrawl_instagram_id ] && timer[ rows[0].fancrawl_instagram_id ].post_queue && timer[ rows[0].fancrawl_instagram_id ].post_queue.unfollow && typeof timer[ rows[0].fancrawl_instagram_id ].post_queue.unfollow === "object" ) {
                          var count_unfollow = Object.keys( timer[ rows[0].fancrawl_instagram_id ].post_queue.unfollow );
                        } else {
                          var count_unfollow = [];
                        }

                        if ( count_unfollow.length < ( queueCap - 2 ) ) {

                          if ( timer[ fancrawl_instagram_id ].quick_queue.new[ uniqueProcessCounter ].last_id ) {

                            var last_id = timer[ fancrawl_instagram_id ].quick_queue.new[ uniqueProcessCounter ].last_id;
                            var hash_tag = timer[ fancrawl_instagram_id ].quick_queue.new[ uniqueProcessCounter ].hash_tag;

                            delete timer[ fancrawl_instagram_id ].quick_queue.new[ uniqueProcessCounter ];
                            clockManager( fancrawl_instagram_id, new_instagram_following_id, "unfollow_followedby", last_id, hash_tag );

                          } else {

                            delete timer[ fancrawl_instagram_id ].quick_queue.new[ uniqueProcessCounter ];
                            clockManager( fancrawl_instagram_id, new_instagram_following_id, "unfollow_followedby" );

                          }

                        }

                      // only from FanCrawl user side - nothing from the other side
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

                        if ( timer && timer[ fancrawl_instagram_id ] && timer[ fancrawl_instagram_id ].post_queue && timer[ fancrawl_instagram_id ].post_queue.follow && typeof timer[ fancrawl_instagram_id ].post_queue.follow === "object" ) {
                          var count_follow  = Object.keys( timer[ fancrawl_instagram_id ].post_queue.follow );
                        } else {
                          var count_follow = [];
                        }

                        if ( count_follow.length < ( queueCap - 2 ) ) {

                          if ( timer[ fancrawl_instagram_id ].quick_queue.new[ uniqueProcessCounter ].last_id ) {

                            var last_id = timer[ fancrawl_instagram_id ].quick_queue.new[ uniqueProcessCounter ].last_id;
                            var hash_tag = timer[ fancrawl_instagram_id ].quick_queue.new[ uniqueProcessCounter ].hash_tag;

                            delete timer[ fancrawl_instagram_id ].quick_queue.new[ uniqueProcessCounter ];
                            clockManager( fancrawl_instagram_id, new_instagram_following_id, "follow", last_id, hash_tag );

                          } else {

                            delete timer[ fancrawl_instagram_id ].quick_queue.new[ uniqueProcessCounter ];
                            clockManager( fancrawl_instagram_id, new_instagram_following_id, "follow" );

                          }

                        }

                      }
                    });

                  } else if ( process === "unfollow_verify" ) {

                    // check relationship to determine best what to do
                    GET_relationship( fancrawl_instagram_id, new_instagram_following_id, uniqueProcessCounter, function( blank_slot, b_fancrawl_instagram_id, new_instagram_following_id, relationship, uniqueProcessCounter ){

                      var fancrawl_instagram_id = b_fancrawl_instagram_id;

                      if ( relationship === "access_token" ) {

                        if ( !usersInfo[ fancrawl_instagram_id ] ) {
                          usersInfo[ fancrawl_instagram_id ] = {};
                        }
                        if ( !usersInfo[ fancrawl_instagram_id ].access_token ) {
                          STOP( fancrawl_instagram_id, true );
                        }
                        usersInfo[ fancrawl_instagram_id ].access_token = "FanCrawl blocked from IG - Go to your IG app to unblock.";

                      } else if ( relationship === "APINotAllowedError" ) {

                        if ( !usersInfo[ fancrawl_instagram_id ] ) {
                          usersInfo[ fancrawl_instagram_id ] = {};
                        }
                        connection.query('UPDATE beta_followers SET count = 5 WHERE fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND added_follower_instagram_id = "'+new_instagram_following_id+'"', function(err, rows, fields) {
                          if (err) throw err;
                          // usersInfo[ fancrawl_instagram_id ].APINotAllowedError = "B There has been a special API Error - Report this issue.";
                          delete timer[ fancrawl_instagram_id ].quick_queue.verify[ uniqueProcessCounter ];
                        });

                      } else if ( relationship === "oauth_limit" ) {

                        if ( !usersInfo[ fancrawl_instagram_id ] ) {
                          usersInfo[ fancrawl_instagram_id ] = {};
                        }
                        usersInfo[ fancrawl_instagram_id ].oauth_limit = "The maximum number of IG requests per hour has been exceeded.";

                      } else if ( relationship === "neither" ) {

                        if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].access_token ) {
                          delete usersInfo[ fancrawl_instagram_id ].access_token;
                        }
                        if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].oauth_limit ) {
                          delete usersInfo[ fancrawl_instagram_id ].oauth_limit;
                        }
                        if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].APINotAllowedError ) {
                          delete usersInfo[ fancrawl_instagram_id ].APINotAllowedError;
                        }

                        delete timer[ fancrawl_instagram_id ].quick_queue.verify[ uniqueProcessCounter ];

                        connection.query('UPDATE beta_followers SET count = 5, following_status = 0, followed_by_status = 0 WHERE fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND added_follower_instagram_id = "'+new_instagram_following_id+'"', function(err, rows, fields) {
                          if (err) throw err;
                          // console.log("NEITHER FOLLOWING SO SET TO 5 for user: " + new_instagram_following_id );
                        });

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

                        if ( timer && timer[ fancrawl_instagram_id ] && timer[ fancrawl_instagram_id ].post_queue && timer[ fancrawl_instagram_id ].post_queue.unfollow && typeof timer[ fancrawl_instagram_id ].post_queue.unfollow === "object" ) {
                          var count_unfollow = Object.keys( timer[ fancrawl_instagram_id ].post_queue.unfollow );
                        } else {
                          var count_unfollow = [];
                        }

                        if ( count_unfollow.length < ( queueCap - 2 ) ) {
                          delete timer[ fancrawl_instagram_id ].quick_queue.verify[ uniqueProcessCounter ];
                          clockManager( fancrawl_instagram_id, new_instagram_following_id, "unfollow_followedby" );
                        }

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

                        delete timer[ fancrawl_instagram_id ].quick_queue.verify[ uniqueProcessCounter ];

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

                        if ( timer && timer[ fancrawl_instagram_id ] && timer[ fancrawl_instagram_id ].post_queue && timer[ fancrawl_instagram_id ].post_queue.unfollow && typeof timer[ fancrawl_instagram_id ].post_queue.unfollow === "object" ) {
                          var count_unfollow = Object.keys( timer[ fancrawl_instagram_id ].post_queue.unfollow );
                        } else {
                          var count_unfollow = [];
                        }

                        if ( count_unfollow.length < ( queueCap - 2 ) ) {
                          delete timer[ fancrawl_instagram_id ].quick_queue.verify[ uniqueProcessCounter ];
                          clockManager( fancrawl_instagram_id, new_instagram_following_id, "unfollow" );
                        }

                      }
                    });

                  } else if ( process === 3 || process === "3" || process === 2 || process === "2" || process === 1 || process === "1" || process === 0 || process === "0" ) {

                    // check relationship to determine best what to do
                    GET_relationship( fancrawl_instagram_id, new_instagram_following_id, uniqueProcessCounter, function( blank_slot, c_fancrawl_instagram_id, new_instagram_following_id, relationship, uniqueProcessCounter ){

                      var fancrawl_instagram_id = c_fancrawl_instagram_id;

                      if ( relationship === "access_token" ) {

                        if ( !usersInfo[ fancrawl_instagram_id ] ) {
                          usersInfo[ fancrawl_instagram_id ] = {};
                        }
                        if ( !usersInfo[ fancrawl_instagram_id ].access_token ) {
                          STOP( fancrawl_instagram_id, true );
                        }
                        usersInfo[ fancrawl_instagram_id ].access_token = "FanCrawl blocked from IG - Go to your IG app to unblock.";

                      } else if ( relationship === "APINotAllowedError" ) {

                        if ( !usersInfo[ fancrawl_instagram_id ] ) {
                          usersInfo[ fancrawl_instagram_id ] = {};
                        }
                        connection.query('UPDATE beta_followers SET count = 5 WHERE fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND added_follower_instagram_id = "'+new_instagram_following_id+'"', function(err, rows, fields) {
                          if (err) throw err;
                          delete timer[ fancrawl_instagram_id ].quick_queue.verify[ uniqueProcessCounter ];
                        });

                      } else if ( relationship === "oauth_limit" ) {

                        if ( !usersInfo[ fancrawl_instagram_id ] ) {
                          usersInfo[ fancrawl_instagram_id ] = {};
                        }
                        usersInfo[ fancrawl_instagram_id ].oauth_limit = "The maximum number of IG requests per hour has been exceeded.";

                      } else if ( relationship === "neither" ) {

                        if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].access_token ) {
                          delete usersInfo[ fancrawl_instagram_id ].access_token;
                        }
                        if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].oauth_limit ) {
                          delete usersInfo[ fancrawl_instagram_id ].oauth_limit;
                        }
                        if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].APINotAllowedError ) {
                          delete usersInfo[ fancrawl_instagram_id ].APINotAllowedError;
                        }

                        delete timer[ fancrawl_instagram_id ].quick_queue.verify[ uniqueProcessCounter ];

                        connection.query('UPDATE beta_followers SET count = 5, following_status = 0, followed_by_status = 0 WHERE fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND added_follower_instagram_id = "'+new_instagram_following_id+'"', function(err, rows, fields) {
                          if (err) throw err;
                          // console.log("NEITHER FOLLOWING SO SET TO 5 for user: " + new_instagram_following_id );
                        });

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

                        if ( timer && timer[ fancrawl_instagram_id ] && timer[ fancrawl_instagram_id ].post_queue && timer[ fancrawl_instagram_id ].post_queue.unfollow && typeof timer[ fancrawl_instagram_id ].post_queue.unfollow === "object" ) {
                          var count_unfollow = Object.keys( timer[ fancrawl_instagram_id ].post_queue.unfollow );
                        } else {
                          var count_unfollow = [];
                        }

                        if ( count_unfollow.length < ( queueCap - 2 ) ) {
                          clockManager( fancrawl_instagram_id, new_instagram_following_id, "unfollow_followedby" );
                          delete timer[ fancrawl_instagram_id ].quick_queue.verify[ uniqueProcessCounter ];
                        }

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

                        delete timer[ fancrawl_instagram_id ].quick_queue.verify[ uniqueProcessCounter ];

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

                        if ( timer && timer[ fancrawl_instagram_id ] && timer[ fancrawl_instagram_id ].quick_queue && timer[ fancrawl_instagram_id ].quick_queue.verify && typeof timer[ fancrawl_instagram_id ].quick_queue.verify === "object" ) {
                          var count_verify          = Object.keys( timer[ fancrawl_instagram_id ].quick_queue.verify );
                        } else {
                          var count_verify          = [];
                        }

                        if ( count_verify.length < ( queueCap - 2 ) ) {
                          delete timer[ fancrawl_instagram_id ].quick_queue.verify[ uniqueProcessCounter ];
                          verifyRelationship( fancrawl_instagram_id, new_instagram_following_id );
                        }

                      }
                    });

                  } else {
                    return;
                    console.log("TIMER QUICK XXXX - No process found... "+process+" for user "+new_instagram_following_id);

                  }

                }

              } else {

                sendMail( 571377691, 'timer_quick error', 'The function timer_quick could not determine the state for user: ' + rows[0].fancrawl_instagram_id );
                console.log( "state undefined from timer_quick" )

              }
            });
          /////////////////////////////////////////////////////////////////////

        // IF TRUE TO SETTIMEOUT SHORT
        } else {
          callTimer( fancrawl_instagram_id, "quick_short" );
        }
      } else {
        timer[ fancrawl_instagram_id ].quick_called = true;
      }

    };


//  -----------------------------------------------------------------------------
//  determines where each timer process should be stored
//  -----------------------------------------------------------------------------
    // FROM | fetchNewFollowers - verifyRelationship
    //      -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
    //  TO  | clockManager
//  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  var clockManager                        = function ( fancrawl_instagram_id, new_instagram_following_id, process, last_id, hash_tag, callback ) {

      console.log( "clockManager" );

      var fancrawl_instagram_id = fancrawl_instagram_id;
      var new_instagram_following_id = new_instagram_following_id;
      var process = process;

      if ( last_id ) {
        var last_id = last_id;
      }
      if ( hash_tag ) {
        var hash_tag = hash_tag;
      }

      // if process = "follow"
      if ( process === "follow" ) {

        if ( last_id ) {
          timer[ fancrawl_instagram_id ].post_queue.follow[ processCounter ] = { 'new_instagram_following_id' : new_instagram_following_id, 'last_id' : last_id, 'hash_tag' : hash_tag };
        } else {
          timer[ fancrawl_instagram_id ].post_queue.follow[ processCounter ] = { 'new_instagram_following_id' : new_instagram_following_id };
        }
        processCounter++;

        if ( callback ) {
          callback( fancrawl_instagram_id, new_instagram_following_id );
        }

      // if process = "unfollow" or "unfollow_followedby"
      } else if ( process === "unfollow" || process === "unfollow_followedby") {

        if ( last_id ) {
          timer[ fancrawl_instagram_id ].post_queue.unfollow[ processCounter ] = { 'new_instagram_following_id' : new_instagram_following_id, 'last_id' : last_id, 'hash_tag' : hash_tag };
        } else {
          timer[ fancrawl_instagram_id ].post_queue.unfollow[ processCounter ] = { 'new_instagram_following_id' : new_instagram_following_id };
        }
        processCounter++;

        if ( callback ) {
          callback( fancrawl_instagram_id, new_instagram_following_id );
        }

      // if process = "new"
      } else if ( process === "new" ) {

        timer[ fancrawl_instagram_id ].quick_queue.new[ processCounter ] = { 'new_instagram_following_id' : new_instagram_following_id, 'process' : process };
        processCounter++;

        if ( callback ) {
          callback( fancrawl_instagram_id, new_instagram_following_id, process );
        }

      // if process = "unfollow_verify" or 3,2,1,0
      } else {

        timer[ fancrawl_instagram_id ].quick_queue.verify[ processCounter ] = { 'new_instagram_following_id' : new_instagram_following_id, 'process' : process };
        processCounter++;

        if ( callback ) {
          callback( fancrawl_instagram_id, new_instagram_following_id, process );
        }

      }
    };

//  -----------------------------------------------------------------------------
//  keeps track of clock times to not exceed Instagram's limits
//  -----------------------------------------------------------------------------
    // FROM | timer_post - timer_quick
    //      -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
    //  TO  | callTimer
//  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  var callTimer                           = function ( fancrawl_instagram_id, state) {

      console.log( "callTimer" );

      var fancrawl_instagram_id = fancrawl_instagram_id;
      var state = state;

      if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].access_token ) {
          setTimeouts[ fancrawl_instagram_id ].access_token = setTimeout(
            function(){
                callTimer( arguments[0], arguments[1] );
                // console.log("SETTIMOUT 1 WORKS!!!!", fancrawl_instagram_id);
          }, 1000 * 60 * 1, fancrawl_instagram_id, state ); // 1 min wait
      } else {
        // waits half a second and rechecks timer state
        if ( state === "quick_short" ) {
          setTimeouts[ fancrawl_instagram_id ].quick_short = setTimeout(
            function(){
                timer_quick( arguments[0] );
                // console.log("SETTIMOUT 2 WORKS!!!!", fancrawl_instagram_id);
          }, 500, fancrawl_instagram_id ); // 0.5 sec

        // waits half a second and rechecks timer state
        } else if ( state === "quick_long" ) {
          setTimeouts[ fancrawl_instagram_id ].quick_long = setTimeout(
            function(){
                if ( timer[ arguments[0] ] ) {
                  timer[ arguments[0] ].quick_called = false;
                  timer[ arguments[0] ].quick_seconds = false;
                  timer_quick( arguments[0] );
                }
                // console.log("SETTIMOUT 3 WORKS!!!!", fancrawl_instagram_id);
          },  5000 , fancrawl_instagram_id ); // 1 ~ 1.5 sec
          // }, Math.floor( ( Math.random() * 500 ) + 4000 ), fancrawl_instagram_id ); // 1 ~ 1.5 sec

        } else if ( state === "post_short" ) {

          setTimeouts[ fancrawl_instagram_id ].post_short = setTimeout(
            function(){
              timer_post( arguments[0] );
              // console.log("SETTIMOUT 4 WORKS!!!!", fancrawl_instagram_id);
          }, 5000, fancrawl_instagram_id ); // 5 sec

        } else if ( state === "post_long" ) {
          setTimeouts[ fancrawl_instagram_id ].post_long = setTimeout(
            function(){
              if ( timer[ arguments[0] ] ) {
                timer[ arguments[0] ].post_called = false;
                timer[ arguments[0] ].post_minute = false;
                timer_post( arguments[0] );
              }
              // console.log("SETTIMOUT 5 WORKS!!!!", fancrawl_instagram_id);
          }, Math.floor( ( Math.random() * 10000 ) + 60000 ), fancrawl_instagram_id ); // (1~1.25 minute delay)
        }
      }
    };



//  =============================================================================
//  UTILITIES CALLED BY MAIN SECTIONS
//  =============================================================================

//  -----------------------------------------------------------------------------
//  fancrawl init - SELF INSTANTIATED X?Y
//  -----------------------------------------------------------------------------
    // FROM | server restarting
    //      -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
    //  TO  | startIndividual
//  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  var GO_start                            = function ( ) {

      console.log("============================================");
      console.log("SERVER RESTARTED - STARTING CLEANING PROCESS");

      connection.query('SELECT state, fancrawl_instagram_id FROM access_right', function(err, rows, fields) {
        if (err) throw err;

        if( rows && rows[0] ) {
          for ( var i = 0; i < rows.length; i++ ){
            // EXTRACT USER FROM DATABASE IN STARTED OR CLEANING STATE
            if ( rows[i].fancrawl_instagram_id ){
              if( rows[i].state !== "stopped" ) {
                startIndividual( rows[i].fancrawl_instagram_id );
              };
            }
          }
        }
      });
    }();

//  -----------------------------------------------------------------------------
//  initiates clocks, database previous user check and new following processes
//  -----------------------------------------------------------------------------
    // FROM | GO_start
    //      -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
    //  TO  | timerPostStructure - timerQuickStructure - GET_relationship - timer_post - timer_quick - fetchFromHashInitializer - fetchNewFollowers - cleanDatabase - STOP - sendMail
//  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  var startIndividual                     = function ( fancrawl_instagram_id ) {

      console.log( "startIndividual" );

      var fancrawl_instagram_id = fancrawl_instagram_id;

      // START USER SPECIFIC CLOCK
      timerPostStructure( fancrawl_instagram_id );
      timerQuickStructure( fancrawl_instagram_id );

      // START CLOCK TRACKERS
      if ( !setTimeouts[ fancrawl_instagram_id ] ) {
        setTimeouts[ fancrawl_instagram_id ] = {};
      }

      console.log( "GET_relationship of startIndividual" );
      GET_relationship( fancrawl_instagram_id, 571377691, null, function( blank_slot, d_fancrawl_instagram_id, new_instagram_following_id, response ){

      console.log( "GET_relationship callback" );

        var fancrawl_instagram_id = d_fancrawl_instagram_id;
        var new_instagram_following_id = new_instagram_following_id;
        var response = response;

        if ( response === "error" || response === "access_token" || response === "oauth_limit" ) {

          if ( !usersInfo[ fancrawl_instagram_id ] ) {
            usersInfo[ fancrawl_instagram_id ] = {};
          }

          if ( !usersInfo[ fancrawl_instagram_id ].access_token ) {
            STOP( fancrawl_instagram_id );
          }

          usersInfo[ fancrawl_instagram_id ].access_token = "FanCrawl blocked from IG - Go to your IG app to unblock.";

          console.log("STOPPED STATE - instagram block: ", fancrawl_instagram_id);

        } else {

          connection.query('SELECT state, fancrawl_instagram_id, sHash FROM access_right where fancrawl_instagram_id = "'+ fancrawl_instagram_id +'"', function(err, rows, fields) {
            if (err) throw err;

            // IF USER WAS STARTED
            if ( rows[0].state && rows[0].state === "started" ) {
              console.log("STARTED STATE: ", rows[0].fancrawl_instagram_id);
              var state = rows[0].state;

              // START CLOCKS
              timer_post( rows[0].fancrawl_instagram_id );
              timer_quick( rows[0].fancrawl_instagram_id );

                // start fetching process from hash users
                if ( rows[0].sHash ) {

                  // fetch new user from hash
                  // fetchFromHashInitializer( rows[0].fancrawl_instagram_id );

                  // goes check current database
                  connection.query('SELECT fancrawl_instagram_id, added_follower_instagram_id FROM beta_followers WHERE fancrawl_instagram_id = "'+rows[0].fancrawl_instagram_id+'" AND count NOT IN (5)', function(err, rows, fields) {
                    if (err) throw err;

                    if ( rows && rows[0] ) {

                      setTimeouts[ rows[0].fancrawl_instagram_id ].databaseData = {};

                      for ( var i = 0; i < rows.length; i++ ) {
                        // setTimeouts[ rows[0].fancrawl_instagram_id ].databaseData[ processCounter ] = { 'added_follower_instagram_id' : rows[i].added_follower_instagram_id };
                        processCounter++;
                      }
                    }
                  });

                // start fetching process for new one
                } else {

                  // fetch new user
                  // fetchNewFollowersInitializer( rows[0].fancrawl_instagram_id );

                  // goes through current database
                  connection.query('select fancrawl_instagram_id, added_follower_instagram_id from beta_followers where fancrawl_instagram_id = "'+rows[0].fancrawl_instagram_id+'" AND count not in (5)', function(err, rows, fields) {
                    if (err) throw err;
                    if ( rows && rows[0] ) {
                      setTimeouts[ rows[0].fancrawl_instagram_id ].databaseData = {};
                      for ( var i = 0; i < rows.length; i++ ) {
                        // setTimeouts[ rows[0].fancrawl_instagram_id ].databaseData[ processCounter ] = { 'added_follower_instagram_id' : rows[i].added_follower_instagram_id };
                        processCounter++;
                      }
                    }
                  });
                }

            // IF USER WAS CLEANING
            } else if ( rows[0].state && rows[0].state === "cleaning" ) {
              console.log("CLEANING STATE: ", fancrawl_instagram_id);

              // START CLOCKS
              timer_post( fancrawl_instagram_id );
              timer_quick( fancrawl_instagram_id );

              var state = rows[0].state;
              // CLEAN DATABASE
              cleanDatabase( fancrawl_instagram_id, function( fancrawl_instagram_id ){
                STOP( fancrawl_instagram_id, true );
                console.log( "FINISHED CLEANING UP DATABASE FROM RESTART & PRE CLEANING: ", fancrawl_instagram_id);
                sendMail( fancrawl_instagram_id, "Finished cleaning up", "FanCrawl, finished cleaning up your previous saved followers. If you still see a high number of followers compared to before, do not be alarmed, wait 48 hours and run a cleaning again." );
              });

            }
          });

        }
      });
    };

//  -----------------------------------------------------------------------------
//  lookup last user added to beta_followers and start with the next one
//  -----------------------------------------------------------------------------
    // FROM | startIndividual
    //      -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
    //  TO  | fetchNewFollowers
//  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  var fetchNewFollowersInitializer        = function ( fancrawl_instagram_id ) {

      console.log( "fetchNewFollowersInitializer" );

      var fancrawl_instagram_id = fancrawl_instagram_id;

      connection.query('SELECT "'+ fancrawl_instagram_id +'" AS fancrawl_instagram_id, null AS added_follower_instagram_id UNION SELECT null, MAX( CAST( added_follower_instagram_id as UNSIGNED ) ) AS added_follower_instagram_id from beta_followers where fancrawl_instagram_id = "'+ fancrawl_instagram_id +'"', function(err, rows, fields) {
        if (err) throw err;

        var currentUser = JSON.parse( rows[0].fancrawl_instagram_id );

        if ( rows && rows[1] && rows[1].added_follower_instagram_id && rows[1].added_follower_instagram_id !== null ) {

          var new_instagram_following_id = JSON.parse( rows[0].added_follower_instagram_id ) + 1;

          if ( new_instagram_following_id < currentUser ) {

            var newUser = ( currentUser + 1 );

            fetchNewFollowers( rows[0].fancrawl_instagram_id, JSON.stringify( newUser ) );
            console.log("STARTING FETCHING FOR USER " + rows[0].fancrawl_instagram_id + ", STARTING WITH: ", newUser );

          } else {

            fetchNewFollowers( rows[0].fancrawl_instagram_id, JSON.stringify( new_instagram_following_id ) );
            console.log("STARTING FETCHING FOR USER " + rows[0].fancrawl_instagram_id + ", STARTING WITH: ", new_instagram_following_id );

          }

        } else {

          var new_instagram_following_id = ( currentUser + 1 );
          fetchNewFollowers( rows[0].fancrawl_instagram_id, JSON.stringify( new_instagram_following_id ) );
          console.log("STARTING FETCHING FOR USER " + rows[0].fancrawl_instagram_id + ", STARTING WITH: ", new_instagram_following_id );

        }
      });
    };

//  -----------------------------------------------------------------------------
//  follow crawler function on random instagram users
//  -----------------------------------------------------------------------------
    // FROM | startIndividual
    //      -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
    //  TO  | fetchNewFollowers - checkSecured - checkIfInDatabase - fetchNewFollowers - clockManager
//  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  var fetchNewFollowers                   = function ( fancrawl_instagram_id, new_instagram_following_id ) {

      console.log( "fetchNewFollowers" );

      var fancrawl_instagram_id = fancrawl_instagram_id;
      var new_instagram_following_id = new_instagram_following_id;

      // CHECK STATE FOR STOPPED
      connection.query('SELECT null AS new_instagram_following_id, state, fancrawl_instagram_id, sHash FROM access_right where fancrawl_instagram_id = "'+ fancrawl_instagram_id +'" UNION SELECT "'+new_instagram_following_id+'", null, null, null', function(err, rows, fields) {
        if (err) throw err;

        // IF SO THEN STOP
        if ( rows[0].state === "stopped" || rows[0].state === "cleaning" ) {
          console.log("FETCH NEW FOLLOWERS STOPPED DUE TO STOPPED STATE FOR USER: ", rows[0].fancrawl_instagram_id);

        // IN STARTED OR CLEANING STATE WITH HASH SWITCH ACTIVATED
        } else if ( rows[0].sHash ) {

          fetchFromHashInitializer( rows[0].fancrawl_instagram_id );

        // IN STARTED OR CLEANING STATE WITH HASH SWITCH DEACTIVATED
        } else {

          // CHECK IF IT IS IN ANY SECURED TABLES
          checkSecured( rows[0].fancrawl_instagram_id, rows[1].new_instagram_following_id, function( fancrawl_instagram_id, new_instagram_following_id, status ) {
            // NOT IN ANY DATABASE SO CHECK RELATIOSHIP AND ADD TO DB
            if ( status === "neither" ) {

              checkIfInDatabase( fancrawl_instagram_id, new_instagram_following_id, function( fancrawl_instagram_id, new_instagram_following_id, result ){

                if ( result === true ) {

                  var nextUser = JSON.parse( new_instagram_following_id ) + 1;
                  fetchNewFollowers( fancrawl_instagram_id, JSON.stringify( nextUser ) );

                } else {

                  var quick_count = Object.keys( timer[ fancrawl_instagram_id ].quick_queue.new );

                  // if < then 100 = add to queue and run callback
                  if ( quick_count.length < ( queueCap - 2 ) ) {

                    timer[ fancrawl_instagram_id ].quick_queue.new[ processCounter ] = { 'new_instagram_following_id' : new_instagram_following_id };
                    processCounter++;

                    var nextUser = JSON.stringify( JSON.parse( new_instagram_following_id ) + 1 );

                    // goes fetch next user after 5 sec
                    var time = 1000 * 5; // 5 seconds

                    setTimeouts[ fancrawl_instagram_id ][ processCounter ] = setTimeout(
                      function(){
                      fetchNewFollowers( arguments[0], arguments[1] );
                      delete setTimeouts[ arguments[0] ][ arguments[2] ];
                    }, time, fancrawl_instagram_id, nextUser, processCounter );

                  } else {

                    var time = 1000 * 60; // wait 1 minute

                    setTimeouts[ fancrawl_instagram_id ][ processCounter ] = setTimeout(
                      function(){
                      fetchNewFollowers( arguments[0], arguments[1] );
                      delete setTimeouts[ arguments[0] ][ arguments[2] ];
                    }, time, fancrawl_instagram_id, new_instagram_following_id, processCounter );
                    processCounter++;
                  }

                }
              });

            // IN SECURED DB SO SKIP USER
            } else {
              var nextUser = JSON.parse( new_instagram_following_id ) + 1;
              fetchNewFollowers( fancrawl_instagram_id, JSON.stringify( nextUser ) );
            }
          });
        }
      });
    };

//  -----------------------------------------------------------------------------
//  looks up last id ran for a particular hash_tag and starts from there
//  -----------------------------------------------------------------------------
    // FROM | fetchNewFollowers
    //      -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
    //  TO  | fetchFromHash - fetchNewFollowers
//  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  var fetchFromHashInitializer            = function ( fancrawl_instagram_id, retry ) {

      console.log( "fetchFromHashInitializer" );

      var fancrawl_instagram_id = fancrawl_instagram_id;
      if ( retry ) {
        var retry = retry;
      }

      connection.query('SELECT fancrawl_instagram_id, hash_tag FROM access_right WHERE fancrawl_instagram_id = "'+ fancrawl_instagram_id +'"', function(err, rows, fields) {
        if (err) throw err;

        if ( !retry && rows && rows[0] && rows[0].hash_tag ) {
          // build up hash library

          timer[ rows[0].fancrawl_instagram_id ].quick_queue.hash[ processCounter ] = { 'hash_tag' : rows[0].hash_tag };
          processCounter++;
        }

        connection.query('SELECT "'+ rows[0].fancrawl_instagram_id +'" AS fancrawl_instagram_id, "'+ rows[0].hash_tag +'" AS ori_hash_tag, null AS last_id UNION ALL SELECT null, null, last_id FROM users_hash_tags WHERE fancrawl_instagram_id = "' + rows[0].fancrawl_instagram_id + '" AND hash_tag = "'+rows[0].hash_tag+'"', function( err, rows, fields ) {
          if (err) throw err;

          // if something and last_id
          if ( rows && rows[1] && rows[1].last_id !== null ) {

            fetchFromHash( rows[0].fancrawl_instagram_id, rows[0].ori_hash_tag, rows[1].last_id );

          // if something but no last_id
          } else if ( rows && rows[1] && rows[1].last_id === null ) {

            connection.query('SELECT "'+ rows[0].fancrawl_instagram_id +'" AS fancrawl_instagram_id, "' + rows[0].ori_hash_tag + '" AS ori_hash_tag, null AS id UNION ALL SELECT null, null, id FROM hash_tags WHERE hash_tag = "' + rows[0].ori_hash_tag + '" LIMIT 2', function( err, rows, fields ) {
              if (err) throw err;

              if ( rows && rows[1] && rows[1].id ) {

                var last_id = JSON.stringify( rows[1].id - 1 );

                fetchFromHash( rows[0].fancrawl_instagram_id, rows[0].ori_hash_tag, last_id );

              } else {

                var time = 1000 * 10; // 20 seconds

                setTimeouts[ rows[0].fancrawl_instagram_id ][ processCounter ] = setTimeout(
                  function(){
                  fetchFromHashInitializer( arguments[0], true );
                  delete setTimeouts[ arguments[0] ][ arguments[1] ];
                }, time, rows[0].fancrawl_instagram_id, processCounter );
                processCounter++;

              }
            });

          // if nothing insert it into users_hash_tags table and re-run
          } else if ( rows && !rows[1] ) {

            connection.query('INSERT INTO users_hash_tags SET hash_tag = "' + rows[0].ori_hash_tag + '", fancrawl_instagram_id = "' + rows[0].fancrawl_instagram_id + '"; SELECT "'+ rows[0].fancrawl_instagram_id +'" AS fancrawl_instagram_id', function( err, results ) {
              if (err) throw err;

              fetchFromHashInitializer( results[1].fancrawl_instagram_id );

            });
          }
        })
      });
    };

//  -----------------------------------------------------------------------------
//  ZERO = check if in already in beta_followers databases
//  -----------------------------------------------------------------------------
    // FROM | fetchFromHashInitializer
    //      -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
    //  TO  | fetchFromHash - fetchNewFollowers
//  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  var fetchFromHash                       = function ( fancrawl_instagram_id, hash_tag, last_id ) {

      console.log( "fetchFromHash" );

      var fancrawl_instagram_id = fancrawl_instagram_id;
      var hash_tag = hash_tag;
      var last_id = last_id;

      // CHECK STATE FOR STOPPED
      connection.query('SELECT null as state, null as fancrawl_instagram_id, null as sHash, null as hash_tag, "'+ last_id +'" AS last_id UNION ALL SELECT state, fancrawl_instagram_id, sHash, hash_tag, null FROM access_right where fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
        if (err) throw err;

        // IF SO THEN STOP
        if ( rows[1].state === "stopped" || rows[1].state === "cleaning" ) {

          console.log("FETCH NEW FOLLOWERS STOPPED DUE TO STOPPED STATE FOR USER: ", rows[1].fancrawl_instagram_id);

        // IN STARTED STATE WITH HASH SWITCH ACTIVATED
        } else if ( rows[1].sHash ) {

          var new_count = Object.keys( timer[ rows[1].fancrawl_instagram_id ].quick_queue.new );

          if ( new_count.length < ( queueCap - 2 ) ) {

            connection.query('SELECT "'+ rows[1].fancrawl_instagram_id +'" AS fancrawl_instagram_id, "'+ rows[1].hash_tag +'" AS ori_hash_tag, "'+ rows[0].last_id +'" AS last_id, null AS id, null AS instagram_user_id UNION ALL SELECT null, null, null, id, instagram_user_id FROM hash_tags WHERE id > "' + rows[0].last_id + '" AND hash_tag = "' + rows[1].hash_tag + '" AND instagram_user_id NOT IN ( SELECT added_follower_instagram_id FROM beta_followers WHERE fancrawl_instagram_id = "'+ rows[1].fancrawl_instagram_id +'" ) ORDER BY id LIMIT 2', function(err, rows, fields) {
              if (err) throw err;

              if ( rows && rows[1] && rows[1].instagram_user_id ) {

                timer[ rows[0].fancrawl_instagram_id ].quick_queue.new[ processCounter ] = { 'new_instagram_following_id' : rows[1].instagram_user_id, 'last_id' : rows[1].id, 'hash_tag' : rows[0].ori_hash_tag };
                processCounter++;

                // launch fetchNew again after 5 sec
                var time = 1000 * 5; // 5 seconds

                setTimeouts[ rows[0].fancrawl_instagram_id ][ processCounter ] = setTimeout(
                  function(){
                  fetchFromHash( arguments[0], arguments[1], arguments[2] );
                  delete setTimeouts[ arguments[0] ][ arguments[3] ];
                }, time, rows[0].fancrawl_instagram_id, rows[0].ori_hash_tag, rows[1].id, processCounter );
                processCounter++;

              } else {
                // wait longer
                var time = 1000 * 5; // 5 seconds

                setTimeouts[ rows[0].fancrawl_instagram_id ][ processCounter ] = setTimeout(
                  function(){
                  fetchFromHash( arguments[0], arguments[1], arguments[2] );
                  delete setTimeouts[ arguments[0] ][ arguments[3] ];
                }, time, rows[0].fancrawl_instagram_id, rows[0].ori_hash_tag, rows[0].last_id, processCounter );
                processCounter++;
              }
            });

          } else {
            var time = 1000 * 60; // 1 minute

            // wait a while and try again
            setTimeouts[ rows[1].fancrawl_instagram_id ][ processCounter ] = setTimeout(
              function(){
              fetchFromHash( arguments[0], arguments[1], arguments[2] );
              delete setTimeouts[ arguments[0] ][ arguments[3] ];
            }, time, rows[1].fancrawl_instagram_id, rows[1].hash_tag, rows[0].last_id, processCounter );
            processCounter++;
          }

        // SWITCH HASH DISSABLED SO FETCHING NEW FOLLOWERS WITHOUGH HASH
        } else {

          fetchNewFollowersInitializer( fancrawl_instagram_id );

        }
      });
    };

//  -----------------------------------------------------------------------------
//  verify time elapsed from insertion into the database till now before removing
//  -----------------------------------------------------------------------------
    // FROM | timer_quick
    //      -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
    //  TO  | time_difference - clockManager
//  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  var verifyRelationship                  = function ( fancrawl_instagram_id, new_instagram_following_id ) {

      console.log( "verifyRelationship" );

      var fancrawl_instagram_id = fancrawl_instagram_id;
      var new_instagram_following_id = new_instagram_following_id;

      connection.query('SELECT fancrawl_instagram_id, added_follower_instagram_id, UNIX_TIMESTAMP(creation_date), UNIX_TIMESTAMP(now()) FROM beta_followers WHERE fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND added_follower_instagram_id = "'+new_instagram_following_id+'"', function(err, rows, fields) {
        if (err) throw err;
        if ( rows && rows[0] ) {
          // CHECK TIME DIFFERENCE
          var diffTimeZone = ( rows[0]['UNIX_TIMESTAMP(now())'] - rows[0]['UNIX_TIMESTAMP(creation_date)'] ) / 60 / 60;
          time_difference( rows[0].fancrawl_instagram_id, new_instagram_following_id, rows[0]['UNIX_TIMESTAMP(creation_date)'], rows[0]['UNIX_TIMESTAMP(now())'], function( fancrawl_instagram_id, new_instagram_following_id, code ){
            connection.query('UPDATE beta_followers SET count = ' + code + ' WHERE fancrawl_instagram_id = "'+ fancrawl_instagram_id +'" AND added_follower_instagram_id = "'+ new_instagram_following_id +'"', function(err, rows, fields) {
              if (err) throw err;
            });

            var time_start  = JSON.parse(rows[0]['UNIX_TIMESTAMP(creation_date)']),
                time_now    = JSON.parse(rows[0]['UNIX_TIMESTAMP(now())']),
                time_diff   = (time_now - time_start) * 1000;


            // more then 2 days
            if ( code === 4 ) {
              clockManager( fancrawl_instagram_id, new_instagram_following_id, "unfollow_verify" );

            // less then 2 days
            } else if ( code === 3 ) {

              var two_days  = 1000 * 60 * 60 * 48,
                  delay     = two_days - time_diff;

              setTimeouts[ fancrawl_instagram_id ][ new_instagram_following_id ] = setTimeout(
                function(){
                  clockManager( arguments[0], arguments[1], arguments[2] );
                  delete setTimeouts[ arguments[0] ][ arguments[1] ];
                  console.log("SETTIMOUT 11 WORKS!!!!");
              }, delay, fancrawl_instagram_id, new_instagram_following_id, code ); // time between adding new followers (1 min wait)

            // less then 1 day
            } else if ( code === 2 ) {
              var one_day   = 1000 * 60 * 60 * 24,
                  delay     = one_day - time_diff;

              setTimeouts[ fancrawl_instagram_id ][ new_instagram_following_id ] = setTimeout(
                function(){
                  clockManager( arguments[0], arguments[1], arguments[2] );
                  delete setTimeouts[ arguments[0] ][ arguments[1] ];
                  console.log("SETTIMOUT 12 WORKS!!!!");
              }, delay, fancrawl_instagram_id, new_instagram_following_id, code ); // time between adding new followers (1 min wait)

            // less then 1 hour
            } else if ( code === 1 ) {
              var one_hour  = 1000 * 60 * 60,
                  delay     = one_hour - time_diff;

              setTimeouts[ fancrawl_instagram_id ][ new_instagram_following_id ] = setTimeout(
                function(){
                  clockManager( arguments[0], arguments[1], arguments[2] );
                  delete setTimeouts[ arguments[0] ][ arguments[1] ];
                  console.log("SETTIMOUT 13 WORKS!!!!", arguments[0] );
              }, delay, fancrawl_instagram_id, new_instagram_following_id, code ); // time between adding new followers (1 min wait)

            // less then 5 min
            } else if ( code === 0 ) {
              var five_min  = 1000 * 60 * 5,
                  delay     = five_min - time_diff;

              setTimeouts[ fancrawl_instagram_id ][ new_instagram_following_id ] = setTimeout(
                function(){
                  clockManager( arguments[0], arguments[1], arguments[2] );
                  delete setTimeouts[ arguments[0] ][ arguments[1] ];
                  console.log("SETTIMOUT 14 WORKS!!!!", arguments[0] );
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

//  -----------------------------------------------------------------------------
//  reset post and quick clock lists and stops any setTimeouts still undergoing
//  -----------------------------------------------------------------------------
    // FROM | startIndividual - timer_post - timer_quick -
    //      -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
    //  TO  | timerPostStructure - timerQuickStructure - sendMail
//  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  var STOP                                = function ( fancrawl_instagram_id, blockNotification, callback ) {

      console.log( "STOP" );

      var fancrawl_instagram_id = fancrawl_instagram_id;
      if ( blockNotification ) {
        var blockNotification = blockNotification;
      }

      connection.query('UPDATE access_right set state = "stopped" where fancrawl_instagram_id = "'+ fancrawl_instagram_id +'"', function(err, rows, fields) {
        if (err) throw err;
      });

      // RESET post_timer & quick_timer
      timerPostStructure( fancrawl_instagram_id );
      timerQuickStructure( fancrawl_instagram_id );

      if ( setTimeouts && setTimeouts[ fancrawl_instagram_id ] ) {
        for ( keys in setTimeouts[ fancrawl_instagram_id ] ) {
          clearTimeout( setTimeouts[ fancrawl_instagram_id ][ keys ] );
        }
      }

      setTimeouts[ fancrawl_instagram_id ] = {}

      // RESET post_timer & quick_timer
      timerPostStructure( fancrawl_instagram_id );
      timerQuickStructure( fancrawl_instagram_id );

      console.log("EMPTY TIMER QUEUES FROM SWITCH: ", fancrawl_instagram_id );

      if ( blockNotification ) {
        sendMail( fancrawl_instagram_id, "IG blocked account", "Go on Instagram and try liking a photo from your stream, if a captcha comes up then follow procedure, then log out of Instagram.com then sign back into http://fancrawl.io to re-register with FanCrawl. To reduce this try to post photos more frequently. Thank you." );
      }

      if ( callback ) {
        callback();
      }
    };

//  -----------------------------------------------------------------------------
//  ZERO = check status of current database users
//  -----------------------------------------------------------------------------
    // FROM | startIndividual - trigger
    //      -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
    //  TO  | checkDuplicate - verifyCleaning
//  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  var cleanDatabase                       = function ( fancrawl_instagram_id, callback ) {

      console.log( "cleanDatabase" );

      var fancrawl_instagram_id = fancrawl_instagram_id;

      checkDuplicate ( fancrawl_instagram_id, function ( fancrawl_instagram_id ){
        connection.query('SELECT added_follower_instagram_id FROM beta_followers WHERE fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND count NOT IN (5) AND following_status = 1', function(err, rows, fields) {
          if (err) throw err;
          if ( rows && rows[0] ) {

            setTimeouts[ fancrawl_instagram_id ].databaseData = {};

            for ( var i = 0; i < rows.length; i++ ) {
              setTimeouts[ fancrawl_instagram_id ].databaseData[ processCounter ] = { 'added_follower_instagram_id' : rows[i].added_follower_instagram_id };
              processCounter++;
            }

            var postCount = Object.keys( timer[ fancrawl_instagram_id ].post_queue.follow ).length + Object.keys( timer[ fancrawl_instagram_id ].post_queue.unfollow ).length;
            var quickCount = Object.keys( timer[ fancrawl_instagram_id ].quick_queue.new ).length + Object.keys( timer[ fancrawl_instagram_id ].quick_queue.verify ).length + Object.keys( timer[ fancrawl_instagram_id ].quick_queue.hash ).length + Object.keys( setTimeouts[ fancrawl_instagram_id ].databaseData ).length;

            var postCountTime = postCount * 1000 * 80;
            var quickCountTime = quickCount * 1000 * 1.5;
            var totalCountTime = quickCountTime + postCountTime;

            setTimeout(
              function(){
              verifyCleaning( arguments[0], function( fancrawl_instagram_id ) {
                callback( fancrawl_instagram_id );
              });
            }, totalCountTime + 1000, fancrawl_instagram_id );

          } else {
            // DATABASE HAS NO USERS TO DEAL WITH ANYMORE
            // PROCEED WITH CALLBACK
            callback( fancrawl_instagram_id );
          }
        });
        connection.query('SELECT added_follower_instagram_id FROM beta_followers WHERE fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND count NOT IN (5) AND following_status = 0', function(err, rows, fields) {
          if (err) throw err;
          if ( rows && rows[0] ){
            for ( var i = 0; i < rows.length; i++ ) {
              connection.query('UPDATE beta_followers SET count = 5 WHERE fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND added_follower_instagram_id = "'+rows[i].added_follower_instagram_id+'"', function(err, rows, fields) {
                if (err) throw err;
              });
            }
          }
        });
      });
    };

//  -----------------------------------------------------------------------------
//  ZERO = check on the cleaning process and updates state if done
//  -----------------------------------------------------------------------------
    // FROM | cleanDatabase
    //      -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
    //  TO  | verifyCleaning
//  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  var verifyCleaning                      = function ( fancrawl_instagram_id, callback ) {

      console.log( "verifyCleaning" );

      var fancrawl_instagram_id = fancrawl_instagram_id;

      connection.query('SELECT state FROM access_right where fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
        if (err) throw err;

        if ( rows && rows[0] && rows[0].state && rows[0].state === 'cleaning' ) {
          if ( timer[ fancrawl_instagram_id ] ) {
            if ( timer[ fancrawl_instagram_id ].post_queue || timer[ fancrawl_instagram_id ].quick_queue ) {

                var postCount = Object.keys( timer[ fancrawl_instagram_id ].post_queue.follow ).length + Object.keys( timer[ fancrawl_instagram_id ].post_queue.unfollow ).length;
                var quickCount = Object.keys( timer[ fancrawl_instagram_id ].quick_queue.new ).length + Object.keys( timer[ fancrawl_instagram_id ].quick_queue.verify ).length + Object.keys( timer[ fancrawl_instagram_id ].quick_queue.hash ).length + Object.keys( setTimeouts[ fancrawl_instagram_id ].databaseData ).length;

                var postCountTime = postCount * 1000 * 80;
                var quickCountTime = quickCount * 1000 * 1.5;
                var totalCountTime = quickCountTime + postCountTime;

              if ( postCount !== 0 || quickCount !== 0 ) {

                setTimeout(
                  function(){
                  verifyCleaning( arguments[0], arguments[1] );
                  console.log("SETTIMOUT 15 WORKS!!!!");
                }, totalCountTime, fancrawl_instagram_id, callback );

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
        } else {
          console.log("VERIFY CLEANING WAS INTERUPTED PRIOR TO COMPLETING: ", fancrawl_instagram_id );
        }

      });

   };

//  -----------------------------------------------------------------------------
//  ZERO = check if in secured databases
//  -----------------------------------------------------------------------------
    // FROM |
    //      -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
    //  TO  |
//  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  var checkSecured                        = function ( fancrawl_instagram_id, new_instagram_following_id, callback ) {

      console.log( "checkSecured" );

      var fancrawl_instagram_id = fancrawl_instagram_id;
      var new_instagram_following_id = new_instagram_following_id;

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

//  -----------------------------------------------------------------------------
//  ZERO = check if in already in beta_followers databases
//  -----------------------------------------------------------------------------
    // FROM |
    //      -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
    //  TO  |
//  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  var checkIfInDatabase                   = function ( fancrawl_instagram_id, new_instagram_following_id, callback ) {

      console.log( "checkIfInDatabase" );

      var fancrawl_instagram_id = fancrawl_instagram_id;
      var new_instagram_following_id = new_instagram_following_id;

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

//  -----------------------------------------------------------------------------
//  ZERO = time difference calculator
//  -----------------------------------------------------------------------------
    // FROM |
    //      -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
    //  TO  |
//  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  var time_difference                     = function ( fancrawl_instagram_id, new_instagram_following_id, original_time, current_time, callback ) {

      console.log( "time_difference" );

      var fancrawl_instagram_id = fancrawl_instagram_id;
      var new_instagram_following_id = new_instagram_following_id;
      var original_time = original_time;
      var current_time = current_time;

      // 1407473384 UNIX TIME in seconds
      var five_min              = 300, // 5 minutes in seconds
          one_hour              = 3600, // 1 hour in seconds
          one_day               = 86400, // 1 day in seconds
          two_days              = 172800, // 2 days in seconds
          time_diff             = current_time - original_time;

      if( time_diff < five_min || time_diff === 0 ){
        callback( fancrawl_instagram_id, new_instagram_following_id, 0 );
      } else if( time_diff < one_hour ){
        callback( fancrawl_instagram_id, new_instagram_following_id, 1 );
      } else if( time_diff < one_day ){
        callback( fancrawl_instagram_id, new_instagram_following_id, 2 );
      } else if( time_diff < two_days ){
        callback( fancrawl_instagram_id, new_instagram_following_id, 3 );
      } else {
        callback( fancrawl_instagram_id, new_instagram_following_id, 4 );
      }
    };

//  -----------------------------------------------------------------------------
//  ZERO = database duplicates and resets there count to zero to be rechecked
//  -----------------------------------------------------------------------------
    // FROM |
    //      -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
    //  TO  |
//  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  var checkDuplicate                      = function ( fancrawl_instagram_id, callback ) {

      console.log( "checkDuplicate" );

      var fancrawl_instagram_id = fancrawl_instagram_id;

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

//  -----------------------------------------------------------------------------
//  ZERO = Get last week metric
//  -----------------------------------------------------------------------------
    // FROM |
    //      -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
    //  TO  |
//  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  var lastWeek                            = function ( fancrawl_instagram_id, callback ) {

      console.log( "lastWeek" );

      var fancrawl_instagram_id = fancrawl_instagram_id;

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

//  -----------------------------------------------------------------------------
//  ZERO = insert hash data into library
//  -----------------------------------------------------------------------------
    // FROM |
    //      -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
    //  TO  |
//  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  var insert_hash_data                    = function ( instagram_user_id, instagram_photo_id, hash_tag, created_time ) {

      console.log( "insert_hash_data" );

      var fancrawl_instagram_id = fancrawl_instagram_id;
      var instagram_photo_id = instagram_photo_id;
      var hash_tag = hash_tag;
      var created_time = created_time;

      connection.query('SELECT hash_tag, instagram_photo_id, created_time from hash_tags where hash_tag = "' + hash_tag + '" AND instagram_photo_id = "' + instagram_photo_id + '"', function(err, rows, fields) {
        if (err) throw err;

        // if something exist in the database
        if ( rows && rows[0] ) {

        // otherwise
        } else {
          connection.query('INSERT INTO hash_tags set hash_tag = "' + hash_tag + '", instagram_user_id = "' + instagram_user_id + '", instagram_photo_id = "' + instagram_photo_id + '", created_time = FROM_UNIXTIME(' + created_time + ')' , function(err, rows, fields) {
            if (err) throw err;
          });
        }
      });
    };

//  -----------------------------------------------------------------------------
//  ZERO = Get media list of tags
//  -----------------------------------------------------------------------------
    // FROM |
    //      -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
    //  TO  |
//  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  var add_hash_data                       = function ( fancrawl_instagram_id, body, hash_tag ) {

      console.log( "add_hash_data" );

      var fancrawl_instagram_id = fancrawl_instagram_id;
      var body = body;
      var hash_tag = hash_tag;

      for ( var i = 0; i < body.data.length; i++ ) {
        if ( body && body.data && body.data[i] && body.data[i].type === 'image' ) {
          if ( body.data[i].id && body.data[i].created_time && body.data[i].user && body.data[i].user.id ) {
            var result = body.data[i];
            // checks if it is already in hash_tag database... if not saves it in there
              insert_hash_data( result.user.id, result.id, hash_tag, result.created_time );
          }
        }
      }
    };

//  -----------------------------------------------------------------------------
//  ZERO = send email notification
//  -----------------------------------------------------------------------------
    // FROM |
    //      -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
    //  TO  |
//  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  var sendMail                            = function ( fancrawl_instagram_id, subject, error ) {

      console.log( "sendMail" );

      var fancrawl_instagram_id = fancrawl_instagram_id;
      var subject = subject;
      var error = error;

      // var htmlBody = '<b>Hello world</b></br><div style="width:100px; height: 200px; background-color: red;">YOLLO</div>'
      // sendMail( 571377691, 'server was restarted', htmlBody );

      // create reusable transporter object using SMTP transport
      var transporter = nodemailer.createTransport({
          service: 'Gmail',
          auth: {
              user: process.env.FANCRAWLEMAIL,
              pass: process.env.FANCRAWLEMAILPASS
          }
      });

      var errorLimitDelay = 20; // minutes

      connection.query('SELECT mNoti from settings', function(err, rows, fields) {
        if (err) throw err;

        if ( rows[0].mNoti ) {
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
                  if ( error.responseCode === 454) {
                    // { [Error: Invalid login]
                      //    code: 'EAUTH',
                      //    response: '454 4.7.0 Too many login attempts, please try again later. ca2sm424696pbc.68 - gsmtp',
                      //    responseCode: 454 }
                    console.log( "eMail error 454 - Too many login attempts - waiting "+errorLimitDelay+" min and trying again.");
                    setTimeouts[ fancrawl_instagram_id ].sendEmail = setTimeout(
                      function(){
                          callTimer( arguments[0], arguments[1] );
                          console.log( "eMail error 454 - Too many login attempts - waited "+ arguments[3] +" min and attempted again.");
                          sendMail( arguments[0], arguments[1], arguments[2] );
                    }, 1000 * 60 * errorLimitDelay, fancrawl_instagram_id, subject, error, errorLimitDelay ); // 1 min wait

                  } else if ( error.responseCode === 421) {
                    // { [Error: Data command failed]
                      //    code: 'EENVELOPE',
                      //    response: '421 4.7.0 Temporary System Problem.  Try again later (WS). i4sm571837pdl.11 - gsmtp',
                      //    responseCode: 421 }
                    console.log( "eMail error 421 - Temporary System Problem - waiting "+errorLimitDelay+" min and trying again.");
                    setTimeouts[ fancrawl_instagram_id ].sendEmail = setTimeout(
                      function(){
                          callTimer( arguments[0], arguments[1] );
                          console.log( "eMail error 421 - Temporary System Problem - waited "+ arguments[3] +" min and attempted again.");
                          sendMail( arguments[0], arguments[1], arguments[2] );
                    }, 1000 * 60 * errorLimitDelay, fancrawl_instagram_id, subject, error, errorLimitDelay ); // 1 min wait

                  } else {
                    console.log( "email error -", error );
                    sendMail( 571377691, 'mail error', 'The function sendMail got the following error: ' + error );
                  }

                } else {
                  console.log( 'Message sent: ' + info.response );
                };
              });
            }
          });
        }
      });
    };



//  =============================================================================
//  INSTAGRAM CALLS
//  =============================================================================

//  -----------------------------------------------------------------------------
//  acquire current users followed_by and following count @ 5000/hour collectively
//  -----------------------------------------------------------------------------
    // FROM |
    //      -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
    //  TO  |
//  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  var GET_stats                           = function ( fancrawl_instagram_id, callback ) {

      console.log( "GET_stats" );

      var fancrawl_instagram_id = fancrawl_instagram_id;

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

//  -----------------------------------------------------------------------------
//  look up relationship with another desired user @ 5000/hour collectively
//  -----------------------------------------------------------------------------
    // FROM | startIndividual - timer_quick
    //      -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
    //  TO  | GET_relationship - sendMail
//  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  var GET_relationship                    = function ( fancrawl_instagram_id, new_instagram_following_id, uniqueProcessCounter, callback ) {

      console.log( "GET_relationship" );

      var fancrawl_instagram_id = fancrawl_instagram_id;
      var new_instagram_following_id = new_instagram_following_id;
      var uniqueProcessCounter = uniqueProcessCounter;

      connection.query('SELECT fancrawl_instagram_id, "'+ new_instagram_following_id +'" AS new_instagram_following_id, "'+ uniqueProcessCounter +'" AS uniqueProcessCounter, token from access_right where fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {

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
            uri: 'https://api.instagram.com/v1/users/'+rows[0].new_instagram_following_id+'/relationship',
            qs: {'access_token': rows[0].token},
            method: 'GET',
            headers: headers
            }

        request( options, function ( error, response, body ) {

          // if ( fancrawl_instagram_id === 571377691 || fancrawl_instagram_id === '571377691' ) {
          //   console.log("relationship "+new_instagram_following_id+" : ", body);
          // }

          // CHECK FOR BODY
          if ( !error && response.statusCode === 200 ) {

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

                  // NEITHER YOU OR THEY ARE FOLLOWING ONE ANOTHER
                  if( pbody.data.outgoing_status === "none" ) {
                    // {"meta":{"code":200},"data":{"outgoing_status":"none","target_user_is_private":true,"incoming_status":"none"}}
                    // console.log( "RELATIONSHIP: you "+fancrawl_instagram_id+" and user "+new_instagram_following_id+" are not following one another" );
                    // console.log( JSON.stringify( callback ) );
                    callback( rows[0].fancrawl_instagram_id, rows[0].new_instagram_following_id, "neither", rows[0].uniqueProcessCounter );

                  // ONLY FOLLOWS NEW USER
                  } else if( pbody.data.outgoing_status === "requested"  ) {
                    // {"meta":{"code":200},"data":{"outgoing_status":"requested","target_user_is_private":true,"incoming_status":"none"}}
                    // console.log( "RELATIONSHIP: you "+fancrawl_instagram_id+" have requested to follow this user: "+new_instagram_following_id );
                    callback( rows[0].fancrawl_instagram_id, rows[0].new_instagram_following_id, "requested", rows[0].uniqueProcessCounter );


                  // ONLY FOLLOWS NEW USER
                  } else if( pbody.data.outgoing_status === "follows"  ) {
                    // {"meta":{"code":200},"data":{"outgoing_status":"follows","target_user_is_private":true,"incoming_status":"none"}}
                    // console.log( "RELATIONSHIP: you "+fancrawl_instagram_id+" are only following user: "+new_instagram_following_id );
                    callback( rows[0].fancrawl_instagram_id, rows[0].new_instagram_following_id, "follows", rows[0].uniqueProcessCounter );
                  }

                } else if( pbody.data.incoming_status === "followed_by" ) {

                  // ONLY FOLLOWED_BY BACK
                  if( pbody.data.outgoing_status === "none" ) {
                    // {"meta":{"code":200},"data":{"outgoing_status":"none","target_user_is_private":true,"incoming_status":"followed_by"}}
                    // console.log( "RELATIONSHIP: "+new_instagram_following_id+" is following you "+fancrawl_instagram_id+" back" );
                    callback( rows[0].fancrawl_instagram_id, rows[0].new_instagram_following_id, "followed_by", rows[0].uniqueProcessCounter );

                  // BOTH FOLLOW AND FOLLOWED_BY BACK
                  } else if( pbody.data.outgoing_status === "requested" ) {
                    // {"meta":{"code":200},"data":{"outgoing_status":"requested","target_user_is_private":true,"incoming_status":"followed_by"}}
                    // console.log( "RELATIONSHIP: you "+fancrawl_instagram_id+" have requested to follow user "+new_instagram_following_id+" and he is following you back" );
                    callback( rows[0].fancrawl_instagram_id, rows[0].new_instagram_following_id, "followed_by_and_requested", rows[0].uniqueProcessCounter );

                  // BOTH FOLLOW AND FOLLOWED_BY BACK
                  } else if( pbody.data.outgoing_status === "follows" ) {
                    // {"meta":{"code":200},"data":{"outgoing_status":"follows","target_user_is_private":true,"incoming_status":"followed_by"}}
                    // console.log( "RELATIONSHIP: you "+fancrawl_instagram_id+" are following user "+new_instagram_following_id+" and he is following you back" );
                    callback( rows[0].fancrawl_instagram_id, rows[0].new_instagram_following_id, "both", rows[0].uniqueProcessCounter );

                  }
                }

              } else {
                console.log("RELATIONSHIP: you "+fancrawl_instagram_id+"did not pick up on body of user "+rows[0].new_instagram_following_id+" - ", body);
                callback( rows[0].fancrawl_instagram_id, rows[0].new_instagram_following_id, "error", rows[0].uniqueProcessCounter );
              }

            } else {
              console.log("RELATIONSHIP: "+rows[0].fancrawl_instagram_id+" got an error from pbody "+rows[0].new_instagram_following_id+" - ", pbody );
              callback( rows[0].fancrawl_instagram_id, rows[0].new_instagram_following_id, "error", rows[0].uniqueProcessCounter );
            }

          } else if ( !error && response.statusCode !== 200 ) {
            // body: '{"meta":{"error_type":"APINotFoundError","code":400,"error_message":"this user does not exist"}}' }

            if ( response && ( response.statusCode === 503 || response.statusCode === 502 || response.statusCode === 500 || response.statusCode === 400 || response.statusCode === 429 ) ) {
            } else if ( response && response.statusCode ) {
              console.log( response.statusCode );
            }

            if ( response.statusCode === 503 || response.statusCode === 502 || response.statusCode === 500 ) {

              setTimeouts[ rows[0].fancrawl_instagram_id ][ processCounter ] = setTimeout(
                function(){
                GET_relationship( arguments[0], arguments[1], arguments[2] ,arguments[3] );
                delete setTimeouts[ arguments[0] ][ arguments[4] ];
              }, 1000 * 20, rows[0].fancrawl_instagram_id, rows[0].new_instagram_following_id, rows[0].uniqueProcessCounter, callback, processCounter );
              processCounter++;

              return;
            } else if ( response.statusCode === 400 || response.statusCode === 429 ) {
              var pbody = JSON.parse( body );
            } else if ( typeof body === "string" && body[0] === '<' && body[1] === 'h' ) {
              // '<html><body><h1>503 Service Unavailable</h1>\nNo server is available to handle this request.\n</body></html>\n' // possibly
              sendMail( 571377691, 'get relationship unknown error', 'The function GET_relationship got the following body: ' + body + ' for trying to check relashionship of: ' + rows[0].new_instagram_following_id + ' and with statusCode: ' + response.statusCode );

              setTimeouts[ rows[0].fancrawl_instagram_id ][ processCounter ] = setTimeout(
                function(){
                GET_relationship( arguments[0], arguments[1], arguments[2], arguments[3] );
                delete setTimeouts[ arguments[0] ][ arguments[4] ];
              }, 1000 * 20, rows[0].fancrawl_instagram_id, rows[0].new_instagram_following_id, rows[0].uniqueProcessCounter, callback, processCounter );
              processCounter++;

              return;
            } else if ( typeof body === "string" ) {
              var pbody = JSON.parse( body );
            } else if ( typeof body === "object" ) {
              var pbody = body;
            } else {
              console.log( "NOT A STRING NOR OBJECT: ", body );
              var pbody = body;
            }

            // DOES NOT EXIST - POST_FOLLOW THE NEXT USER
            if ( pbody && !pbody.meta ) {
              sendMail( 571377691, 'get relationship no meta', 'The function GET_relationship did not have meta: ' + pbody );

            } else if ( pbody && pbody.meta && pbody.meta.error_message && pbody.meta.error_message === "this user does not exist" ) {
              // {"meta":{"error_type":"APINotFoundError","code":400,"error_message":"this user does not exist"}}
              // console.log("RELATIONSHIP: "+new_instagram_following_id+" does not exist");
              callback( rows[0].fancrawl_instagram_id, rows[0].new_instagram_following_id, "not_exist", rows[0].uniqueProcessCounter );

            } else if ( pbody && pbody.meta && pbody.meta.error_type && pbody.meta.error_type === "APINotAllowedError" ) {
              // {"meta":{"error_type":"APINotAllowedError","code":400,"error_message":"you cannot view this resource"}}
              // sendMail( "571377691", "API Error", JSON.stringify(pbody) + " from user: " + fancrawl_instagram_id + "of relationships trying to follow: " + new_instagram_following_id );
              callback( rows[0].fancrawl_instagram_id, rows[0].new_instagram_following_id, "APINotAllowedError", rows[0].uniqueProcessCounter );

            // OAUTH TOKEN EXPIRED
            } else if( pbody && pbody.meta && pbody.meta.error_message && pbody.meta.error_message === "The access_token provided is invalid." ) {
              // {"meta":{"error_type":"OAuthParameterException","code":400,"error_message":"The access_token provided is invalid."}}
              console.log( "RELATIONSHIP: "+rows[0].fancrawl_instagram_id+" MUST LOG IN AGAIN - NEED NEW TOKEN - OR VALIDATE ACCOUNT AGAIN");
              callback( rows[0].fancrawl_instagram_id, rows[0].new_instagram_following_id, "access_token", rows[0].uniqueProcessCounter );

            // OAUTH TIME LIMIT REACHED LET TIMER KNOW AND TRIES AGAIN
            } else if( pbody && pbody.meta && pbody.meta.error_type && pbody.meta.error_type === "OAuthRateLimitException" ) {
              // {"meta":{"error_type":"OAuthRateLimitException","code":429,"error_message":"The maximum number of requests per hour has been exceeded. You have made 91 requests of the 60 allowed in the last hour."}}
              console.log("RELATIONSHIP: LIMIT REACH FOR: "+rows[0].fancrawl_instagram_id+" - ", pbody);
              callback( rows[0].fancrawl_instagram_id, rows[0].new_instagram_following_id, "oauth_limit", rows[0].uniqueProcessCounter );
            } else {
              console.log("RELATIONSHIP: "+rows[0].fancrawl_instagram_id+" got a weird statusCode "+rows[0].new_instagram_following_id+" - ", pbody);
              sendMail( 571377691, 'get relationship weird statusCode', 'The function GET_relationship got the following body: ' + pbody );
              callback( rows[0].fancrawl_instagram_id, rows[0].new_instagram_following_id, "error", rows[0].uniqueProcessCounter );
            }

          } else {
            console.log("RELATIONSHIP: "+rows[0].fancrawl_instagram_id+" got an error "+rows[0].new_instagram_following_id+" - ", error);
            sendMail( 571377691, 'get relationship error', 'The function GET_relationship got the following error: ' + error );
            callback( rows[0].fancrawl_instagram_id, rows[0].new_instagram_following_id, "error", rows[0].uniqueProcessCounter );
          }
        });
      });
    };

//  -----------------------------------------------------------------------------
//  acquires media list from hash_tag @ 5000/hour collectively
//  -----------------------------------------------------------------------------
    // FROM | timer_quick
    //      -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
    //  TO  | sendMail
//  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  var GET_hash_tag_media                  = function ( fancrawl_instagram_id, hash_tag, pagination, callback ) {

      console.log( "GET_hash_tag_media" );

      var fancrawl_instagram_id = fancrawl_instagram_id;
      var hash_tag = hash_tag;
      var pagination = pagination;

      connection.query('SELECT state, token, sHash from access_right where fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
        if (err) throw err;
        if ( rows && rows[0] && rows[0].state ) {
          if ( rows[0].state !== "started" || rows[0].sHash !== 1 ) {
            timer[ fancrawl_instagram_id ].quick_queue.hash = {};

          } else {

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

            if ( pagination && pagination !== "start" ) {
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

              if ( !error && response.statusCode == 200 ) {
              var pbody = JSON.parse( body );
                if ( pbody.data && pbody.data[0] ) {

                  if ( pbody.pagination && pbody.pagination.next_url ) {

                    var count_hash = Object.keys( timer[ fancrawl_instagram_id ].quick_queue.hash );
                    delete timer[ fancrawl_instagram_id ].quick_queue.hash[ count_hash[0] ];

                    timer[ fancrawl_instagram_id ].quick_queue.hash[ processCounter ] = { 'hash_tag' : hash_tag , 'pagination' : pbody.pagination.next_url };
                    processCounter++;
                  }

                  // add hash info to database
                  add_hash_data( fancrawl_instagram_id, pbody, hash_tag );
                }
              } else if ( error ) {
                console.log('GET_hash_tag_media error ('+fancrawl_instagram_id+'): ', error);
                sendMail( 571377691, 'get hash tag media error', 'The function GET_hash_tag_media got the following error: ' + error );
              }

            });
          }
        }
      });
    };

//  -----------------------------------------------------------------------------
//  acquires list of users that current user follows @ 5000/hour collectively
//  -----------------------------------------------------------------------------
    // FROM |
    //      -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
    //  TO  |
//  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  var GET_follows                         = function ( fancrawl_instagram_id, pagination, write, callback ) {

      console.log( "GET_follows" );

      var fancrawl_instagram_id = fancrawl_instagram_id;
      if ( pagination ) {
        var pagination = pagination;
      }

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

//  -----------------------------------------------------------------------------
//  acquires list of users that follows current user @ 5000/hour collectively
//  -----------------------------------------------------------------------------
    // FROM |
    //      -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
    //  TO  |
//  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  var GET_followed_by                     = function ( fancrawl_instagram_id, pagination, write, callback ) {

      console.log( "GET_followed_by" );

      var fancrawl_instagram_id = fancrawl_instagram_id;
      if ( pagination ) {
        var pagination = pagination;
      }

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

//  -----------------------------------------------------------------------------
//  starts following a specific user @ 60/hour limit
//  -----------------------------------------------------------------------------
    // FROM | timer_post
    //      -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
    //  TO  | sendMail - clockManager - verifyRelationship
//  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  var POST_follow                         = function ( fancrawl_instagram_id, new_instagram_following_id, processCounter, callback ) {

      console.log( "POST_follow" );

      var fancrawl_instagram_id = fancrawl_instagram_id;
      var new_instagram_following_id = new_instagram_following_id;
      var processCounter = processCounter;

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

                    if ( callback ) {
                      callback( fancrawl_instagram_id, new_instagram_following_id, processCounter );
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

//  -----------------------------------------------------------------------------
//  stops following a specific user @ 60/hour limit
//  -----------------------------------------------------------------------------
    // FROM | timer_post
    //      -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
    //  TO  | time_difference - sendMail - clockManager
//  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  var POST_unfollow                       = function ( fancrawl_instagram_id, new_instagram_following_id, followed_by, processCounter, callback ) {

      console.log( "POST_unfollow" );

      var fancrawl_instagram_id = fancrawl_instagram_id;
      var new_instagram_following_id = new_instagram_following_id;
      var followed_by = followed_by;
      var processCounter = processCounter;

      if ( followed_by ) {
        var followed_by_status = 1;
      } else {
        var followed_by_status = 0;
      }

      connection.query('SELECT added_follower_instagram_id, UNIX_TIMESTAMP(creation_date), UNIX_TIMESTAMP(now()) FROM beta_followers WHERE fancrawl_instagram_id = "'+ fancrawl_instagram_id +'" AND added_follower_instagram_id = "'+ new_instagram_following_id +'"', function(err, rows, fields) {
        if (err) throw err;
        console.log("UNIX_TIMESTAMP RESULT FOR UNFOLLOW: ", rows);
        if ( rows && rows[0] && rows[0].added_follower_instagram_id ) {
          // CHECK TIME DIFFERENCE
          time_difference( fancrawl_instagram_id, new_instagram_following_id, rows[0]['UNIX_TIMESTAMP(creation_date)'], rows[0]['UNIX_TIMESTAMP(now())'], function( fancrawl_instagram_id, new_instagram_following_id, code ){
            var count = code;


            // check in secure detabase before unfollowin if not there then unfollow
            connection.query('SELECT * FROM s_followed_by WHERE fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND followed_by_username = "'+new_instagram_following_id+'"', function(err, rows, fields) {
              if (err) throw err;
              if (rows[0]) {
                // found in secure database so do not unfollow
                // on success update database with right values
                connection.query('UPDATE beta_followers SET count = 5, following_status = 1, followed_by_status = '+followed_by_status+' WHERE fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND added_follower_instagram_id = "'+new_instagram_following_id+'"', function(err, rows, fields) {
                  if (err) throw err;
                  callback( fancrawl_instagram_id, new_instagram_following_id, processCounter );
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

                          if ( followed_by ) {
                            clockManager( fancrawl_instagram_id, new_instagram_following_id, "unfollow_followedby" );
                          } else {
                            clockManager( fancrawl_instagram_id, new_instagram_following_id, "unfollow" );
                          }

                        } else if ( pbody.data && pbody.data.outgoing_status && pbody.data.outgoing_status === "none") {
                          if ( usersInfo[ fancrawl_instagram_id ] && usersInfo[ fancrawl_instagram_id ].OAuthRateLimitException ) {
                            delete usersInfo[ fancrawl_instagram_id ].OAuthRateLimitException;
                          }
                          connection.query('UPDATE beta_followers SET count = 5, following_status = 0, followed_by_status = '+followed_by_status+' where fancrawl_instagram_id = "'+fancrawl_instagram_id+'" AND added_follower_instagram_id = "'+new_instagram_following_id+'"', function(err, rows, fields) {
                            if (err) throw err;

                            if ( callback ) {
                              callback( fancrawl_instagram_id, new_instagram_following_id, processCounter );
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
        } else {

          connection.query('INSERT INTO beta_followers SET fancrawl_instagram_id = '+fancrawl_instagram_id+', count = 5, added_follower_instagram_id = '+ new_instagram_following_id, function(err, rows, fields) {
            if (err) throw err;
          });

        }
      });
    }



//  =============================================================================
//  REQUEST HANDLERS
//  =============================================================================

//  -----------------------------------------------------------------------------
//  FIRST = load landing page '/'
//  -----------------------------------------------------------------------------
    // FROM |
    //      -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
    //  TO  | authorize_user
//  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  exports.login                           = function ( req, res ) {

      console.log( "exports.login" );

      console.log("loggedin");
      res.render('./partials/login.ejs');
    };

//  -----------------------------------------------------------------------------
//  SECOND = link to instagram authentication api for access token
//  -----------------------------------------------------------------------------
    // FROM | login
    //      -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
    //  TO  | handleauth
//  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  exports.authorize_user                  = function ( req, res ) {

      console.log( "exports.authorize_user" );

      console.log("authorizing");
      var url = 'https://api.instagram.com/oauth/authorize/?client_id='+process.env.FANCRAWLCLIENTID+'&redirect_uri='+process.env.INSURIREDIRECT+'&response_type=code&state=a%20state&scope=likes+comments+relationships';
      res.redirect(url);
    };

//  -----------------------------------------------------------------------------
//  THIRD = handle instagram response and check access rights
//  -----------------------------------------------------------------------------
    // FROM | authorize_user
    //      -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
    //  TO  | timerPostStructure - timerQuickStructure - callTimer - dashboard
//  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  exports.handleauth                      = function ( req, res ) {

      console.log( "exports.handleauth" );

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
      request( options, function (error, response, body) {

        if ( typeof body === "string" ) {
          var pbody = JSON.parse( body );
          console.log("HANDLEN AUTH - it was a string");
          console.log( pbody );
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

//  -----------------------------------------------------------------------------
//  FOURTH = go grab instagram follower/ed data and show it
//  -----------------------------------------------------------------------------
    // FROM | handleauth
    //      -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
    //  TO  | GET_stats - lastWeek
//  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  exports.dashboard                       = function ( req, res ) {

      console.log( "exports.dashboard" );

      var metrics                         = {
                                              'admin': false,
                                              'mNoti': 0,

                                              'state': '',
                                              'fullName': '',
                                              'userName': '',
                                              'userID': '',
                                              'email': '',
                                              'sHash': 0,
                                              'eNoti': 0,
                                              'hash_tag': '',
                                              'userPicture': '',

                                              'followedBy': 0,
                                              'following': 0,

                                              'totalCrawled': 0,
                                              'followingFromFanCrawl': 0,
                                              'followingFromFanCrawlPercentage': 0,
                                              'followingFromFanCrawlResult' : 'some text',
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
                                              'cleaningTime' : 'Some time metric goes here',
                                              'errorLogs': {},
                                              'data': [230,245,269,274,292,320,368]
                                            };

      if ( usersInfo[ req.query.id ] && JSON.stringify( usersInfo[ req.query.id ] ).length > 2 ) {
        metrics.errorLogs = usersInfo[ req.query.id ];
      }

      if ( JSON.stringify( req.query ).length !== 2 && req.query.user !== undefined && req.query.id !== undefined ) {

        // check access rights from database.
        connection.query('SELECT state, fancrawl_full_name, fancrawl_username, email, sHash, eNoti, hash_tag, fancrawl_profile_picture, or_followed_by, or_following FROM access_right where fancrawl_instagram_id = '+ req.query.id, function(err, rows, fields) {
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

            metrics.state                 = rows[0].state;
            metrics.fullName              = rows[0].fancrawl_full_name;
            metrics.userName              = rows[0].fancrawl_username;
            metrics.userID                = req.query.id;
            metrics.email                 = rows[0].email;
            metrics.sHash                 = rows[0].sHash;
            metrics.eNoti                 = rows[0].eNoti;
            metrics.hash_tag              = rows[0].hash_tag;
            metrics.userPicture           = rows[0].fancrawl_profile_picture;

            metrics.followedBy            = rows[0].or_followed_by ;
            metrics.following             = rows[0].or_following ;

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
                connection.query('SELECT count(*) from beta_followers where fancrawl_instagram_id = "'+req.query.id+'" AND count not in (5) AND following_status = 1', function(err, rows, fields) {
                  if (err) throw err;

                  if ( setTimeouts && setTimeouts[ req.query.id ] && setTimeouts[ req.query.id ].databaseData ) {
                    var databaseCount     = Object.keys( setTimeouts[ req.query.id ].databaseData ).length;
                  } else {
                    var databaseCount     = 0;
                  }

                  if ( timer && timer[ req.query.id ] && timer[ req.query.id ].quick_queue && timer[ req.query.id ].quick_queue.verify ) {
                    var verifyCount       = Object.keys( timer[ req.query.id ].quick_queue.verify ).length;
                  } else {
                    var verifyCount       = 0;
                  }

                  if ( timer && timer[ req.query.id ] && timer[ req.query.id ].quick_queue && timer[ req.query.id ].quick_queue.new ) {
                    var newCount          = Object.keys( timer[ req.query.id ].quick_queue.new ).length;
                  } else {
                    var newCount          = 0;
                  }

                  if ( timer && timer[ req.query.id ] && timer[ req.query.id ].quick_queue && timer[ req.query.id ].quick_queue.hash ) {
                    var hashCount         = Object.keys( timer[ req.query.id ].quick_queue.hash ).length;
                  } else {
                    var hashCount         = 0;
                  }

                  if ( timer && timer[ req.query.id ] && timer[ req.query.id ].post_queue && timer[ req.query.id ].post_queue.unfollow ) {
                    var unfollowCount     = Object.keys( timer[ req.query.id ].post_queue.unfollow ).length;
                  } else {
                    var unfollowCount     = 0;
                  }

                  if ( timer && timer[ req.query.id ] && timer[ req.query.id ].post_queue && timer[ req.query.id ].post_queue.follow ) {
                    var followCount         = Object.keys( timer[ req.query.id ].post_queue.follow ).length;
                  } else {
                    var followCount         = 0;
                  }


                  var quickCount          = databaseCount + verifyCount + newCount + hashCount;
                  var postCount           = unfollowCount + followCount;

                  var quickCountTime      = quickCount * 1000 * 1.5;
                  var postCountTime       = postCount * 1000 * 80;

                  var totalCountTime      = quickCountTime + postCountTime;

                  metrics.latestFollowing = JSON.parse(rows[0]['count(*)'])  + metrics.following;

                  metrics.latestFollowedByPercentage = Math.floor( ( ( metrics.latestFollowedBy / metrics.followedBy ) * 100 ) - 100);
                  metrics.latestFollowingPercentage = Math.floor( ( ( metrics.latestFollowing / metrics.following ) * 100 ) - 100);

                  if ( metrics.latestFollowedByPercentage >= 0 ) {

                    metrics.lfbpClass     = 'up';

                  } else {

                    metrics.lfbpClass     = 'down';

                  }

                  if ( metrics.latestFollowingPercentage >= 0 ) {

                    metrics.lfpClass      = 'up';

                  } else {

                    metrics.lfpClass      = 'down';

                  }

                  var milliseconds        = totalCountTime,
                      seconds             = milliseconds / 1000,
                      minutes             = seconds / 60,
                      hours               = minutes / 60,
                      days                = hours / 24,
                      totalDays           = Math.floor( days ),
                      totalHours          = Math.floor( ( days % 1 ) * 24 ),
                      totalMinutes        = Math.floor( ( ( ( ( days % 1 ) * 24) % 1 ) * 60 ) );
                      totalSeconds        = Math.floor( ( ( ( ( ( days % 1 ) * 24) % 1 ) * 60 ) % 1 ) * 60 );

                      if ( totalDays !== 0 ) {
                        if ( totalHours !== 0 && totalMinutes !== 0 ) {

                          var timeLeft    = totalDays+"d "+totalHours+"h & "+totalMinutes+"m left...";

                        } else if ( totalHours === 0 ) {

                          var timeLeft    = totalDays+"d & "+totalMinutes+"m left...";

                        } else if ( totalMinutes === 0 ) {

                          var timeLeft    = totalDays+"d "+totalHours+"h left...";

                        }

                      } else if ( totalHours !== 0 ) {

                        if ( totalMinutes === 0 ) {

                          var timeLeft    = totalHours+"hours left...";

                        } else {

                          var timeLeft    = totalHours+"h & "+totalMinutes+"m left...";

                        }

                      } else if ( totalMinutes !== 0 ){

                        if ( totalSeconds === 0 ) {

                          var timeLeft    = totalMinutes+"min left...";

                        } else {

                          var timeLeft    = totalMinutes+"m & "+totalSeconds+"s left...";

                        }

                      } else {

                        var timeLeft      = totalSeconds+"sec left...";

                      }

                  metrics.cleaningTime    = timeLeft;

                  GET_stats( req.query.id, function( follows, followed_by, error ){
                    metrics.actualFollowedBy = followed_by;
                    metrics.actualFollowing = follows;

                    metrics.followingFromFanCrawlPercentage = metrics.followingFromFanCrawl / ( metrics.actualFollowedBy - metrics.followedBy ) * 100;

                    metrics.followingFromFanCrawlResult = metrics.followingFromFanCrawl + " (" + Math.floor( metrics.followingFromFanCrawlPercentage ) + "%)";

                    metrics.actualFollowedByPercentage = Math.floor( ( ( metrics.actualFollowedBy / metrics.followedBy ) * 100 ) - 100);
                    metrics.actualFollowingPercentage = Math.floor( ( ( metrics.actualFollowing / metrics.following ) * 100 ) - 100);

                    if ( metrics.actualFollowedByPercentage >= 0 ) {

                      metrics.afbpClass   = 'up_by';

                    } else {

                      metrics.afbpClass   = 'down_by';

                    }

                    if ( metrics.actualFollowingPercentage >= 0 ) {

                      metrics.afpClass    = 'up_ing';

                    } else {

                      metrics.afpClass    = 'down_ing';

                    }

                    lastWeek( req.query.id , function( result ) {

                      var data            = [];

                      if ( metrics.actualFollowedBy !== "N/A" ){

                        data.push( metrics.actualFollowedBy );

                        for ( var i = 1; i < result.length; i++ ) {

                          var temp        = data[0] - result[i];
                          var newTemp     = [];
                              newTemp.push(temp);
                          var old         = data
                          var data        = newTemp.concat(old);

                        }

                        // data = data.splice(data.length - 7,7);
                        if ( data.length > 0 ) {

                          metrics.data    = data;

                        }

                      } else {

                        metrics.data      = [0];
                      }

                      if ( usersInfo[ req.query.id ] ) {
                        for ( keys in usersInfo[ req.query.id ]) {
                          if ( !metrics[ keys ] ){
                            metrics.errorLogs[ keys ] = usersInfo[ req.query.id ][ keys ];
                          }
                        }
                      }

                      connection.query('SELECT mNoti FROM settings', function(err, rows, fields) {
                        if (err) throw err;
                        metrics.mNoti = rows[0].mNoti;

                        res.render('./partials/dashboard.ejs',  metrics );

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

//  -----------------------------------------------------------------------------
//  ZERO = load list of users from FanCrawl
//  -----------------------------------------------------------------------------
    // FROM |
    //      -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
    //  TO  |
//  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  exports.users                           = function ( req, res ) {

      console.log( "exports.users" );

      var metrics                         = {
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


      if ( JSON.stringify( req.query ).length !== 2 && req.query.user !== undefined && req.query.id !== undefined) {

        // check access rights from database.
        connection.query('SELECT fancrawl_full_name, fancrawl_username, fancrawl_instagram_id, fancrawl_profile_picture FROM access_right where fancrawl_instagram_id = '+ req.query.id, function(err, rows, fields) {
          if (err) throw err;

          if ( rows[0] === undefined || rows[0].fancrawl_username === undefined || rows[0].fancrawl_username !== req.query.user ){

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

//  -----------------------------------------------------------------------------
//  ZERO = trigger FanCrawl
//  -----------------------------------------------------------------------------
    // FROM |
    //      -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
    //  TO  | STOP - timer_post - timer_quick - GET_relationship - fetchFromHashInitializer - fetchNewFollowers - cleanDatabase
//  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  exports.trigger                         = function ( req, res ) {

      console.log( "exports.trigger" );

      var original_url                    = req.headers.referer,
          url_split                       = original_url.split("?"),
          req_query                       = JSON.parse('{"' + decodeURI(url_split[1].replace(/&/g, "\",\"").replace(/=/g,"\":\"")) + '"}'); // req_query = { user: 'ig_user_name', id: 'ig_id_number' };

      var fancrawl_instagram_id           = req_query.id;

      console.log(req.body);

      // UPDATING HASH
      if ( req.body.hash_tag && req.body.hash_tag !== '' ) {
        // handles inserted # character by removing it
        if ( req.body.hash_tag[0] && req.body.hash_tag[0] === "#" ){
          req.body.hash_tag = req.body.hash_tag.slice(1).split(" ")[0];
        }

        connection.query('UPDATE access_right set hash_tag = "' + req.body.hash_tag + '" where fancrawl_instagram_id = "' + fancrawl_instagram_id + '"', function( err, rows, fields ) {
          if (err) throw err;
        });

      } else {

        connection.query('UPDATE access_right set hash_tag = "" where fancrawl_instagram_id = "' + fancrawl_instagram_id + '"', function( err, rows, fields ) {
          if (err) throw err;
        });

      }

      // UPDATING HASH SWITCH
      if ( req.body.switchHash ) {
        connection.query('UPDATE access_right set sHash = 1 where fancrawl_instagram_id = "'+ fancrawl_instagram_id +'"', function( err, rows, fields ) {
          if (err) throw err;
        });

      } else {
        connection.query('UPDATE access_right set sHash = 0 where fancrawl_instagram_id = "'+ fancrawl_instagram_id +'"', function( err, rows, fields ) {
          if (err) throw err;
        });

      }

      // UPDATING MASTER EMAIL NOTIFICATIONS
      if ( ( req.body.admin === true || req.body.admin === "true" ) && req.body.switchMasterNotification ) {
        connection.query('UPDATE settings set mNoti = 1', function( err, rows, fields ) {
          if (err) throw err;
        });

      } else if ( req.body.admin === true || req.body.admin === "true" ) {
        connection.query('UPDATE settings set mNoti = 0', function( err, rows, fields ) {
          if (err) throw err;
        });

      }

      // UPDATING EMAIL
      if ( req.body.email ) {
        connection.query('UPDATE access_right set email = "'+ req.body.email +'" WHERE fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
          if (err) throw err;
        })

      } else {
        connection.query('UPDATE access_right set email = "" WHERE fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
          if (err) throw err;
        })

      }

      // UPDATING EMAIL SWITCH
      if ( req.body.switchMail ) {
        connection.query('UPDATE access_right set eNoti = 1 WHERE fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
          if (err) throw err;
        })

      } else {
        connection.query('UPDATE access_right set eNoti = 0 WHERE fancrawl_instagram_id = "'+fancrawl_instagram_id+'"', function(err, rows, fields) {
          if (err) throw err;
        })

      }

      // STARTING FANCRAWL
      // dashboard sent a switchFancrawl on so start FanCrawl
      // console.log( timer[ fancrawl_instagram_id ] );
      if ( req.body.switchFancrawl && req.body.switchFancrawl === "on" && req.body.status !== "statusStarted" ) {
        console.log( "// SWITCH CRAWL detected: ", fancrawl_instagram_id );
        // START USER SPECIFIC CLOCK
        timerPostStructure( fancrawl_instagram_id );
        timerQuickStructure( fancrawl_instagram_id );

        // START CLOCK TRACKERS
        if ( !setTimeouts[ fancrawl_instagram_id ] ) {
          setTimeouts[ fancrawl_instagram_id ] = {};
        }

        GET_relationship( fancrawl_instagram_id, 571377691, "", function( blank_slot, e_fancrawl_instagram_id, new_instagram_following_id, response ){

          var fancrawl_instagram_id = e_fancrawl_instagram_id;

          if ( response === "error" || response === "access_token" || response === "oauth_limit" ) {

            if ( !usersInfo[ fancrawl_instagram_id ].access_token ) {
              STOP( fancrawl_instagram_id, true );
            }

            if ( !usersInfo[ fancrawl_instagram_id ] ) {
              usersInfo[ fancrawl_instagram_id ] = {};
            }

            usersInfo[ fancrawl_instagram_id ].access_token = "FanCrawl blocked from IG - Go to your IG app to unblock.";

            connection.query('UPDATE access_right SET state = "stopped" WHERE fancrawl_instagram_id = "'+ fancrawl_instagram_id +'"; SELECT "'+ req_query.user +'" AS user, "'+ fancrawl_instagram_id +'" AS fancrawl_instagram_id', function( err, results ) {
              if (err) throw err;

              res.redirect("/dashboard?user="+ results[1].user +"&id="+ results[1].fancrawl_instagram_id );

            });

          } else {

            connection.query('UPDATE access_right SET state = "started" WHERE fancrawl_instagram_id = "'+ fancrawl_instagram_id +'"; SELECT "'+ req_query.user +'" AS user, "'+ fancrawl_instagram_id +'" AS fancrawl_instagram_id', function( err, results ) {

              if (err) throw err;

              res.redirect("/dashboard?user="+ results[1].user +"&id="+ results[1].fancrawl_instagram_id);

              // START CLOCKS
              timer_post( results[1].fancrawl_instagram_id );
              timer_quick( results[1].fancrawl_instagram_id );

              connection.query('SELECT fancrawl_instagram_id, sHash FROM access_right WHERE fancrawl_instagram_id = "'+ results[1].fancrawl_instagram_id +'"', function(err, rows, fields) {
                if (err) throw err;

                // start fetching process from hash users
                if ( rows && rows[0] && rows[0].sHash ) {

                  // fetch new user from hash
                  fetchFromHashInitializer( rows[0].fancrawl_instagram_id );

                  // goes very current database
                  connection.query('SELECT fancrawl_instagram_id, added_follower_instagram_id FROM beta_followers WHERE fancrawl_instagram_id = "'+ rows[0].fancrawl_instagram_id +'" AND count not in (5)', function(err, rows, fields) {

                    if (err) throw err;

                    setTimeouts[ rows[0].fancrawl_instagram_id ].databaseData = {};

                    for ( var i = 0; i < rows.length; i++ ) {
                      setTimeouts[ rows[0].fancrawl_instagram_id ].databaseData[ processCounter ] = { 'added_follower_instagram_id' : rows[i].added_follower_instagram_id };
                      processCounter++;
                    }

                  });

                // start fetching process for new one
                } else {

                  // fetch from start
                  fetchNewFollowersInitializer( rows[0].fancrawl_instagram_id );

                  // goes very current database
                  connection.query('SELECT fancrawl_instagram_id, added_follower_instagram_id FROM beta_followers WHERE fancrawl_instagram_id = "'+ rows[0].fancrawl_instagram_id +'" AND count not in (5)', function(err, rows, fields) {
                    if (err) throw err;

                    if ( rows && rows[0] ) {
                      setTimeouts[ rows[0].fancrawl_instagram_id ].databaseData = rows;
                    }

                  });
                }
              });

            });

          }
        });

      // CLEANING FANCRAWL
      // dashboard sent a switchClean on so clean database
      } else if ( req.body.switchclean && req.body.switchclean === "on" && req.body.status !== "statusCleaning") {
        console.log( "// SWITCH CLEAN detected: ", fancrawl_instagram_id );

        STOP( fancrawl_instagram_id );

        GET_relationship( fancrawl_instagram_id, 571377691, "", function( blank_slot, f_fancrawl_instagram_id, new_instagram_following_id, response ){

          var fancrawl_instagram_id = f_fancrawl_instagram_id;

          if ( response === "error" || response === "access_token" || response === "oauth_limit" ) {
            // do nothing

            if ( !usersInfo[ fancrawl_instagram_id ] ) {
              usersInfo[ fancrawl_instagram_id ] = {};
            }

            if ( !usersInfo[ fancrawl_instagram_id ].access_token ) {
              STOP( fancrawl_instagram_id, true );
            }

            usersInfo[ fancrawl_instagram_id ].access_token = "FanCrawl blocked from IG - Go to your IG app to unblock.";

            connection.query('UPDATE access_right set state = "stopped" where fancrawl_instagram_id = "'+fancrawl_instagram_id+'"; SELECT "'+ req_query.user +'" AS user, "'+ fancrawl_instagram_id +'" AS fancrawl_instagram_id', function( err, results ) {
              if (err) throw err;

              res.redirect( "/dashboard?user="+ results[1].user +"&id="+ results[1].fancrawl_instagram_id );

            });

          } else {

            // START USER SPECIFIC CLOCK
            timerPostStructure( fancrawl_instagram_id );
            timerQuickStructure( fancrawl_instagram_id );

            connection.query('UPDATE access_right set state = "cleaning" where fancrawl_instagram_id = "'+fancrawl_instagram_id+'"; SELECT "'+ req_query.user +'" AS user, "'+ fancrawl_instagram_id +'" AS fancrawl_instagram_id', function( err, results ) {
              if (err) throw err;

              res.redirect( "/dashboard?user="+ results[1].user +"&id="+ results[1].fancrawl_instagram_id );

              // START CLOCKS
              timer_post( results[1].fancrawl_instagram_id );
              timer_quick( results[1].fancrawl_instagram_id );

              // cleaning database process
              cleanDatabase( results[1].fancrawl_instagram_id, function( fancrawl_instagram_id ){
                //done cleaning so set to stopped
                STOP( results[1].fancrawl_instagram_id );
                console.log("FINISHED CLEANING UP DATABASE FROM TRIGGER FOR USER: ", results[1].fancrawl_instagram_id );
                sendMail( results[1].fancrawl_instagram_id, "Finished cleaning up", "FanCrawl, finished cleaning up your previous saved followers. If you still see a high number of followers compared to before, do not be alarmed, wait 48 hours and run a cleaning again." );
              });
            });
          }
        });

      // STOPPING FANCRAWL
      } else if ( !req.body.switchFancrawl && !req.body.switchclean && req.body.status !== "statusStopped") {
        console.log( "// SWITCH OFF detected: ", fancrawl_instagram_id );

        STOP( fancrawl_instagram_id );

        res.redirect( "/dashboard?user="+ req_query.user +"&id="+ fancrawl_instagram_id );

      } else {
        res.redirect( "/dashboard?user="+ req_query.user +"&id="+fancrawl_instagram_id );
      }
    };



//  =============================================================================
//  OTHERS
//  =============================================================================

//  -----------------------------------------------------------------------------
//  alerts admin that the server was restarted
//  -----------------------------------------------------------------------------
    // FROM |
    //      -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -
    //  TO  |
//  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
  // sendMail ( 571377691, 'server was restarted', 'Rebooted' );
