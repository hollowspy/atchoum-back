var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require('cors');

var app = express();
var indexRouter = require('./routes/index');



const whitelist = ["http://localhost:3000", 'https://concours-atchoum.netlify.app']
const corsOptions = {
  //origin: '*',
  origin: function (origin, callback) {
     if (!origin || whitelist.indexOf(origin) !== -1) {
       callback(null, true)
     } else {
       callback(new Error("Not allowed by CORS"))
     }
   },
  credentials: true,
}
app.use(cors(corsOptions))




app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


app.use('/', indexRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.json({
    message: err.message,
    code: 'ALREADY_DONE',
    error: err
  });
});

module.exports = app;
