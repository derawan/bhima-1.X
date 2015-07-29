
var db = require('../lib/db');

// GET accounts/
exports.getAll = function (req, res, next) {
  'use strict';

  var sql =
    'SELECT a.id, a.account_number, a.account_text, a.parent, at.type ' +
    'FROM account AS a JOIN account_type AS at ON ' +
      'a.account_type_id = at.id;';

  db.exec(sql)
  .then(function (rows) {
    res.status(200).json(rows);
  })
  .catch(next)
  .done();
};

// GET account/:id
// FIXME/TODO
exports.getId = function (req, res, next) {
  'use strict';
  
  var sql, id = req.param.id;

  sql =
    'SELECT a.id, a.account_number, a.account_text, a.parent, at.type ' +
    'FROM account AS a JOIN account_type AS at ON ' +
      'a.account_type_id = at.id ' +
    'WHERE a.id = ?;';
  
  db.exec(sql, [id])
  .then(function (rows) {
    res.status(200).json(rows);
  })
  .catch(next)
  .done();
};

