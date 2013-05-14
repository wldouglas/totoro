'use strict';

var path = require('path')
var fs = require('fs')

var logger = require('totoro-log')
var utils = require('./utils')

var defaultCfg = {
    //runner: undefined,
    //adapter:undefined,
    //clientRoot: undefined,
    browsers: ['chrome', 'firefox', 'safari', 'ie/9', 'ie/8', 'ie/7', 'ie/6'],
    charset: 'utf-8',
    timeout: 5,
    clientHost: utils.getExternalIpAddress(),
    clientPort: '9998',
    serverHost: '10.15.52.87',
    serverPort: '9999'
}

module.exports = handleCfg

function handleCfg(cfg) {
    var globalCfg = readCfgFile(path.join(utils.home, '.totoro', 'config.json'))
    var projectCfg = readCfgFile(path.join(process.cwd(), 'totoro-config.json'))
    utils.mix(cfg, projectCfg, globalCfg, defaultCfg)

    // if cfg.list, don't need to handle options relate to test
    if(!cfg.list){
        if (!cfg.runner) {
            logger.debug('not specified runner, try to find out')
            cfg.runner = findRunner()
        }
        handleClientRoot(cfg)
        handleRunner(cfg)
        handleAdapter(cfg)
    }
}

function readCfgFile(p) {
    var cfg

    if (!fs.existsSync(p)) {
        return
    }

    cfg = fs.readFileSync(p) + ''
    if (!cfg) {
        return
    }

    try {
        return JSON.parse(cfg)
    } catch(e) {
        logger.warn('parse config file: ' + p + ' error!')
        return
    }
}

function handleClientRoot(cfg) {
    var clientRoot = cfg.clientRoot
    var runner = cfg.runner
    var adapter = cfg.adapter
    var runnerIsExistedFile = isExistedFile(runner)
    var adapterIsExistedFile = isExistedFile(adapter)
    /*
     * no need to consider other conditions about runner and adapter
     * just see if a clientRoot is required
     */ 
    if (runnerIsExistedFile || adapterIsExistedFile) {
        var runnerRoot
        var adapterRoot
        if (runnerIsExistedFile) {
            runnerRoot = guessRunnerRoot(runner) 
        }
        if (adapterIsExistedFile) {
            adapterRoot = path.dirname(adapter)
        }
        var root = commonRoot(runnerRoot, adapterRoot)

        if(clientRoot) {
            logger.debug('specified clientRoot: ' + clientRoot)
            clientRoot = path.resolve(clientRoot)
            if (root.indexOf(clientRoot) !== 0) {
                clientRoot = root
                logger.warn('specified clientRoot is not appropriate, guessed one: ' + clientRoot)
            }
        } else {
            clientRoot = root
            logger.debug('not specified clientRoot, guessed one: ' + clientRoot)
        }

        cfg.clientRoot = clientRoot
    } else {
        logger.debug('none of runner and adapter is existed file, not need clientRoot')
        delete cfg.clientRoot
    }
}

function guessRunnerRoot(runner) {
    // TODO
    var root = path.join(runner, '..', '..')
    logger.debug('guess runner root is: ' + root)
    return root
}

function commonRoot(dir1, dir2) {
    if (dir1) {
        dir1 = path.resolve(dir1)
    }
    if (dir2) {
        dir2 = path.resolve(dir2)
    }
    if (dir1 && dir2) {
        var arr1 = dir1.split(path.sep)
        var arr2 = dir2.split(path.sep)
        var root = []
        for(var i = 0; i < arr1.length; i++){
            if (arr1[i] === arr2[i]) {
                root.push(arr1[i])
            } else {
                break
            }
        }
        if (root.length) {
            return root.join(path.sep)
        } else {
            logger.error('cannot decide a root for runner and adapter')
        }
    } else if (dir1) {
        return dir1
    } else if (dir2) {
        return dir2
    }
}

function findRunner() {
    var testDir
    var cwd = process.cwd()

    if (/^tests?$/.test(cwd)) {
        testDir = cwd
    } else if (fs.existsSync('test')) {
        testDir = path.resolve('test')
    } else if (fs.existsSync('tests')) {
        testDir = path.resolve('tests')
    }

    if (testDir) {
        var runner = path.join(testDir, 'runner.html')
        if (isExistedFile(runner)) {
            logger.debug('found runner: ' + runner)
            return runner
        } else {
            logger.debug('not found runner')
        }
    } else {
        logger.error('not found test dir')
    }
}

function handleRunner(cfg) {
    var runner = cfg.runner
    if (!isUrl(runner)) {
        if (isExistedFile(runner)) {
            if (path.extname(runner) === '.html') {
                cfg.runner = dir2Url(runner, cfg)
            } else {
                logger.error('runner: ' + runner + ' is not a html file')
            }
        } else {
            logger.error('specified runner: ' + runner + ' is not available')
        }
    }
}

function handleAdapter(cfg) {
    var adapter = cfg.adapter
    if (adapter && !isUrl(adapter) && !isKeyword(adapter)) {
        if (isExistedFile(adapter)) {
            if (path.extname(adapter) === '.js') {
                cfg.adapter = dir2Url(adapter, cfg)
            } else {
                logger.error('adapter: ' + adapter + ' is not a js file')
            }
        } else {
            logger.error('specified adapter: ' + adapter + ' is not available')
        }
    }
}


function isUrl(p) {
    return /^https?:\/\//.test(p)
}

function isKeyword(p) {
    return p.indexOf('.') === -1 && p.indexOf(path.sep) === -1
}

function isExistedFile(p){
    return p && fs.existsSync(p) && fs.statSync(p).isFile()
}

function dir2Url(p, cfg){
    return 'http://' + cfg.serverHost + ':' + cfg.serverPort +
            '/' + path.relative(cfg.clientRoot, p).replace(path.sep, '/')
}