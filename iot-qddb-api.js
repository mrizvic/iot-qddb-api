var myAppName=__filename;

require("console-stamp")(console, "yyyy-mm-dd HH:MM:ss.l");
var express = require('express');
var bodyParser = require('body-parser');
var app = express();
// parse application/x-www-form-urlencoded 
app.use(bodyParser.urlencoded({ extended: false }));

console.info('PID: ' + process.pid)
console.info('Application name: ' + myAppName)

if (global.gc) {
    console.info('global.gc() function enabled');
} else {
    console.info('global.gc() function disabled');
}

// if environment variables are not present then assume its development mode

var app_host = process.env.APP_HOST;
var app_port = process.env.APP_PORT;
var app_mode = process.env.APP_MODE;        // dev or prod
var app_pubdir = process.env.APP_PUBDIR;    // ommit if running behind nginx, otherwise specify direcotry to serve static files from - without leading slash!


var printStatistics = function() {
    console.info('API requests: ' + apiRequests);
    console.info('mysql pool.getConnection calls: ' + sqlGetConnections);
    console.info('mysql errors: ' + sqlErrors);
    console.info('mysql inserts: ' + sqlInserts);
    console.info('mysql selects: ' + sqlSelects);
    console.info('mysql creates: ' + sqlCreates);
    console.info('mysql drops: ' + sqlDrops);
    console.info('mysql deletes: ' + sqlDeletes);
    console.info('GET requests: ' + getRequests);
    console.info('PUT/POST requests: ' + PutPostRequests);
    console.info('DELETE requests: ' + deleteRequests);
};

var signalHandler = function() {
    console.info('We-should-cleanup signal catched.. shutting down');

    console.info('closing application socket');
    try {
        server.close();
    }
    catch(e) {
        console.error('server.close() error: ' + e);
    }

    console.info('closing mysql connection pool');
    pool.end(function(err) {
            console.info('all connections in the pool have ended');
            if (err) { console.error(err); }
    });
    
    printStatistics();

    console.info('process ends here');
    process.exit();
}

if ( (app_mode == 'dev') || (typeof(app_mode) == 'undefined') || (myAppName.indexOf('devel') > -1) ) { 
    console.info('Application mode: development');
    process.on('SIGUSR2', signalHandler);
    var debug = 1;
    var port = 8007;
    var host = '127.0.0.1';
} else if (app_mode == 'prod') {
    console.info('Applicaion mode: production');
    process.on('SIGUSR2', printStatistics);
    var debug = 0;
} else {
    console.error('Application mode: unknown');
    process.exit(1);
}

// if APP_PUBDIR env variable is specified
if (typeof(app_pubdir) != 'undefined') {
    var path = require('path');
    var mypath = path.join(__dirname, app_pubdir);
    try {
        var fs = require('fs');
        var isDir = fs.statSync(app_pubdir).isDirectory();
    }
    catch (e) {
        console.error(e);
    }
    finally {
        if (isDir) {
            app.use('/' + app_pubdir, express.static(mypath));
            console.info('Serving static files from: ' + mypath);
        } else {
            console.error('Directory '+mypath+' not found. Static files are not served by this process.');
        }
    }
} else {
    console.info('Static files are not served by this process.');
}

var host = app_host ? app_host : '127.0.0.1';
var port = app_port ? app_port : 8007;

var mydebug = function(message) {
    if (debug) {
        console.info(message);
    }
};

// counter variables
var sqlGetConnections = 0;
var sqlErrors = 0;
var sqlCreates = 0;
var sqlSelects = 0;
var sqlInserts = 0;
var sqlDeletes = 0;
var sqlDrops = 0;
var apiRequests = 0;

var apiRequests=0;
var getRequests=0;
var PutPostRequests=0;
var deleteRequests=0;


// database stuff
var dbConfig = require('./dbConfig.js').dbConfig;
var mysql = require('mysql');
var pool = mysql.createPool(dbConfig);


