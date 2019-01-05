
window.$ = window.jQuery = require("jquery");

import "../node_modules/popper.js/dist/popper.min.js";
import "../node_modules/bootstrap/dist/js/bootstrap.min.js"
import "../node_modules/bootstrap/dist/css/bootstrap.min.css"

// Small helpers you might want to keep
import "./helpers/context_menu.js";
import "./helpers/external_links.js";

import { remote } from "electron";
import jetpack from "fs-jetpack";
//import { greet } from "./hello_world/hello_world";
import env from "env";

var angular = require('angular');
//var bootstrap = require('bootstrap');
var fs = require('fs');

const app = remote.app;
const appDir = jetpack.cwd(app.getAppPath());
const dialog = remote.dialog;

var ang = angular.module('mainApp', []);

//const manifest = appDir.read("package.json", "json");

const attackOutcome = ["*hit*", "*critical hit*", "*miss*", "strength damage attack."];

var logFileName;
var logFile;
var logLine;
var lastLine;
var isReloading = false;
var actorList = [];
var actorMap = {};
var actor = [];

ang.controller('mainController', function($scope) {
    $scope.display = "none";
    $scope.openLogFile = function() {
      $scope.logFileName = openFile();
    }
    $scope.actors = actorList;
    $scope.change = function() {
      isReloading = $scope.confirmed;
      if(isReloading) parseFile();
    }
    $scope.selectCreature = function(item) {
      $scope.selectedCreature = item;
      $scope.updateStats();
      $scope.display = "block";
    }

    $scope.updateStats = function() {
      $scope.bestAB = actorMap[$scope.selectedCreature].attackBonus();
      $scope.hitPercent = actorMap[$scope.selectedCreature].hitPercent();
      $scope.critPercent = actorMap[$scope.selectedCreature].critPercent();
      $scope.maxDamage = actorMap[$scope.selectedCreature].maxDamage;
      $scope.avgDamage = actorMap[$scope.selectedCreature].avgDamage();
      $scope.totalDamage = actorMap[$scope.selectedCreature].totalDamage;
      //$scope.targets = getTargets($scope.selectedCreature);
      $scope.targets = actorMap[$scope.selectedCreature].targets();

    }

    if(actorMap[$scope.selectedCreature] != undefined) {

    }
});

function CombatData() {
  this.name;
  this.damage = 0;
  this.damaged = 0;
  this.attackBonus;
  this.killed = 0;
  this.actor;
}

function Actor(name) {
  this.name = name;
  this.combatData = {};
  this.totalDamage = 0;
  this.bestAB = 0;
  this.maxDamage = 0;
  this.hits = 0;
  this.crits = 0;
  this.misses = 0;
  this.avgDamage = function() {
    return (this.totalDamage / (this.hits + this.crits)).toFixed(1);
  }
  this.totalHits = function() {
    return (this.hits + this.crits);
  }
  this.critPercent = function() {
    return ((this.crits / this.totalHits()) * 100).toFixed(1).toString() + "%";
  }
  this.hitPercent = function() {
    return (100 - (this.misses / (this.totalHits() + this.misses)) * 100).toFixed(1).toString() + "%";
  }
  this.damaged = function(target) {
    if(this.combatData[target] != undefined) {
      return this.combatData[target].damage;
    }
    return 0;
  }
  this.attackBonus = function() {
    return "+" + this.bestAB;
  }
  this.targets = function() {
    var targets = Object.values(this.combatData);
    for (var i=0; i<targets.length; i++) {
      targets[i].attackBonus = targets[i].actor.attackBonus();
    }
    return targets;
  }
}

function openFile() {
  try {
    var files = dialog.showOpenDialog(app.mainWindow, {
      properties: ['openFile'],
      filters: [
        {name: "NWN Log", extensions: ["txt"]}
      ]
    });
  } catch (e) {
    console.log(e);
  }
  if(files != undefined) {
    logFileName = files[0];
    parseFile();
    return logFileName;
  }
  return "";
}

function parseFile() {
  logFile = fs.readFileSync(logFileName, "utf8");
  logLine = logFile.split("\n");
  if(isReloading) {
    setTimeout(parseFile, 5000);
  }
  if(lastLine != undefined) {
    while(lastLine != logLine[0]) {
      logLine.splice(0, 1);
    }
    logLine.splice(0, 1);
  }
  if(logLine.length > 0) {
    logLine.forEach(findActors);
    logHits();
    for(var i=logLine.length - 1; i>0; i--) {
      if(logLine[i].indexOf("[CHAT WINDOW TEXT]") > -1) {
        lastLine = logLine[i];
        break;
      }
    }

  }
  var scope = angular.element(document.getElementById("app")).scope();
  if(!scope.$$phase) {
    scope.$apply(function () {
      scope.updateStats();
    });
  }
}

