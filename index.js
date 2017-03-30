#!/usr/bin/env node
require('shelljs/global');
var yargs = require('yargs');
var color = require('colors');
var fetch = require('node-fetch');
var Table = require('easy-table');

var API = 'https://circleci.com/api/v1.1/'
var TOKEN = process.env.CIRCLE_TOKEN
var VCS_TYPE = process.env.CIRCLE_VCS_TYPE
var USERNAME = process.env.CIRCLE_USERNAME

var success = color.green.bold;
var notests = color.yellow.bold;
var running = color.cyan.bold;
var failure = color.red.bold;
var none = color.white.bold;

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
  }[status] || none
}

if (!TOKEN) return console.log('CIRCLE_TOKEN is not set')

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

    fetch(API + 'projects?circle-token=' + TOKEN)
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
    }).catch(function(err) {
      console.log(err)
    })
  })
  .command('ls', 'recent builds', function(yargs) {
    var argv = yargs.reset()
      .option("b", {
        alias: "branch",
        description: "branch"
      })
      .option("r", {
        alias: "reponame",
        description: "reponame"
      })
      .alias("h", "help")
      .help("h")
      .argv;

    fetch(API + 'recent-builds?circle-token=' + TOKEN)
    .then(function(response) { return response.json() })
    .then(function(data) {
      var t = new Table
      if (argv.r) {
        data = data.filter(function(item) {
          return argv.r.indexOf(item.reponame) !== -1
        })
      }
      if (argv.b) {
        data = data.filter(function(item) {
          return argv.b.indexOf(item.branch) !== -1
        })
      }
      data.forEach(function(item) {
        t.cell('#', notests(item.build_num))
        t.cell('Repo', item.reponame)
        t.cell('Branch', item.branch)
        t.cell('Status', getColorFunc(item.status)(item.status))
        t.cell('Author', item.author_name)
        t.cell('Commit Time', new Date(item.committer_date).toLocaleString())
        t.cell('Commit', item.subject)
        t.newRow()
      })

      console.log(t.toString())
    }).catch(function(err) {
      console.log(err)
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
        fetch(API + 'project/' + (argv.t || VCS_TYPE) + '/' + (argv.u || USERNAME) + '/' + argv.p + '/' + argv.n + '/artifacts?circle-token=' + TOKEN)
        .then(function(response) { return response.json() })
        .then(function(data) {
          data.forEach(function(item) {
            console.log(running('- ') + success(item.url))
          })
        }).catch(function(err) {
          console.log(err)
        })
        return
      }
      if (argv.r) {
        fetch(API + 'project/' + (argv.t || VCS_TYPE) + '/' + (argv.u || USERNAME) + '/' + argv.p + '/' + argv.n + '/retry?circle-token=' + TOKEN, { method: 'post' })
        .then(function(response) { return response.json() })
        .then(function(data) {
          console.log(success(argv.p + ' #' + argv.n + ' retried'))
        }).catch(function(err) {
          console.log(err)
        })
        return
      }
      if (argv.c) {
        fetch(API + 'project/' + (argv.t || VCS_TYPE) + '/' + (argv.u || USERNAME) + '/' + argv.p + '/' + argv.n + '/cancel?circle-token=' + TOKEN, { method: 'post' })
        .then(function(response) { return response.json() })
        .then(function(data) {
          console.log(success(argv.p + ' #' + argv.n + ' canceled'))
        }).catch(function(err) {
          console.log(err)
        })
        return
      }
      fetch(API + 'project/' + (argv.t || VCS_TYPE) + '/' + (argv.u || USERNAME) + '/' + argv.p + '/' + argv.n + '?circle-token=' + TOKEN)
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
      }).catch(function(err) {
        console.log(err)
      })
      return
    }

    fetch(API + 'project/' + (argv.t || VCS_TYPE) + '/' + (argv.u || USERNAME) + '/' + argv.p + '?circle-token=' + TOKEN)
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
    }).catch(function(err) {
      console.log(err)
    })
  })
  .command('show', 'show recent build', function(yargs) {
    fetch(API + 'recent-builds?circle-token=' + TOKEN)
    .then(function(response) { return response.json() })
    .then(function(data) {
      var build = data.filter(function(item) {
        return (item.branch === 'dev' || item.branch === 'master')
      })[0]
      fetch(API + 'project/' + build.vcs_type + '/' + build.username + '/' + build.reponame + '/' + build.build_num + '?circle-token=' + TOKEN)
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
      }).catch(function(err) {
        console.log(err)
      })
    }).catch(function(err) {
      console.log(err)
    })
  })
  .command('artifacts', 'show recent build artifacts', function(yargs) {
    fetch(API + 'recent-builds?circle-token=' + TOKEN)
    .then(function(response) { return response.json() })
    .then(function(data) {
      var build = data.filter(function(item) {
        return (item.branch === 'dev' || item.branch === 'master')
      })[0]
      fetch(API + 'project/' + build.vcs_type + '/' + build.username + '/' + build.reponame + '/' + build.build_num + '/artifacts?circle-token=' + TOKEN)
      .then(function(response) { return response.json() })
      .then(function(data) {
        data.forEach(function(item) {
          console.log(running('- ') + success(item.url))
        })
      }).catch(function(err) {
        console.log(err)
      })
    }).catch(function(err) {
      console.log(err)
    })
  })
  .command('retry', 'retry recent build', function(yargs) {
    fetch(API + 'recent-builds?circle-token=' + TOKEN)
    .then(function(response) { return response.json() })
    .then(function(data) {
      var build = data.filter(function(item) {
        return (item.branch === 'dev' || item.branch === 'master')
      })[0]
      fetch(API + 'project/' + build.vcs_type + '/' + build.username + '/' + build.reponame + '/' + build.build_num + '/retry?circle-token=' + TOKEN, { method: 'post' })
      .then(function(response) { return response.json() })
      .then(function(data) {
        console.log(success(build.reponame + ' #' + build.build_num + ' retried'))
      }).catch(function(err) {
        console.log(err)
      })
    }).catch(function(err) {
      console.log(err)
    })
  })
  .command('cancel', 'cancel recent build', function(yargs) {
    fetch(API + 'recent-builds?circle-token=' + TOKEN)
    .then(function(response) { return response.json() })
    .then(function(data) {
      var build = data.filter(function(item) {
        return (item.branch === 'dev' || item.branch === 'master')
      })[0]
      fetch(API + 'project/' + build.vcs_type + '/' + build.username + '/' + build.reponame + '/' + build.build_num + '/cancel?circle-token=' + TOKEN, { method: 'post' })
      .then(function(response) { return response.json() })
      .then(function(data) {
        console.log(success(build.reponame + ' #' + build.build_num + ' canceled'))
      }).catch(function(err) {
        console.log(err)
      })
    }).catch(function(err) {
      console.log(err)
    })
  })

var argv = yargs.argv;