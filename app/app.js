var controlPanelApp = angular.module('controlPanelApp',['ngSanitize']);

    controlPanelApp.config(function($httpProvider) {
        $httpProvider.defaults.xsrfCookieName = 'csrftoken';
        $httpProvider.defaults.xsrfHeaderName = 'X-CSRFToken';
    });

    controlPanelApp.controller('FormCtrl', ['$scope', '$http','DataAPI', function($scope, $http, DataAPI) {
        var menuItems = [
            {id: 1, value: 'Extract All', url: "http://ecsc001008a4.epam.com/adverse/upload/tojson/extract?w="},
            {id: 2, value: 'Extract Drugs Only', url: "http://ecsc001008a4.epam.com/adverse/upload/tojson/extractdrug?w="},
            {id: 3, value: 'Extract Adverse Effects Only', url: "http://ecsc001008a4.epam.com/adverse/upload/tojson/extracteffect?w="},
            {id: 4, value: 'Extract Triplets Only', url: "http://ecsc001008a4.epam.com/adverse/upload/tojson/extracttriple?w="}
        ];

        $scope.actions = menuItems;
        $scope.currentAction = menuItems[0];


        $scope.getData = function(currentAction, searchText, file) {

            var url = currentAction.url;
            var urlPost = "http://ecsc001008a4.epam.com/adverse/upload/list/";

            if (searchText) {
                $http.get( url + searchText)
                    .success( function(response) {
                        DataAPI.success(response);
                    });
            }
            else if (file) {
                var fd = new FormData();
                fd.append('docfile', file);
                $http.post(urlPost, fd, {
                    withCredentials : false,
                    headers : {
                      'Content-Type' : undefined
                    },
                    transformRequest : angular.identity
                })
                .success( function(response) {
                    DataAPI.success(response);
                });
            }
            else {
                DataAPI.clear();
            }
            
        };
        
    }]);

    controlPanelApp.factory('DataAPI', function() {
        return {
            status: null,
            message: null,
            success: function(response) {
                this.status = "success";
                this.results = response.results;
                this.drugs = getGroups(response.results, "drugs");
                this.effects = getGroups(response.results, "effects");
                this.triples = getGroups(response.results, "triples");

                var apiHighlighting = transformAPItoHighligting(response);
                this.text = transformTextToHighligting(response.text, apiHighlighting);
            },
            error: function(msg) {
                this.status = "error";
                this.message = msg;
            },
            clear: function() {
                this.status = null;
            }
        }
    });

    controlPanelApp.directive('drugs', [ function() {
        return {
            restrict: 'E',
            scope: {},
            replace: true,
            controller: function($scope, DataAPI) {
                $scope.show = false;
                $scope.api = DataAPI;

                $scope.$watch('api.status', showDrugs);
            
                function showDrugs() {
                    $scope.api.clear();
                    $scope.show = !!($scope.api.status && $scope.api.results && $scope.api.drugs);
                    $scope.class = "show";
                }

            },
            templateUrl: "../assets/templates/tables.html"
        }
    }]);

    controlPanelApp.directive('fileuploader', [ function() {
        return {
            restrict: 'E',
            replace: true,
            scope: {
                ngModelFile: "="
            },
            link: function(scope, el, attrs) {
                el.bind('change', function(event){
                    var files = event.target.files;
                    var file = files[0];
                    scope.file = file ? file.name : undefined;

                    scope.$apply(function() {
                        scope.ngModelFile = file ? file : undefined;
                    });
                });
            },
            template: '<div class="col-xs-12 col-sm-6 col-md-6 col-lg-4"><div class="fileUpload btn btn-primary"><span>Upload file</span>'
             + '<input id="uploadBtn" type="file" class="upload"/></div><span class="fileNameCaption">{{ngModelFile.name}}</span></div>'
        }
    }]);

    function transformAPItoHighligting(data) {
        var filtredRules = [];
        var drugsAll = [];
        var effectsAll = [];
        var triplesAll = [];

        var resultsLength = data.results.length;

        for (var i=0; i < resultsLength; i++) {
            var drugs = data.results[i].drugs;
            var effects = data.results[i].effects;

            if (drugs) {
                drugsAll = drugsAll.concat(drugs);
            }
            if (effects) {
                effectsAll = effectsAll.concat(effects);
            }
            var triples = data.results[i].triples;
            if (triples) {
                triplesAll = triplesAll.concat(triples);
            }
        }

        filtredRules = filtredRules.concat(makefiltredRules(drugsAll, "drugs"));
        var filtredRulesEffects = makefiltredRules(effectsAll, "effects");
        var filtredRulesTriples = makefiltredRules(triplesAll, "triples");
        filtredRules = filtredRules.concat(filtredRulesEffects,filtredRulesTriples);

        filtredRules.sort(function(a,b) {
            return b.start - a.start;
        });

        console.log("filtredRules " + JSON.stringify(filtredRules));
        return filtredRules;
    }

    function transformTextToHighligting(text, rulesArr) {
        var result = text;
        for(var n=0; n < rulesArr.length; n++) {
            var substitute = "<a href='#" + rulesArr[n].key + "' class='" + rulesArr[n].type + "'>" + rulesArr[n].key + "</a>";
            result = replaceRange(result, rulesArr[n].start, rulesArr[n].end, substitute);
        }

        function replaceRange(s, start, end, substitute) {
            return s.substring(0, start) + substitute + s.substring(end);
        }
        return result;
    }


    function getGroups(arr, type) {
        return arr.reduce(function(result, item) {
            return result.concat(item[type]);
        }, []);
    }

    function makefiltredRules(arr, type) {

        var rules = arr.map(function(el){
            var highlightingRule = {};
            if (type !== "triples") {
                highlightingRule.start = el.start;
                highlightingRule.end = el.end;
                highlightingRule.key = el.name;
            }
            else {
                highlightingRule.start = el.actionStart;
                highlightingRule.end = el.actionEnd;
                highlightingRule.key = el.action;
            }
            highlightingRule.type = type;
            return highlightingRule;
        });

        var filtredRules = [];

        rules.forEach(function(rule) {
            var isDuplicated = false;
            filtredRules.forEach(function(filtredRule) {
                if (filtredRule.start == rule.start || filtredRule.end == rule.end ) {
                    isDuplicated = true;
                }
            });

            if (!isDuplicated) {
                filtredRules.push(rule);
            }

        });
        return filtredRules;
    }
