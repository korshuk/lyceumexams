const express = require('express');
const aws = require('aws-sdk');
const bodyParser = require('body-parser');
const path = require('path');
const PORT = process.env.PORT || 5000;
const fileUpload = require('express-fileupload');
const openDB = require('json-file-db');
const jsonfile = require('jsonfile');

const corpsesRouter = express.Router(); 
const uploadRouter = express.Router(); 
const pupilsRouter = express.Router(); 

const s3 = new aws.S3();
aws.config.region = 'eu-west-2';
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;

const DB_DIRECTORY = './db/';
const CLEAN_FILE_NAME = 'clean-data.json';
const DB_FILE_NAME = 'db.json';
const DB_FILE = './db/json.json';
let db = {
    places: [],
    profiles: [],
    pupils: [],
    corpses: [],
    pupilsG: [],
    corpsesG: [],
    pupilsS: [],
    corpsesS: []
};

let generateStatus = false;
let ClenDataFlag = false;

loadCleanData();

function loadCleanData() {
    const s3CleanDataParams = {
        Bucket: S3_BUCKET_NAME,
        Key: CLEAN_FILE_NAME
    };

    const s3DBDataParams = {
        Bucket: S3_BUCKET_NAME,
        Key: DB_FILE_NAME
    };

    let fileData;

    s3.getObject(s3CleanDataParams, onResponce);
    
    function onResponce(err, res) {
            if (err === null) {
                fileData = res.Body;
                s3.getObject(s3DBDataParams, onDBResponce);
            } else {
                ClenDataFlag = false
            }
    }

    function onDBResponce (err, res) {
        if (err === null) {
            fileData = res.Body;
        } else {

        }
        setCleanData(fileData)
    }
}

function setCleanData(data) {
    var json = JSON.parse(data.toString());
    readDbFromDisk(json)
}

pupilsRouter.route('/')
    .get(function (req, res) {
        let responsePupils = getFilteredPupils(req, 'generated');
        sendResp(res, responsePupils);
    }) 
pupilsRouter.route('/saved')
    .get(function (req, res) {
        let responsePupils = getFilteredPupils(req, 'saved');
        sendResp(res, responsePupils);
    })
pupilsRouter.route('/search/:type/')
    .get(function (req, res) {
        const type = req.params.type;
        const search = req.query.search;
        let data = [];
        
        let pupilsArray = getPupilArrayByType(type);

        if (search.length > 0) {
            data = pupilsArray
                        .filter(function(pupil){
                            return pupil.firstName.indexOf(search) > -1;
                        })
                        /*.map(function(pupil){
                            pupil.profile = 'df';
                            return pupil;     
                        });*/
        }
        sendResp(res, data);
    });       


corpsesRouter.route('/')
    .get(function (req, res) {
        sendResp(res, db.corpsesG);
    });
corpsesRouter.route('/saved')
    .get(function (req, res) {
        sendResp(res, db.corpsesS);
    });       
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
    });
corpsesRouter.route('/saved/:id')
    .get(function (req, res) {
        const id = req.params.id;
        const length = db.corpsesS.length;
        let i = 0;

        for (i; i < db.corpsesS.length; i++) {
            if (db.corpsesS[i].alias === id) {
                sendResp(res, db.corpsesS[i])
                return;
            }
        }
        sendResp(res, {error: 'nothing found'});
    });    

corpsesRouter.route('/print/:id.html')
    .get(function(req, res){
        const id = req.params.id;
        const length = db.corpsesS.length;
        let i = 0;

        for (i; i < db.corpsesS.length; i++) {
            if (db.corpsesS[i].alias === id) {

                let responsePupils = JSON.parse(JSON.stringify(db.pupilsS));

                responsePupils = responsePupils
                    .filter(function(pupil){
                        return pupil.corps === id;
                    })
                    .sort(function(a,b){
                        if (a.audience < b.audience) {
                            return -1;
                        }
                        if (a.audience > b.audience) {
                            return 1;
                        }
                        return 0;
                    })

                res.render('pages/corpsPrint', {
                    pupils: responsePupils,
                    corps: db.corpsesS[i],
                    dictionary: generateDictionary()
                })
                return;
            }
        }
        res.render('pages/notFound')
    });


uploadRouter.route('/cleanData')
    .post(function (req, res) {
        if (!req.files) {
            return res.status(400).send('No files were uploaded.');
        }
    
        var uploadedFile = req.files.cleanDataFile;
    
        uploadCleanDataFileToS3(uploadedFile.data, onFileUploaded);                
          
        function onFileUploaded () {
            setCleanData(uploadedFile.data)
            res.redirect('/admin/generate.html');
        }
    });

