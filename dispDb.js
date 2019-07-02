#!/usr/bin/env node
var level = require('level'),path = require('path'),
    dbPath = process.env.DB_PATH || path.join(__dirname, 'mydb1'),
    db = level(dbPath);
/*
node dispDb.js |sed -E 's/.*\/\///g'|sed -E 's/\/.*$//g'>/Users/0x101/mytools/hktools_MTX/tools/py/xxx2.txt
*/
db.createReadStream()
  .on('data', function (data) {
    console.log(data.key)
  })
  .on('error', function (err) {
    // console.log('Oh my!', err)
  })
  .on('close', function () {
    // console.log('Stream closed')
  })
  .on('end', function () {
    // console.log('Stream ended')
  })