// Fill the actors list with all creatures that perform an action
function findActors(item) {
  if(contains(item, attackOutcome)) {
     var effort;
     if(item.indexOf(" attacks ") > -1) effort = " attacks ";
     if(item.indexOf(" attempts ") > -1) effort = " attempts ";
     if(item.indexOf(" uses ") > -1) effort = " uses ";
     var temp = item.substring(item.lastIndexOf("]"), item.indexOf(effort));
     temp = temp.substring(temp.lastIndexOf(":") + 2, temp.length).trim();
     var ab = parseInt(item.substring(item.indexOf("+") + 1, item.indexOf("=")).trim());
     if(actorList.indexOf(temp) == -1) {
       actorList.push(temp);
       actorMap[temp] = new Actor(temp)
       actor.push(actorMap[temp]);

     }
     if(actorMap[temp].bestAB < ab) actorMap[temp].bestAB = ab;
     if(item.indexOf(attackOutcome[0]) > -1) actorMap[temp].hits += 1;
     if(item.indexOf(attackOutcome[1]) > -1) actorMap[temp].crits += 1;
     if(item.indexOf(attackOutcome[2]) > -1) actorMap[temp].misses += 1;
  }
}

function logHits() {
  for(var l=0; l<logLine.length; l++) {
    for(var a=0; a<actor.length; a++) {
      if(logLine[l].indexOf(actor[a].name + " damages") > -1) {
        var dam = parseInt(logLine[l].substring(logLine[l].lastIndexOf(":") + 1, logLine[l].lastIndexOf("(")).trim());
        var target = logLine[l].substring(logLine[l].lastIndexOf("damages") + 8, logLine[l].lastIndexOf(":")).trim();
        actor[a].totalDamage += dam;
        if(actor[a].maxDamage < dam) actor[a].maxDamage = dam;
        //console.log("-" + actor[a].name + "-" + target + "-" + dam + "-");
        if(actor[a].combatData[target] == undefined) {
          actor[a].combatData[target] = new CombatData();
          actor[a].combatData[target].name = target;
        }
        //console.log("Hitter: " + actor[a].name + ", Target: " + target);
        //console.log(actorMap[target]);
        // TODO: ensure the actorMap[target] is defined, or at least why it's not on some occasions
        actor[a].combatData[target].damage += dam;
        if(actorMap[target].combatData[actor[a].name] == undefined) {
          actorMap[target].combatData[actor[a].name] = new CombatData();
          actorMap[target].combatData[actor[a].name].name = actor[a].name;
        }
        actorMap[target].combatData[actor[a].name].damaged += dam;
        actor[a].combatData[target].actor = actorMap[target];
        actorMap[target].combatData[actor[a].name].actor = actor[a];
        //console.log(actor[a].name + " " + actor[a].combatData[target]);
      }
      if(logLine[l].indexOf(actor[a].name + " killed") > -1) {
        var target = logLine[l].substring(logLine[l].lastIndexOf(" killed ") + 8, logLine[l].length - 1).trim();
        actor[a].combatData[target].killed++;
      }
    }
  }
}

// Take the stupid map of damage and return a better object
/*
function getTargets(item) {
  var targetData = [];
  var keys = Object.keys(actorMap[item].combatData);
  for(var i=0; i<keys.length; i++) {
    targetData[i] = actorMap[item].combatData[keys[i]];
    if(actorMap[keys[i]] != undefined) {
      targetData[i].damaged = actorMap[keys[i]].damaged(item);
      targetData[i].attackBonus = actorMap[keys[i]].attackBonus();
    }
  }
  return targetData;
}//*/

function contains(line, matches) {
  for(var i=0; i<matches.length; i++) {
    if(line.indexOf(matches[i]) > -1) return true;
  }
  return false;
}

const osMap = {
  win32: "Windows",
  darwin: "macOS",
  linux: "Linux"
};

window.onload = function () {
  //Reveal the UI
  document.querySelector("#app").style.display = "block";
}
//document.querySelector("#actors").innerHTML = actor;
//document.querySelector("#greet").innerHTML = greet();
//document.querySelector("#os").innerHTML = osMap[process.platform];
//document.querySelector("#author").innerHTML = manifest.author;
//document.querySelector("#env").innerHTML = env.name;
//document.querySelector("#electron-version").innerHTML = process.versions.electron;