express()
    .use(bodyParser.json())
    .use(bodyParser.urlencoded({ extended: true }))
    .use(express.static(path.join(__dirname, 'public')))
    .use(fileUpload())
    .set('views', path.join(__dirname, 'views'))
    .set('view engine', 'ejs')
    //.post('/upload', onFileUpload)
    .use('/api/corpses', corpsesRouter)
    .use('/api/pupils', pupilsRouter)
    .use('/upload', uploadRouter)
    .post('/api/changeaudience', changeAudience)
    .get('/api/dictionary', getDictionary)
    .get('/api/generate', generate)
    .get('/api/saveseats', saveseats)
    .get('/api/savecurrentseats', saveCurrentSeats)
    .get('/api/saved-seats.json', returnSavedFile)
    .get('/api/generateStatus', function (req, res) {
        sendResp(res, generateStatus)
    })
    .get('/api/profiles', function (req, res) {
        sendResp(res, db.profiles);
    })
    .get('/api/places', function (req, res) {
        sendResp(res, db.places);
    })
    .get('/admin/lists.html', function (req, res) {
        res.render('pages/lists', {
            corps: db.corpsesS,
            dictionary: generateDictionary()
        })
    })
    .get('/', function (req, res) {
        res.render('pages/index')
    })
    .listen(PORT, function() {
        console.log(`Listening on ${ PORT }`)
    });

function getPupilArrayByType(type) {
    if (type === 'generated') {
        return db.pupilsG;
    }
    if (type === 'saved') {
        return db.pupilsS
    }

}

function getFilteredPupils(req, type) {
    const query = req.query;
    const corpsQuery = query.corps;
    const placeQuery = query.place;

    let pupilsArray = getPupilArrayByType(type);

    let responsePupils = JSON.parse(JSON.stringify(pupilsArray));

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

    return responsePupils;
}

function sendResp(res, data) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.json(data);
}

function getDictionary (req, res) {
    const data = generateDictionary();

    sendResp(res, data)
}

function generateDictionary() {
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

    return data;
}

function saveCurrentSeats(req, res) {
    db.pupilsS = JSON.parse(JSON.stringify(db.pupilsG));
    db.corpsesS = JSON.parse(JSON.stringify(db.corpsesG));
    sendResp(res, db.pupilsS)
}

function saveseats(req, res) {
    db.pupilsS = JSON.parse(JSON.stringify(db.pupilsG))
    db.corpsesS = JSON.parse(JSON.stringify(db.corpsesG))
    updateDBFile();
    sendResp(res, db.pupilsS)
}

function returnSavedFile(req, res) {
    var response = {
        pupils: db.pupilsS,
        corpses: db.corpsesS
    }
    
    sendResp(res, response)
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
    updateDBFile();
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

    profiledPupils = getProfiledPupils(profileId);

    generatePupilPicks(profiledPupils, place, corps);

    seedPupilsInAudiences(profiledPupils, {
        audiences: place.audience,
        placeId: place._id, 
        corpsId: corps.alias
    });

    return profiledPupils;
}

