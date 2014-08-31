//  app/routes.js

//  =============================================================================
//  SET UP AND GLOBAL VARIABLES
//  =============================================================================

var instagramUtils = require('./instagramUtils.js');

//  =============================================================================
//  ROUTES
//  =============================================================================

  module.exports = function(app, passport) {

    // landing page to site loads default - login.ejs
    app.get('/', instagramUtils.login);

    // sends users to instagram to be authenticated
    app.get('/authorize_user', instagramUtils.authorize_user);

    // reads from instagram authentication data and records it
    app.get('/auth/instagram/callback', instagramUtils.handleauth);

    // main dashboard page
    app.get('/dashboard', instagramUtils.dashboard);

    // trigger different function like GO_Follow etc...
    // app.get('/button', instagramUtils.button);

    // goes through database and cleans user base making sure to unfollow unwanted followers
    // app.get('/clean', instagramUtils.clean);

    // loads dashboard
    // app.get('/temp', instagramUtils.temp);

    // loads dashboard
    app.post('/trigger', instagramUtils.trigger);

    // 404 not found error page
    app.get('/404/', function(req, res){
      res.render('./partials/404.ejs');
    });

    // send any unknown directory to the 404 page!
    app.get('*', function(req, res){
      res.redirect('./404/');
    });

  };
