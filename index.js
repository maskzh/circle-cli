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
  .command('project', 'Show project\'s builds', function(yargs) {
    var argv = yargs.reset()
      .option("t", {
        alias: "vcs-type",
        description: "vcs-type"
      })
      .option("u", {
        alias: "username",
        description: "username"
      })
      .option("p", {
        alias: "project",
        description: "project's name"
      })
      .option("n", {
        alias: "build_num",
        description: "build_num"
      })
      .option("a", {
        alias: "artifacts",
        description: "artifacts"
      })
      .option("r", {
        alias: "retry",
        description: "retry"
      })
      .option("c", {
        alias: "cancel",
        description: "cancel"
      })
      .demand(['p'])
      .alias("h", "help")
      .help("h")
      .argv;

    if (argv.n) {
      if (argv.a) {
        fetch(API + 'project/' + (argv.t || 'github') + '/' + (argv.u || 'maskzh') + '/' + argv.p + '/' + argv.n + '/artifacts' + TOKEN)
        .then(function(response) { return response.json() })
        .then(function(data) {
          data.forEach(function(item) {
            console.log(running('- ') + success(item.url))
          })
        })
        return
      }
      if (argv.r) {
        fetch(API + 'project/' + (argv.t || 'github') + '/' + (argv.u || 'maskzh') + '/' + argv.p + '/' + argv.n + '/retry' + TOKEN, { method: 'post' })
        .then(function(response) { return response.json() })
        .then(function(data) {
          console.log(success('retried'))
        })
        return
      }
      if (argv.c) {
        fetch(API + 'project/' + (argv.t || 'github') + '/' + (argv.u || 'maskzh') + '/' + argv.p + '/' + argv.n + '/cancel' + TOKEN, { method: 'post' })
        .then(function(response) { return response.json() })
        .then(function(data) {
          console.log(success('canceled'))
        })
        return
      }
      fetch(API + 'project/' + (argv.t || 'github') + '/' + (argv.u || 'maskzh') + '/' + argv.p + '/' + argv.n + TOKEN)
      .then(function(response) { return response.json() })
      .then(function(data) {
        var t = new Table
        t.cell('key', 'Build')
        t.cell('value', running(data.build_num))
        t.newRow()
        t.cell('key', 'Subject')
        t.cell('value', data.subject)
        t.newRow()
        t.cell('key', 'Author')
        t.cell('value', data.author_name)
        t.newRow()
        t.cell('key', 'Committer')
        t.cell('value', data.committer_name)
        t.newRow()
        t.cell('key', 'Status')
        t.cell('value', getColorFunc(data.status)(data.status))
        t.newRow()
        console.log(t.print())
        if (!data.steps) return
        data.steps.forEach(function(step) {
          console.log(running('- ') + step.name + ' ' + getColorFunc(step.actions[0].status)(step.actions[0].status) + ' ' + failure((step.actions[0].run_time_millis/1000) + 's'))
        })
      })
      return
    }

    fetch(API + 'project/' + (argv.t || 'github') + '/' + (argv.u || 'maskzh') + '/' + argv.p + TOKEN)
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
  .command('show', 'show recent build', function(yargs) {
    fetch(API + 'recent-builds' + TOKEN)
    .then(function(response) { return response.json() })
    .then(function(data) {
      var build = data.filter(function(item) {
        return (item.branch === 'dev' || item.branch === 'master')
      })[0]
      fetch(API + 'project/' + build.vcs_type + '/' + build.username + '/' + build.reponame + '/' + build.build_num + TOKEN)
      .then(function(response) { return response.json() })
      .then(function(data) {
        var t = new Table
        t.cell('key', 'Build')
        t.cell('value', running(data.build_num))
        t.newRow()
        t.cell('key', 'Subject')
        t.cell('value', data.subject)
        t.newRow()
        t.cell('key', 'Author')
        t.cell('value', data.author_name)
        t.newRow()
        t.cell('key', 'Committer')
        t.cell('value', data.committer_name)
        t.newRow()
        t.cell('key', 'Status')
        t.cell('value', getColorFunc(data.status)(data.status))
        t.newRow()
        console.log(t.print())
        if (!data.steps) return
        data.steps.forEach(function(step) {
          console.log(running('- ') + step.name + ' ' + getColorFunc(step.actions[0].status)(step.actions[0].status) + ' ' + failure((step.actions[0].run_time_millis/1000) + 's'))
        })
      })
    })
  })
  .command('artifacts', 'show recent build artifacts', function(yargs) {
    fetch(API + 'recent-builds' + TOKEN)
    .then(function(response) { return response.json() })
    .then(function(data) {
      var build = data.filter(function(item) {
        return (item.branch === 'dev' || item.branch === 'master')
      })[0]
      fetch(API + 'project/' + build.vcs_type + '/' + build.username + '/' + build.reponame + '/' + build.build_num + '/artifacts' + TOKEN)
      .then(function(response) { return response.json() })
      .then(function(data) {
        data.forEach(function(item) {
          console.log(running('- ') + success(item.url))
        })
      })
    })
  })
  .command('retry', 'retry recent build', function(yargs) {
    fetch(API + 'recent-builds' + TOKEN)
    .then(function(response) { return response.json() })
    .then(function(data) {
      var build = data.filter(function(item) {
        return (item.branch === 'dev' || item.branch === 'master')
      })[0]
      fetch(API + 'project/' + build.vcs_type + '/' + build.username + '/' + build.reponame + '/' + build.build_num + '/retry' + TOKEN, { method: 'post' })
      .then(function(response) { return response.json() })
      .then(function(data) {
        console.log(success('retried'))
      })
    })
  })
  .command('cancel', 'cancel recent build', function(yargs) {
    fetch(API + 'recent-builds' + TOKEN)
    .then(function(response) { return response.json() })
    .then(function(data) {
      var build = data.filter(function(item) {
        return (item.branch === 'dev' || item.branch === 'master')
      })[0]
      fetch(API + 'project/' + build.vcs_type + '/' + build.username + '/' + build.reponame + '/' + build.build_num + '/cancel' + TOKEN, { method: 'post' })
      .then(function(response) { return response.json() })
      .then(function(data) {
        console.log(success('canceled'))
      })
    })
  })

var argv = yargs.argv;