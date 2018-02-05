var express = require('express');
let expressOasGenerator = require('./index.js');

var router = express.Router();
router.get('/', function (req, res, next) {
  res.status(200)
     .json({'status': 200, 'response': {'message': 'Test string'}});
})

var apiRouter = express.Router();
apiRouter.get('/', router);

var app = express();
app.use('/', router);
app.use('/api/v1', apiRouter);
expressOasGenerator.init(app, {});
app.set('port', 8000);
app.listen(app.get('port'));
