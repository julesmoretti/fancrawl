//  middleware.js

//  set up ======================================================================
var bodyParser      = require('body-parser'),
    morgan          = require('morgan');

  if( process.env.LOCAL ){
    sass            = require('node-sass');
  }

  module.exports    = function(app){

//  sass css generator ==========================================================
    if( process.env.LOCAL ){
      sass.renderFile({
        file: './views/css/style.scss',
        success: function(css) {
          // console.log(css);
          console.log('style.css overwritten');
        },
        error: function(error) {
          console.log(error);
        },
        includePaths: ['views/css'],
        // outputStyle: 'compressed',
        outFile: './views/css/style.css'
      });

      sass.renderFile({
        file: './views/css/login.scss',
        success: function(css) {
          // console.log(css);
          console.log('login.css overwritten');
        },
        error: function(error) {
          console.log(error);
        },
        includePaths: ['views/css'],
        // outputStyle: 'compressed',
        outFile: './views/css/login.css'
      });

      sass.renderFile({
        file: './views/css/dashboard.scss',
        success: function(css) {
          // console.log(css);
          console.log('dashboard.css overwritten');
        },
        error: function(error) {
          console.log(error);
        },
        includePaths: ['views/css'],
        // outputStyle: 'compressed',
        outFile: './views/css/dashboard.css'
      });

      sass.renderFile({
        file: './views/css/users.scss',
        success: function(css) {
          // console.log(css);
          console.log('users.css overwritten');
        },
        error: function(error) {
          console.log(error);
        },
        includePaths: ['views/css'],
        // outputStyle: 'compressed',
        outFile: './views/css/users.css'
      });
    }

//  loading standard middleware =================================================
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({
      extended: true
    }));

//  logger for development ======================================================
    app.use(morgan('dev')); // log every request to the console

//  html rendering engine =======================================================
    app.set('views', './views');
    app.set('view engine', 'ejs');

  };
