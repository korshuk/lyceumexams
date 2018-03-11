const express = require('express');
const path = require('path');
const PORT = process.env.PORT || 5000;
const fileUpload = require('express-fileupload');
const openDB = require('json-file-db');
const jsonfile = require('jsonfile');

var db = {
    places: openDB('db/places.json'),
    profiles: openDB('db/profiles.json'),
    pupils: openDB('db/pupils.json')
};

express()
    .use(express.static(path.join(__dirname, 'public')))
    .use(fileUpload())
    .set('views', path.join(__dirname, 'views'))
    .set('view engine', 'ejs')
    .post('/upload', onFileUpload)
    .get('/api/pupils/list', function (req, res) {
        db.pupils.get(function(err, data){
            sendResp(res, data);
        });
    })
    .get('/api/profiles/list', function (req, res) {
        db.profiles.get(function(err, data){
            sendResp(res, data);
        });
    })
    .get('/api/places/list', function (req, res) {
        db.places.get(function(err, data){
            sendResp(res, data);
        });
    })
    .get('/', function (req, res) {
        res.render('pages/index')
    })
    .listen(PORT, function() {
        console.log(`Listening on ${ PORT }`)
    });

function sendResp(res, data) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.json(data);
}

function onFileUpload(req, res) {
    if (!req.files) {
        return res.status(400).send('No files were uploaded.');
    }


    var dbFile = req.files.dbFile;

    // Use the mv() method to place the file somewhere on your server
    dbFile.mv('db/json.json', function(err) {
        if (err) {
            return res.status(500).send(err);
        } else {

            var dbfile = 'db/json.json';

            jsonfile.readFile(dbfile, function(err, obj) {
                jsonfile.writeFileSync('db/pupils.json', obj.pupils);
                jsonfile.writeFileSync('db/profiles.json', obj.profiles);
                jsonfile.writeFileSync('db/places.json', obj.places);

                db = {
                    places: openDB('db/places.json'),
                    profiles: openDB('db/profiles.json'),
                    pupils: openDB('db/pupils.json')
                };
            });


            res.redirect('/');
        }
    });
}