const express = require('express');
const path = require('path');
const PORT = process.env.PORT || 5000;
const fileUpload = require('express-fileupload');
const openDB = require('json-file-db');
const jsonfile = require('jsonfile');

const dbfile = './db/json.json';
let db = {};

jsonfile.readFile(dbfile, function(err, obj) {
    db = {
        places: obj.places || [],
        profiles: obj.profiles || [],
        pupils: obj.pupils || [],
        corpses: createCorpses(obj.places || [])
    };
});


express()
    .use(express.static(path.join(__dirname, 'public')))
    .use(fileUpload())
    .set('views', path.join(__dirname, 'views'))
    .set('view engine', 'ejs')
    .post('/upload', onFileUpload)
    .get('/api/generate', generate)
    .get('/api/search', function (req, res) {
        const search = req.query.search;
        let data = [];
        
        if (search.length > 0) {
            data = db.pupils
                        .filter(function(pupil){
                            return pupil.firstName.indexOf(search) > -1;
                        })
                        .map(function(pupil){
                            pupil.profile = 'df';
                            return pupil;     
                        });
        }
        sendResp(res, []);
    })
    .get('/api/pupils', function (req, res) {
        const query = req.query;
        const corpsQuery = req.query.corps;
        let corps = {}
        let placesQuery = [];

        if (corpsQuery.length) {
            corps = db.corpses.find(function(element) {
                return element.alias === corpsQuery;
            })
            for(let i = 0; i < corps.places.length; i++) {
                console.log('@@',corps.places[i]._id )
                placesQuery.push(corps.places[i]._id)
            }

           // db.pupils.filter(function)
        }

        console.log(corps, placesQuery)
        
        sendResp(res, db.pupils);
    })
    .get('/api/profiles', function (req, res) {
        sendResp(res, db.profiles);
    })
    .get('/api/corpses', function (req, res) {
        sendResp(res, db.corpses);
    })
    .get('/api/places', function (req, res) {
        sendResp(res, db.places);
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

function generate (req, res) {
    const profilesMap = createProfilesMap(db.profiles);
    const corpses = db.corpses;
    const pupils = db.pupils;

    let response = [];
    let seededPupils;

    let i = 0, corps, j, place, placesLength;
    let corpsesLength = corpses.length;
    let profileId;
    
    console.log(profilesMap)
    
    for (i; i < corpsesLength; i++) {
        corps = corpses[i];
        placesLength = corps.places.length;

        for (j = 0; j < placesLength; j++) {
            place = corps.places[j];
            profileId = profilesMap[place._id]._id;

            seededPupils = seedPupils(place, profileId, corps.alias);
            response = response.concat(seededPupils);
            console.log(profileId, place.name)
        }
    }


    sendResp(res, response)

}

function seedPupils(place, profileId, corpsAlias) {
    let profiledPupils;
    let i = 0, profiledPupilsLength;

    profiledPupils = getProfiledPupils(profileId);
    
    profiledPupilsLength = profiledPupils.length;

    generatePupilPicks(profiledPupilsLength, place.audience);

    seedPupilsInPlace(profiledPupils, {
        audiences: place.audience,
        placeId: place._id, 
        corpsId: corpsAlias
    });

    return profiledPupils;
}

function getProfiledPupils (profileId) {
    return db.pupils
        .filter(function(pupil){
            return pupil.profile === profileId;
        });    
}

function seedPupilsInPlace(pupils, options) {
    const audiences = options.audiences;
    const audiencesLength = audiences.length;
    let i = 0;

    for(i; i < audiencesLength; i++) {
        seedPupilsInAudience(pupils, {
            audience: audiences[i],
            placeId: options.placeId,
            corpsId: options.corpsId,
        });
           
    }
}

function seedPupilsInAudience(pupils, options) {
    const audienceId = options.audience._id;
    const placeId = options.placeId;
    const corpsId = options.corpsId;
    const picks = options.audience.picks;
    const picksLength = picks.length;
    let i = 0, pick;

    for(i; i < picksLength; i++) {
        pick = picks[i];
        pupils[pick].audience = audienceId;
        pupils[pick].place = placeId;
        pupils[pick].corps = corpsId;
    } 
}

function generatePupilPicks(profiledPupilsLength, audiences) {
    let numbersArr = [];
    let i = 0, picksArray;
    const audiencesLength = audiences.length;

    for (i; i < profiledPupilsLength; i++ ) { 
        numbersArr.push(i);
    }

    for (i = 0; i < audiencesLength; i++) {
        picksArray = generatePicksForaudience(audiences[i].max);

        audiences[i].count = picksArray.length;
        audiences[i].picks = picksArray;
    }

    function generatePicksForaudience(audienceMax) {
        let picksArray = [];
        let randomIndex;

        while (picksArray.length < audienceMax){
            randomIndex = Math.floor(Math.random() * numbersArr.length);
            picksArray.push(numbersArr[randomIndex]);
            numbersArr.splice(randomIndex, 1);
        }

        return picksArray.filter(notEmptyPick);
    }

    function notEmptyPick(pick) {
        return pick >= 0;
    }
}


function createProfilesMap(profiles) {
    const map = {};
    let i = 0;
    let length = profiles.length;
    let profile;

    for (i; i < length; i++) {
        profile = profiles[i];

        map[profile.examPlace] = profile;
    }

    return map;
}

function onFileUpload(req, res) {
    if (!req.files) {
        return res.status(400).send('No files were uploaded.');
    }


    var uploadedFile = req.files.dbFile;

    // Use the mv() method to place the file somewhere on your server
    uploadedFile.mv(dbfile, function(err) {
        if (err) {
            return res.status(500).send(err);
        } else {
            jsonfile.readFile(dbfile, function(err, obj) {

               // jsonfile.writeFileSync('db/pupils.json', obj.pupils);
              //  jsonfile.writeFileSync('db/profiles.json', obj.profiles);
              //  jsonfile.writeFileSync('db/places.json', obj.places);
              //  jsonfile.writeFileSync('db/corpses.json', corpses);

                db = {
                    places: obj.places,
                    profiles: obj.profiles,
                    pupils: obj.pupils,
                    corpses: createCorpses(obj.places)
                };
            });


            res.redirect('/');
        }
    });
}

function createCorpses (places) {
    let corpsesMap = {};
    let corpses = [];
    let corps;
    let i = 0;
    let length = places.length;

    for (i; i < length; i++) {
        corps = places[i];
        if (corpsesMap[corps.name]) {
            corpsesMap[corps.name].places.push(corps)
        } else {
            corpsesMap[corps.name] = {
                name: corps.name,
                alias: toUTF8Array(corps.name),
                places: [corps]
            }
        }
    }
    for (corps in corpsesMap) {
        if (corpsesMap.hasOwnProperty(corps)) {
            corpses.push(corpsesMap[corps]);
        }
    }



    return Array.from(corpses);
}

function toUTF8Array(str) {
    var utf8 = [];
    for (var i=0; i < str.length; i++) {
        var charcode = str.charCodeAt(i);
        if (charcode < 0x80) utf8.push(charcode);
        else if (charcode < 0x800) {
            utf8.push(0xc0 | (charcode >> 6), 
                      0x80 | (charcode & 0x3f));
        }
        else if (charcode < 0xd800 || charcode >= 0xe000) {
            utf8.push(0xe0 | (charcode >> 12), 
                      0x80 | ((charcode>>6) & 0x3f), 
                      0x80 | (charcode & 0x3f));
        }
        // surrogate pair
        else {
            i++;
            // UTF-16 encodes 0x10000-0x10FFFF by
            // subtracting 0x10000 and splitting the
            // 20 bits of 0x0-0xFFFFF into two halves
            charcode = 0x10000 + (((charcode & 0x3ff)<<10)
                      | (str.charCodeAt(i) & 0x3ff))
            utf8.push(0xf0 | (charcode >>18), 
                      0x80 | ((charcode>>12) & 0x3f), 
                      0x80 | ((charcode>>6) & 0x3f), 
                      0x80 | (charcode & 0x3f));
        }
    }
    return utf8.join('');
}