/*
    25000 records of 10 second updates = 2.89 days of data
    25000 records of 30 second updates = 5.78 days of data
    25000 records of 1 minute updates = 17.36 days of data
    25000 records of 5 minute updates = 86.80 days of data
    25000 records of 10 minute updates = 173.61 days of data
*/
// hardlimit number of sql results
var resultLimit = 25000;

// retention limit (days)
var retentionLimit = 1000;

var hardLimit = function(limit, max) {
    // truncate weird inputs
    if (isNaN(limit)) { return max; }

    limit = parseInt(limit);

    if ( limit < -max ) { 
        limit = -max;
    } else if ( limit > max ) {
        limit = max;
    }
    return limit;
};

var getOrder = function(limit) {
    if ( limit < 0 ) {
        return 'ASC';
    } else {
        return 'DESC';
    }
};

// Add headers
app.use(function (req, res, next) {
    // WORKAROUND to allow API calls from anywhere
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || "anonymous");

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);

    // Pass to next layer of middleware
    next();
});

// Log request and populate counters
app.use(function (req, res, next) {
    apiRequests++;
    if (req.method == 'GET') {
        getRequests++;
    } else if ( (req.method == 'POST') || (req.method == 'PUT') ) {
        PutPostRequests++;
    } else if ( req.method == 'DELETE' ) {
        deleteRequests++;
    }
    req.id = randomString(8);
    req.mylogger = 'req.id=' + req.id + ' ' + req.method + ' ' + req.url;
    console.log(req.mylogger);
    next();
});


