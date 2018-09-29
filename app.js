var path = require('path'),
    express = require('express'),
    exphbs  = require('express-handlebars'),
    bodyParser = require('body-parser'),
    pubSubHubbub = require('pubsubhubbub'),
    sassMiddleware = require('node-sass-middleware'),
    babelify = require('express-babelify-middleware'),    
    helpers = require(__dirname + '/helpers/general.js'),
    db = require(__dirname + '/helpers/db.js'),
    app = express();

app.use(express.static('public'));

app.use(bodyParser.json({
  type: 'application/activity+json'
}));

app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(sassMiddleware({
  // src: __dirname,
  src: __dirname + '/src/styles',
  dest: path.join(__dirname, 'public'),
  force: true,
  // debug: true,  
  outputStyle: 'compressed',
  response: true
}));

app.use('/js/scripts.js', babelify('src/scripts/scripts.js', {
  minify: true
}));

app.engine('handlebars', exphbs({
  defaultLayout: 'main',
  helpers: {
    for: require('./handlebar-helpers/for'),
    equals: require('./handlebar-helpers/equals')
  }  
}));

app.set('views', __dirname + '/views');
app.set('view engine', 'handlebars');

app.use('/', require('./routes/index.js'))
app.use('/bot', require('./routes/bot.js'));
app.use('/feed', require('./routes/feed.js'));
app.use('/inbox', require('./routes/inbox.js'));
app.use('/outbox', require('./routes/outbox.js'));
app.use('/post', require('./routes/post.js'));
app.use('/pubsub', require('./routes/pubsub.js'));
app.use('/salmon', require('./routes/salmon.js'));
app.use('/webhook', require('./routes/webhook.js'));
app.use('/.well-known', require('./routes/well-known.js'));

app.use(`/${process.env.BOT_ENDPOINT}`, require('./routes/bot-endpoint.js'));

app.get('/js/helpers.js', function (req, res) {
  res.sendFile(path.join(__dirname + '/helpers/general.js'));
});

module.exports = app;
