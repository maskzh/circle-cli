#!/usr/bin/env node
require('shelljs/global');
var yargs = require('yargs');
var color = require('colors');
var fetch = require('node-fetch');
var Table = require('easy-table');

var API = 'https://circleci.com/api/v1.1/'

var success = color.green.bold;
var notests = color.yellow.bold;
var running = color.cyan.bold;
var failure = color.red.bold;
var none = color.black.bold;

function getColorFunc(status) {
  return {
    'no_tests': notests,
    'canceled': notests,
    'success': success,
    'fixed': success,
    'failed': failure,
    'timedout': failure,
    'failure': failure,
    'running': running
  }[status]
}

yargs
  .command('projects', 'Print projects', function(yargs) {
    var argv = yargs.reset()
      .option("v", {
        alias: "verbose",
        description: "Show additional information about projects"
      })
      .alias("h", "help")
      .help("h")
      .argv;

    fetch(API + 'projects' + TOKEN)
    .then(function(response) { return response.json() })
    .then(function(data) {
      data.forEach(function(item) {
        console.log(item.username + '/' + item.reponame)
        if (argv.v) {
          var branches = item.branches
          var t = new Table
          Object.keys(branches).forEach(function(branch) {
            if (branch !== 'dev' && branch !== 'master') return
            var recent_builds = branches[branch].recent_builds
            if (!recent_builds) return

            t.cell('Branch', branch)
            t.cell('Status', getColorFunc(recent_builds[0].status)(recent_builds[0].status))
            t.newRow()
          })
          console.log(t.print())
        }
      })
    })
  })
  .command('recent-builds', 'recent builds', function(yargs) {
    fetch(API + 'recent-builds' + TOKEN)
    .then(function(response) { return response.json() })
    .then(function(data) {
      var t = new Table
      data.filter(function(item) {
        return (item.branch === 'dev' || item.branch === 'master')
      }).forEach(function(item) {
        t.cell('#', notests(item.build_num))
        t.cell('Repo', item.reponame)
        t.cell('Branch', item.branch)
        t.cell('Status', getColorFunc(item.status)(item.status))
        t.cell('Commit', item.subject)
        t.newRow()
      })

      console.log(t.toString())
    })
  })

var argv = yargs.argv;