function getProfiledPupils (profileId, belLangFlag) {
    let pupils = JSON.parse(JSON.stringify(db.pupils)).filter(filterPupilsByProfileAndLang);       
    
    return  pupils;

    function filterPupilsByProfileAndLang(pupil) {
        let profileFlag = pupil.profile === profileId;

        return  profileFlag;
    }
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

function generatePupilPicks(profiledPupils, place, corps) {
    let profiledPupilsLength = profiledPupils.length;
    let belPupilsLength = profiledPupils.filter(function(pupil){
        return pupil.needBel === true
    }).length;
    let numbersArr = [];
    let audiences = place.audience.sort(function(a, b){
        return a.max - b.max;
    });
    
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
    console.log('!!!!', belPupilsLength)
    for (i = 0; i < audiencesLength; i++) {
        picksArray = generatePicksForAudience(audiences[i]);
        audiences[i].count = picksArray.length;
        audiences[i].picks = picksArray;
        place.count = place.count + picksArray.length;  
        place.max = place.max + audiences[i].max;        
    }
    corps.count = corps.count + place.count;
    corps.max = corps.max + place.max;

    function generatePicksForAudience(audience) {
        console.log('generatePicksForAudience', audience.bel === true, numbersArr.length)
        let audienceMax = audience.max;
        let picksArray = [];
        let randomIndex;
        let belAudienceFlag = audience.bel === true;
        let belPupilFlag;

        if (numbersArr.length <= audienceMax) {
            audienceMax = numbersArr.length
        }
        if (belAudienceFlag) {
            
            if (belPupilsLength <= audienceMax) {
                audienceMax = belPupilsLength
            }
          //  console.log('@@', belPupilsLength, audienceMax)
        }

        

        while (picksArray.length < audienceMax){
            randomIndex = Math.floor(Math.random() * numbersArr.length);
            belPupilFlag = profiledPupils[numbersArr[randomIndex]].needBel === true;
            if (belPupilFlag) {
                console.log('belPupilFlag', belPupilFlag, randomIndex, numbersArr[randomIndex])
            }
            if (belAudienceFlag === false) {
                if (belPupilFlag === false) {
                    picksArray.push(numbersArr[randomIndex]);
                    numbersArr.splice(randomIndex, 1);
                }
            } else {
                if (belPupilFlag === true) {
                   picksArray.push(numbersArr[randomIndex]);
                   numbersArr.splice(randomIndex, 1);
                   belPupilsLength = belPupilsLength - 1;
               }
            }


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

function changeAudience(req, res) {
    var response;

    var pupilId = req.body.pupilId;
    var audienceId = req.body.audienceId;

    var pupil;
    var corps;
    var oldPlace;
    var oldAudience;
    var newPlace;
    var newAudience;

    for (var i = 0; i < db.pupilsG.length; i++) {
        if ( db.pupilsG[i]._id === pupilId) {
            pupil = db.pupilsG[i]
        }
    }

    for (var i = 0; i < db.corpsesG.length; i++) {
        if ( db.corpsesG[i].alias === pupil.corps) {
            corps = db.corpsesG[i]
        }
    }

    for (var i = 0; i < corps.places.length; i++) {
        if (corps.places[i]._id === pupil.place) {
            oldPlace = corps.places[i];
        }
        for (var j = 0; j < corps.places[i].audience.length; j++) {
            if (corps.places[i].audience[j]._id === audienceId) {
                newPlace = corps.places[i];
                newAudience = corps.places[i].audience[j];
            }
            if (corps.places[i].audience[j]._id === pupil.audience) {
                oldAudience = corps.places[i].audience[j];
            }
        }
    }
    oldPlace.count = oldPlace.count - 1;
    oldAudience.count = oldAudience.count - 1;
    newPlace.count = newPlace.count + 1;
    newAudience.count = newAudience.count + 1;

    pupil.place = newPlace._id;
    pupil.audience = newAudience._id;

    
    response = {
        corpses: db.corpsesG,
        pupils: getFilteredPupils(req, 'generated')
    };

    updateDBFile();

    sendResp(res, response)
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

function createCorpses (places) {
    let corpsesMap = {};
    let corpses = [];
    let corps;
    let i = 0;
    let length = places.length;

    for (i; i < length; i++) {
        places[i].audience = places[i].audience.sort(function(a,b){
            if (a.name < b.name) {
                return -1;
              }
              if (a.name > b.name) {
                return 1;
              }
              return 0;
        })
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

function uploadCleanDataFileToS3(data, next) {
    const proprS3 = {
        Bucket: S3_BUCKET_NAME,
        Key: CLEAN_FILE_NAME,
        Body: data, 
        ContentType: "application/json"
    }

    s3.putObject(proprS3, onUploaded);

    function onUploaded(err, s3data) {
        if (next) {
            next(data);
        }
    }
}

function readDbFromDisk(obj) {
    console.log(obj.corpsesG)
    if (obj) {
        db.places = obj.places || [];
        db.profiles = obj.profiles || [];
        db.pupils = obj.pupils || [];
        db.corpses = createCorpses(obj.places || []);
        db.pupilsG=  obj.pupilsG || [];
        db.corpsesG= obj.corpsesG || createCorpses(obj.places || []);
        db.pupilsS=  obj.pupilsS || [];
        db.corpsesS= obj.corpsesS || [];

        ClenDataFlag = true;
       
        updateDBFile();
    }
}

function updateDBFile() {
    console.log(db.corpsesS)
    s3.putObject(
        {
            Bucket: S3_BUCKET_NAME,
            Key: DB_FILE_NAME,
            Body: JSON.stringify(db), 
            ContentType: "application/json",
            CacheControl: "no-cache",
            Expires: new Date()
        },
        function(err,data) {
            console.log(JSON.stringify(err)+" "+JSON.stringify(data));
        });
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