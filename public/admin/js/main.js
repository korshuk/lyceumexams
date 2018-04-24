(function(){
    'use strict';

    angular.module('lyceum', ['lvl.directives.dragdrop']);

    angular
        .module('lyceum')
        .factory('api', apiFactory)
        .controller('seedController', seedController);

    apiFactory.$inject = ['$http'];    

    seedController.$inject = ['api'];

    function apiFactory($http) {
        var service = {
            getCorpses: getCorpses,
            getPupils: getPupils,
            changeAudience: changeAudience,
            getDictionary: getDictionary,
            generate: generate,
            saveSeats: saveSeats,
            getGenerateStatus: getGenerateStatus
        }

        return service;

        function generate () {
            return $http.get('/api/generate')
        }

        function getGenerateStatus () {
            return $http.get('/api/generateStatus')
        }

        function saveSeats () {
            return $http.get('/api/saveseats')
        }

        function getCorpses () {
            return $http.get('/api/corpses')
        }

        function getPupils(corps, place) {
            var placeId = place ? place._id : '';
            var url = `/api/pupils?corps=${corps.alias}&place=${placeId}`;

            return $http.get(url);
        }

        function getDictionary() {
            return $http.get('/api/dictionary')
        }

        function changeAudience(pupilId, audienceId, corps, place) {
            var placeId = place ? place._id : '';
            var url = `/api/changeaudience?corps=${corps.alias}&place=${placeId}`;
            
            return $http.post(url, {
                pupilId: pupilId, 
                audienceId: audienceId
            })
        }
    }    
        
    function seedController(api) {
        var vm = this;
        
        vm.pupils = [];
        vm.corpses = [];
        vm.dictionary = {};
        vm.currentCorps = {};
        vm.currentPlace = null;
        vm.currentAudience = null;

        vm.saveSeats = saveSeats;
        vm.generate = generate;

        vm.changeCorps = changeCorps;
        vm.changePlace = changePlace;
        vm.getPupils = getPupils;

        vm.dropped = dropped;
        vm.pupilFilter = pupilFilter;

        api.getDictionary().then(onDictionary);
        api.getCorpses().then(onCorpsesGet);
        api.getGenerateStatus().then(onGenerateStatusGet);

        function generate() {
            api
                .generate()
                .then(onSuccess);

            function onSuccess() {
                window.location = window.location;
            }    
        }

        function saveSeats() {
            api
                .saveSeats()
                .then(onSuccess);

            function  onSuccess() {
                var win = window.open('/api/saved-seats.json', '_blank');
                win.focus();
            }
        }

        function dropped(dragEl, dropEl) {
            var drag = angular.element(`#${dragEl}`);
            var drop = angular.element(`#${dropEl}`);
        
            var pupilId = drag.attr('data-pupil');
            var audienceId = drop.attr('data-audience');

            var pupilBel = drag.attr('data-bel');
            var audienceBel = drop.attr('data-bel');

            if (pupilBel === audienceBel) {
                api.changeAudience(pupilId, audienceId, vm.currentCorps, vm.currentPlace).then(onAudinceChanged);
            } 
            else {
                if (audienceBel === "true") {
                    alert('Попытка посадить не беларуса к беларусам детектед')
                } else {
                    alert('Попытка посадить беларуса к не беларусам детектед')
                }
               
            }
        }

        function onAudinceChanged(res) {
            vm.pupils = res.data.pupils;
            vm.corpses = res.data.corpses;

            if (vm.currentCorps) {
                for (var i = 0; i < vm.corpses.length; i++) {
                    if (vm.corpses[i].alias === vm.currentCorps.alias) {
                        vm.currentCorps = vm.corpses[i];
                    }
                }
            }

            if (vm.currentPlace) {
                for (var i = 0; i < vm.corpses.length; i++) {
                    for (var j = 0; j < vm.corpses[i].places.length; j++) {
                        if (vm.corpses[i].places[j]._id === vm.currentPlace._id) {
                            vm.currentPlace = vm.corpses[i].places[j];
                        }
                    }
                }
            }

            if (vm.currentPlace) {
                vm.audiences =  vm.currentPlace.audience;
            } else {
                fillAudiencesForCorps();
            }
        }

        function changeCorps() {
            vm.currentPlace = null;
            vm.currentAudience = null;
            
            fillAudiencesForCorps();

            getPupils();
        }

        function changePlace() {        
            vm.currentAudience = null;
            
            if (vm.currentPlace) {
                vm.audiences =  vm.currentPlace.audience;
            } else {
                fillAudiencesForCorps();
            }

            getPupils();
        }

        function fillAudiencesForCorps() {
            vm.audiences = [];
            for (var i = 0; i < vm.currentCorps.places.length; i++) {
                vm.audiences = vm.audiences.concat(vm.currentCorps.places[i].audience);
            }
        }

        function getPupils() {
            api
                .getPupils(vm.currentCorps, vm.currentPlace)
                .then(onPupilsGet);
        }

        function onCorpsesGet(res) {
            vm.corpses = res.data;
        }

        function onPupilsGet(res) {
            vm.pupils = res.data;
        }

        function onDictionary(res) {
            vm.dictionary = res.data;
        }

        function onGenerateStatusGet(res) {
            vm.generated = res.data
        }

        function pupilFilter(pupil) {
            var flag = true;
            if (vm.currentAudience) {
                
                flag =  pupil.audience === vm.currentAudience._id
            }

            return flag
        }
    }    
        
})();

