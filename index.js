const express = require('express');
const path = require('path');
const PORT = process.env.PORT || 5000;
const fileUpload = require('express-fileupload');
const openDB = require('json-file-db');
const jsonfile = require('jsonfile');
const request = require('./request/request')
const requestOptions = {
    host: 'lyceum.by',
    port: 80,
    path: '/files/list-export.json',
    method: 'GET',
    headers: {
        'Content-Type': 'application/json'
    }
};

const corpsesRouter = express.Router(); 

const DB_FILE = './db/json.json';
let db = {};
let generateStatus = false;

request.getJSON(requestOptions, function(statusCode, result) {
  //  console.log("onResult: (" + statusCode + ")" + JSON.stringify(result));
   // res.statusCode = statusCode;
   // res.send(result);
   readDbFromDisk(result);
});



corpsesRouter.route('/')
    .get(function (req, res) {
        sendResp(res, db.corpsesG);
    })
corpsesRouter.route('/:id')
    .get(function (req, res) {
        const id = req.params.id;
        const length = db.corpsesG.length;
        let i = 0;

        for (i; i < db.corpsesG.length; i++) {
            if (db.corpsesG[i].alias === id) {
                sendResp(res, db.corpsesG[i])
                return;
            }
        }
        sendResp(res, {error: 'nothing found'});
    })

express()
    .use(express.static(path.join(__dirname, 'public')))
    .use(fileUpload())
    .use('/api/corpses', corpsesRouter)
    .set('views', path.join(__dirname, 'views'))
    .set('view engine', 'ejs')
    .post('/upload', onFileUpload)
    .get('/api/dictionary', getDicionary)
    .get('/api/generate', generate)
    .get('/api/generateStatus', function (req, res) {
        sendResp(res, generateStatus)
    })
    .get('/api/search', function (req, res) {
        const search = req.query.search;
        let data = [];
        
        if (search.length > 0) {
            data = db.pupilsG
                        .filter(function(pupil){
                            return pupil.firstName.indexOf(search) > -1;
                        })
                        .map(function(pupil){
                            pupil.profile = 'df';
                            return pupil;     
                        });
        }
        sendResp(res, data);
    })
    .get('/api/pupils', function (req, res) {
        const query = req.query;
        const corpsQuery = query.corps;
        const placeQuery = query.place;
        
        let corps = {}
       

        let responsePupils = JSON.parse(JSON.stringify(db.pupilsG));

        if (corpsQuery && corpsQuery.length) {
            responsePupils = responsePupils.filter(function(pupil){
                return pupil.corps === corpsQuery;
            });
        }

        if (placeQuery && placeQuery.length) {
            responsePupils = responsePupils.filter(function(pupil){
                return pupil.place === placeQuery;
            });
        }
        
        sendResp(res, responsePupils);
    })
    .get('/api/profiles', function (req, res) {
        sendResp(res, db.profiles);
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

function getDicionary (req, res) {
    let data = {
        corpses: {},
        places: {},
        audiences: {},
        profiles: {}
    }

    for (let i = 0; i < db.corpses.length; i++) {
        data.corpses[db.corpses[i].alias] = db.corpses[i].name;

        for (let j = 0; j < db.corpses[i].places.length; j++) {
            data.places[db.corpses[i].places[j]._id] = {
                code: db.corpses[i].places[j].code,
                name: db.corpses[i].places[j].name
            }

            for (let k = 0; k < db.corpses[i].places[j].audience.length; k++) {
                data.audiences[db.corpses[i].places[j].audience[k]._id] = db.corpses[i].places[j].audience[k].name;
            }
        }
    }

    for (i = 0; i < db.profiles.length; i++) {
      data.profiles[db.profiles[i]._id] = db.profiles[i].name;
    }

    sendResp(res, data)
}

function generate (req, res) {
    const profilesMap = createProfilesMap(db.profiles);
    const corpses = JSON.parse(JSON.stringify(db.corpses));

    let responsePupils = [];
    let response = {};
    
    let i = 0, corps;
    let seededPupils;
    let corpsesLength = corpses.length;
    
    for (i; i < corpsesLength; i++) {
        seededPupils = seedPupilsInCorpse(corpses[i], profilesMap);
        responsePupils = responsePupils.concat(seededPupils);
    }

    response = {
        corpses: corpses
    };

    //TODO remove with save

    db.pupilsG = JSON.parse(JSON.stringify(responsePupils))
    db.corpsesG = JSON.parse(JSON.stringify(corpses))

    generateStatus = true;
    sendResp(res, response)

}

function seedPupilsInCorpse(corps, profilesMap) {
    const placesLength = corps.places.length;
    let responsePupils = [];
    let seededPupils;
    let i = 0, place, profileId;

    for (i; i < placesLength; i++) {
        place = corps.places[i]
        profileId = profilesMap[place._id]._id;
        seededPupils = seedPupilsInPlace(place, profileId, corps);
        responsePupils = responsePupils.concat(seededPupils);
    }

    return responsePupils;
}

function seedPupilsInPlace(place, profileId, corps) {
    let profiledPupils;
    let i = 0, profiledPupilsLength;

    profiledPupils = getProfiledPupils(profileId);
    
    profiledPupilsLength = profiledPupils.length;

    generatePupilPicks(profiledPupilsLength, place, corps);

    seedPupilsInAudiences(profiledPupils, {
        audiences: place.audience,
        placeId: place._id, 
        corpsId: corps.alias
    });

    return profiledPupils;
}

function getProfiledPupils (profileId) {
    let pupils = JSON.parse(JSON.stringify(db.pupils))
        .filter(function(pupil){
            return pupil.profile === profileId;
        });   
    return  pupils;
}

function seedPupilsInAudiences(pupils, options) {
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

function generatePupilPicks(profiledPupilsLength, place, corps) {
    let numbersArr = [];
    let audiences = place.audience;
    
    let i = 0, picksArray;
    const audiencesLength = audiences.length;

    if (!corps.count) {
        corps.count = 0;
    }
    if (!place.count) {
        place.count = 0;
    }
    if (!corps.max) {
        corps.max = 0;
    }
    if (!place.max) {
        place.max = 0;
    }
    

    for (i; i < profiledPupilsLength; i++ ) { 
        numbersArr.push(i);
    }

    for (i = 0; i < audiencesLength; i++) {
        picksArray = generatePicksForAudience(audiences[i].max);
        audiences[i].count = picksArray.length;
        audiences[i].picks = picksArray;
        place.count = place.count + picksArray.length;  
        place.max = place.max + audiences[i].max;        
    }
    corps.count = corps.count + place.count;
    corps.max = corps.max + place.max;

    function generatePicksForAudience(audienceMax) {
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

    uploadedFile.mv(DB_FILE, function(err) {
        if (err) {
            return res.status(500).send(err);
        } else {
        //    readDbFromDisk();

            res.redirect('/');
        }
    });
}

function readDbFromDisk(obj) {
    /*jsonfile.readFile(DB_FILE, function(err, obj) {
        db = {
            places: obj.places || [],
            profiles: obj.profiles || [],
            pupils: obj.pupils || [],
            corpses: createCorpses(obj.places || [])
        };
    });*/

    if (obj) {
        db = {
            places: obj.places || [],
            profiles: obj.profiles || [],
            pupils: obj.pupils || [],
            pupilsG: [],
            corpses: createCorpses(obj.places || []),
            corpsesG: createCorpses(obj.places || [])
        }
    }
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