function randomString(length) {
    var text = "";
    var possible = "0123456789abcdef";
    for (var i = 0; i < length; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
}

function uniqueCharacters(input) {
    var str=input;
    var uniql="";
    for (var x=0;x<str.length;x++) {
        if(uniql.indexOf(str.charAt(x))==-1) {
            uniql += str[x];  
        }
    }
    return uniql;  
}

function dbQuery (req, res) {
    // console.log(req.query);
    pool.getConnection(function(err, connection) {
        sqlGetConnections++;
        if (err) {
            sqlErrors++;
            console.error('req.id='+req.id+' SQL query: ' + req.query);
            console.error('req.id='+req.id+' pool getConnection error: ' + err);
        } else {
            connection.query(req.query, function(err, rows) {
                if (err) {
                    sqlErrors++;
                    console.error('req.id='+req.id+' SQL query: ' + req.query);
                    console.error('req.id='+req.id+' SQL error: ' + err);

                    if (err.code == 'ER_NO_SUCH_TABLE') {
                        res.send('ERROR: no such apikey or stream, errorID='+req.id);
                    } else if (err.code == 'ER_BAD_FIELD_ERROR') {
                        res.send('ERROR: BAD_FIELD, errorID='+req.id);
                    } else if (err.code == 'ER_TABLE_EXISTS_ERROR') {
                        res.send('ERROR: stream already exists, errorID='+req.id);
                    } else if (err.code == 'ER_BAD_TABLE_ERROR') {
                        res.send('ERROR: stream does not exist, errorID='+req.id);
                    } else {
                        res.send('ERROR: refer to server log for details, errorID='+req.id);
                    }

                } else {
                	if (rows.length > 0) {
	                    res.send(rows);
                    } else {
                		res.send('{}');
                	}
                }
            });
            connection.release();
        }
    });
}

// app.get('/test/:testvar([a-zA-Z0-9]+)', function (req, res, next) {
//     var testvar = req.params.testvar;
//     res.send('OK ' + testvar);
// })


// return column names from a table but without id and timestamp
app.get('/info/:apikey([a-zA-Z0-9]+)/:sid([a-zA-Z0-9_-]+)', function (req, res, next) {
    var apikey = req.params.apikey;
    var sid = req.params.sid;
    var tablename = apikey + '_' + sid;
    // var query = "SELECT COLUMN_NAME as field FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '" + tablename + "' AND COLUMN_NAME != 'id' AND COLUMN_NAME != 'timestamp'";
    var query = "SELECT GROUP_CONCAT(COLUMN_NAME SEPARATOR ',') AS result FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '" + tablename + "' AND COLUMN_NAME != 'id' AND COLUMN_NAME != 'timestamp'";
    req.query = query;
    console.info('req.id='+req.id+' SQL query: ' + req.query);
    sqlDrops++;
    next();
}, dbQuery);

// delete table
app.post('/delete/:apikey([a-zA-Z0-9]+)/:sid([a-zA-Z0-9_-]+)', function (req, res, next) {
    var apikey = req.params.apikey;
    var sid = req.params.sid;
    var tablename = apikey + '_' + sid;
    var query = "DROP TABLE " + tablename;
    req.query = query;
    console.info('req.id='+req.id+' SQL query: ' + req.query);
    sqlDrops++;
    next();
}, dbQuery);

// create table with custom column names
app.post('/create/:apikey([a-zA-Z0-9]+)/:sid([a-zA-Z0-9_-]+)', function (req, res, next) {
    var apikey = req.params.apikey;
    var sid = req.params.sid;
    var tablename = apikey + '_' + sid;
    var queryX = "";
    var keycount = 0;

    for (var key in req.query) {
        if ( (key.length < 1) || (key == 'id') || (key == 'timestamp') ) { continue; }
        queryX += "`"+key+"` varchar(10) NULL,\n";
        keycount++;
    }

    if (keycount < 1) {
        console.error('req.id='+req.id+' req.query parameters: ' + JSON.stringify(req.query));
        res.send('ERROR: refer to server log for details, errorID='+req.id);
        return;
    } else if (keycount > 8) {
        console.error('req.id='+req.id+' req.query parameters: ' + JSON.stringify(req.query));
        res.send('ERROR: too many fields specified, errorID='+req.id);
        return;
    }


    var queryA = "\
    CREATE TABLE `"+tablename+"` (\n\
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,\n\
  `timestamp` datetime DEFAULT CURRENT_TIMESTAMP,\n";

    var queryB = "\
  PRIMARY KEY (`id`,`timestamp`),\n\
  UNIQUE KEY `id_UNIQUE` (`id`),\n\
  INDEX `timestamp` (`timestamp`)\n\
) ENGINE=InnoDB;";

    var query = queryA + queryX + queryB;
    req.query = query;
    console.info('req.id='+req.id+' SQL query: ' + req.query);
    sqlCreates++;
    next();
}, dbQuery);


// set data retention on table - TODO
app.post('/retention/:apikey([a-zA-Z0-9]+)/:sid([a-zA-Z0-9_-]+)/:limit', function (req, res, next) {
    var apikey = req.params.apikey;
    var varkey = req.params.varkey;
    var limit = hardLimit(req.params.limit, retentionLimit);

    var resp = 'TODO - mysql wizard wanted - marko.rizvic@gmail.com'

    console.info(resp);
    res.send(resp);
});

// storing telemetry data - fields with custom names - PREFERED USAGE
app.get('/update/:apikey([a-zA-Z0-9]+)/:sid([a-zA-Z0-9_-]+)', storeKVnew2, dbQuery);
app.post('/update/:apikey([a-zA-Z0-9]+)/:sid([a-zA-Z0-9_-]+)', storeKVnew2, dbQuery);

// storing telemetry data - fields with custom names - PREFERED USAGE
function storeKVnew2 (req, res, next) {
    var apikey = req.params.apikey;
    var sid = req.params.sid;
    var tablename = apikey + '_' + sid;
    var fcount = 0;
    var queryX = "";
    var queryY = "";
    var fparams = new Array();

    for (var key in req.query) {
        if (key == 'id') { continue; }
        var value = req.query[key]
        if (value.length < 1) { continue; }
        queryX += "`"+key+"`,";
        queryY += "'"+value+"',";
    }

    if ((queryX.length < 2) || (queryY.length < 2)) {
        console.error('req.id='+req.id+' req.query parameters: ' + JSON.stringify(req.query));
        res.send('ERROR: refer to server log for details, errorID='+req.id);
        return;
    }

    queryX = queryX.substring(0, queryX.length-1);
    queryY = queryY.substring(0, queryY.length-1);

    var query = 'INSERT INTO '+tablename+' ('+queryX+') VALUES ('+queryY+')';
    req.query = query;
    sqlInserts++;
    next();
}

// return all tables for specific apikey
app.get('/streams/:apikey([a-zA-Z0-9]+)', function (req, res, next) {
    var apikey = req.params.apikey;
    var query = 'SELECT TABLE_NAME AS result FROM information_schema.tables WHERE table_schema = DATABASE() AND TABLE_NAME LIKE "'+apikey+'_v%";';
    req.query = query;
    sqlSelects++;
    next();
}, dbQuery);

// fetch data from table limited by number of rows or interval
app.get('/fetch/:apikey([a-zA-Z0-9]+)/:sid([a-zA-Z0-9_-]+)/:limit(\-?\\d+[d|m|M|w|h]?)', function (req, res, next) {
    var apikey = req.params.apikey;
    var sid = req.params.sid;
    var fid = req.query.fid;
    var tablename = apikey + '_' + sid;
    var limit = req.params.limit;
    var orderby = getOrder(parseInt(limit));

    // if limit is numeric only
    if (!isNaN(limit)) {
        // limit to resultLimit to avoid resource exhaustion
        limit = hardLimit(req.params.limit, resultLimit);
        query = "SELECT * FROM " + tablename + " ORDER BY timestamp "+orderby+" LIMIT " + Math.abs(limit);
    // if limit contains characters according to routing regex
    } else {
        var suffix = limit.charAt(limit.length-1);
        var interval = limit.substring(0,limit.length-1);
        switch (suffix) {
            case "m": unit = "MINUTE"; break;
            case "h": unit = "HOUR"; break;
            case "d": unit = "DAY"; break;
            case "w": unit = "WEEK"; break;
            case "M": unit = "MONTH"; break;
        }

        query = "SELECT * FROM " + tablename + " WHERE timestamp >= DATE_SUB(NOW(),INTERVAL "+Math.abs(interval)+" "+unit+") ORDER BY timestamp "+orderby+" LIMIT "+resultLimit;
    }
    req.query = query;
    sqlSelects++;
    next();
}, dbQuery);

// fetch data from table for specific epoch interval
app.get('/fetch/:apikey([a-zA-Z0-9]+)/:sid([a-zA-Z0-9_-]+)/:from(\\d+)/:to(\\d+)', function (req, res, next) {
    var apikey = req.params.apikey;
    var sid = req.params.sid;
    var fid = req.query.fid;
    var tablename = apikey + '_' + sid;
    var from = req.params.from;
    var to = req.params.to;

    // query = "SELECT * FROM " + tablename + " WHERE `timestamp` BETWEEN FROM_UNIXTIME("+from+") AND FROM_UNIXTIME("+to+") ORDER BY timestamp ASC LIMIT "+resultLimit;
    query = "SELECT * FROM (SELECT * FROM " + tablename + " WHERE `timestamp` BETWEEN FROM_UNIXTIME("+from+") AND FROM_UNIXTIME("+to+") ORDER BY timestamp ASC LIMIT "+resultLimit+") sub ORDER BY timestamp DESC";
    req.query = query;
    sqlSelects++;
    next();
}, dbQuery);

var server = app.listen(port, host, function() {
    console.info('Listening at http://%s:%s', host, port)
});


// catch some signals
//process.on('exit', signalHandler);
process.on('SIGINT', signalHandler);
process.on('SIGHUP', signalHandler);
process.on('SIGTERM', signalHandler);

process.on('uncaughtException', function(err) {
    if (err.code == 'EADDRINUSE') {
        console.error('unable to listen on %s:%s , %s', host, port, err);
        process.exit(1);
    } else {
        console.error(err); 
    }
});
