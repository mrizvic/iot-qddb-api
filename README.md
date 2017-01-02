# IoT QDDB - Od senzorja do grafa

## Language
Im writing this in Slovenian language because its initial release and will be anounced in Slovenian technical forum https://s5tech.net/ So this version is release candidate. Im looking for volunteer to write this README in English :)
*Read this in other languages: [Slovenian](README-SI.md)

## Project name
Internet of things quick and dirty database. This name is derived from my other project https://github.com/mrizvic/js-qddb . This time I implemented data persistence with MySQL and exposed WEB API interface for storing and retrieving multiple datasets at once. This project also includes HTML/CSS/JS code which is used to fetch historic data from database and plot multiple graphs at once to visualize data.

## What is it
In the process of setting up IoT sensors we usually measure physical quantities (temperature, humidity, voltage, brightness, loudness...). Most of the time the sensors are measuring and pushing telemetry data to some storage for later analysis. FOr this purpose there are quite few public web services of which some are free to use or not. In both cases our sensors need to push data to some third party storage. As this is not always welcome I wrote myself this IoT QDDB software that offers HTTP RESTful API interface through which you can create so-called stream for each sensor which will periodically store telemetry data and ultimately those values can be shown on graph for different periods of time.

## Requirements
This tutorial is written for setting up on Raspberry Pi's popular debian based distro. However it is nothing special and in general it SHOULD work on any popular Linux distro. All you need are some basic skills of running and managing software packages. Basic knowledge of TCPIP is also very welcome. Basically for running this project you need mysql, nodejs and a software which can manipulate foreground process and run it in background as daemon. I use supervisord on Linux.

## Installation

### Required packages
```
apt-get install curl mysql-server nodejs npm supervisor
```

### MySQL setup
During installation of mysql package we are asked to define root password. For the purpose of this tutorial I entered `mysqlROOTgeslo`.
After installation is complete we can create new user and database for storing our IoT data.
```
pi@raspberrypi:~ $ mysql -u root -p
Enter password: mysqlROOTgeslo <- this is not echoed back to terminal, just type it in and hit enter
Welcome to the MySQL monitor.  Commands end with ; or \g.
Your MySQL connection id is 44
Server version: 5.5.53-0+deb8u1 (Debian)

Copyright (c) 2000, 2016, Oracle and/or its affiliates. All rights reserved.

Oracle is a registered trademark of Oracle Corporation and/or its
affiliates. Other names may be trademarks of their respective
owners.

Type 'help;' or '\h' for help. Type '\c' to clear the current input statement.

mysql> CREATE DATABASE iotDB;
Query OK, 1 row affected (0.00 sec)

mysql> CREATE USER 'iotDBadmin'@'localhost' IDENTIFIED BY 'IOTsecretPASS';
Query OK, 0 rows affected (0.00 sec)

mysql> GRANT CREATE,DROP,SELECT,INSERT,DELETE ON iotDB.* TO 'iotDBadmin'@'localhost';
Query OK, 0 rows affected (0.00 sec)

mysql> FLUSH PRIVILEGES;
Query OK, 0 rows affected (0.01 sec)

<< pritisni CTRL+C >>
```

### Installing iot-qddb-api package
```
pi@raspberrypi:~ $ git clone https://github.com/mrizvic/iot-qddb-api.git

pi@raspberrypi:~ $ cd iot-qddb-api

pi@raspberrypi:~/iot-qddb-api $ npm install

pi@raspberrypi:~/iot-qddb-api $ echo <<EOF > dbConfig.js
var dbConfig = {
    database: 'iotDB',
    host: 'localhost',
    port: 3306,
    user: 'iotDBadmin',
    password: 'IOTsecretPASS',
    connectionLimit: 8
};

module.exports.dbConfig = dbConfig;
<< hit CTRL+D >>
EOF
```

### Running iot-qddb-api
#### Manually in foreground
This is useful for debugging and observing whats happening.
```
pi@raspberrypi:~/iot-qddb-api $ APP_MODE=prod APP_HOST=127.0.0.1 APP_PORT=8008 APP_PUBDIR=static nodejs iot-qddb-api.js
```

#### Automatically at system startup
```
pi@raspberrypi:~/iot-qddb-api $ sudo cp supervisor-iot-qddb-api.conf /etc/supervisor/conf.d/iot-qddb-api.conf
pi@raspberrypi:~/iot-qddb-api $ sudo supervisorctl 'reread'
pi@raspberrypi:~/iot-qddb-api $ sudo supervisorctl 'add iot-qddb-api'
pi@raspberrypi:~/iot-qddb-api $ sudo supervisorctl 'start iot-qddb-api'
pi@raspberrypi:~/iot-qddb-api $ sudo supervisorctl 'status'
```

## Saving telemetry data

### API key
Current implementation permits user to think of its own api key. For example we can define api key as username which then holds telemetry data from our sensors in separated streams. This is simply a string of reasonable length. For the purpose of this tutorial I used api key `iotdemo`

### Creating new stream
When we got ourselves api key its time to create new data stream which will hold telemetry data from specific sensor. We need to define new name and specify names of data fields which are used to hold sensoric data. For example lets assume we have DHT22 sensor which will send temperature and humidity. So lets create stream named dht22_1 and specify two fields named  named `temp` and `rh` for data storage. We are allowed to specify maximum 8 fields. So again we assume our api key is `iotdemo` and create new stream.

```
curl -s -X POST "http://127.0.0.1:8008/create/iotdemo/dht22_1?temp&rh"
```

### Stream information

We can always get stream information by making this call
```
curl -s -X GET "http://127.0.0.1:8008/info/iotdemo/dht22_1"
```

Result is in JSON format and holds name of fields in stream called `dht22_1`:
```
[{"result":"temp,rh"}]
```

### Storing telemetry data

At this point we have new stream so we can begin to periodicaly send data to our database

```
curl -s -X POST "http://127.0.0.1:8008/update/iotdemo/dht22_1?temp=22&rh=33"
(1 minute pause)
curl -s -X POST "http://127.0.0.1:8008/update/iotdemo/dht22_1?temp=22.5&rh=34"
(1 minute pause)
curl -s -X POST "http://127.0.0.1:8008/update/iotdemo/dht22_1?temp=23&rh=34.5"
(1 minute pause)
curl -s -X POST "http://127.0.0.1:8008/update/iotdemo/dht22_1?temp=24&rh=35"
(1 minute pause)
...
```

### Deleting stream

Stream can be irrevocably deleted which also deletes telemetry data that is hold in that stream
```
curl -X POST http://127.0.0.1:8008/delete/iotdemo/dht22_1
```

## Reading telemetry data

### Read last N records

Last record
```
curl -s -X GET "http://127.0.0.1:8008/fetch/iotdemo/dht22_1/1"
```

Last seven records, descending according to timestamp
```
curl -s -X GET "http://127.0.0.1:8008/fetch/iotdemo/dht22_1/7"
```

### Reading with specified period

Retrieve records that were stored in last 10 minutes, hours, days, weeks, months. Results are return descending according to timestamp.
```
curl -s -X GET "http://127.0.0.1:8008/fetch/iotdemo/dht22_1/10m"
curl -s -X GET "http://127.0.0.1:8008/fetch/iotdemo/dht22_1/10h"
curl -s -X GET "http://127.0.0.1:8008/fetch/iotdemo/dht22_1/10d"
curl -s -X GET "http://127.0.0.1:8008/fetch/iotdemo/dht22_1/10w"
curl -s -X GET "http://127.0.0.1:8008/fetch/iotdemo/dht22_1/10M"
```

Retrieve records that were stored between epoch 1482836101 and 1482836701. Results are return descending according to timestamp.
```
curl -s -X GET "http://127.0.0.1:8008/fetch/iotdemo/dht22_1/1482836101/1482836701
```

## Data visualisation

In order to visualise data we stored so far we need to call following URL:
```
http://127.0.0.1:8008/static/?apikey=iotdemo&sid=dht22_1&fid=12&limit=1d
```

URL accepts following parameters:

*apikey = user-specific api key

*sid = stream name which holds telemetry data that we want to visualise

fid = which fields do we want to visualise. For example fid=123 will produce graphs for first three fields in specified stream. Please note that order amtters, for example: fid=231 will draw second field on first graph, third field on sencod graph and first field on third graph (default: fid=1)

*limit = this specifies period for which we want to visualise data. If limit is numeric only then it will retrieve that number of records and visualise them. If we add suffix to that number then the suffix defines human readable period. For example limit=30h means period of last 30 hours and limit=4d means period of last 4 days. For details refer to `Reading with specified period`. Please note that regardless of defined period number of retrieved records cannot exceed 25000. However this is hardcoded but can be changed.

theme = there are predefined color schemes for data visualisation. At the moment the buildin values are `casualgreen`, `casualred`, `casualblue`, `jaffagold`, `jaffalight`, `jaffadark`, `blackboard`, `termgreen`, `termyellow`, `termred`, `dmzgreen`, `dmzyellow`, `dmzblue`, `dmzred`, `dmzgrey`, `sunblue`, `sunred`. Please note that the following three URL parameters can override settings that are used within specific theme. (default: `casualgreen`)

color = which color is used to draw series on graph (color=ff0000 for red)

bgcolor = background color (bgcolor=ffffff for white)

fgcolor = this color is used for labels X and Y axis, graph title and legend titles (fgcolor=000000 for black)

height = graph height in px (default: `300`)

width = graph width v px (default: `98%`)


Parameters marked with asterisk * are mandatory. Non mandatory parameters have their respective default values written in brackets

## Examples

Some crafted URL for data visualisation:
```
http://127.0.0.1:8008/static/?apikey=iotdemo&sid=dht22_soba&fid=12&limit=5d
http://127.0.0.1:8008/static/?apikey=iotdemo&sid=dht22_terasa&fid=1&limit=2d&theme=jaffalight
http://127.0.0.1:8008/static/?apikey=iotdemo&sid=raspberrypi&fid=123&height=350&limit=8h&theme=blackboard
http://127.0.0.1:8008/static/?apikey=iotdemo&sid=server&fid=123&height=350&limit=8h&theme=blackboard&color=00ffff
```

## Graph navigation

When graph rendering is complete we can highlight the point which we want to read. The legend will follow cursor movement. We can zoom-in in two ways. First way is to click and drag an area in the graf. After releasing click button graph will zoom into that area. Second way is to drag border of sliding window beneath each graph. In the beginning the window is spanned across the whole area. If we shring the borders on the left and the right side of sliding window the graph begins to zoom into spanned window - timeslot. When we have shrunked sliding window we can drag it left and right along the graph to review data series in details. Zoom-out effect can be achieved by double clicking anywhere on graph or by extending window size back to maximum.


## FAQ

1Q) When I make HTTP call `POST /update/iotdemo/sensor1?temper=11.1` it returns error message stating `ERROR: BAD_FIELD`

1A) check field names for sensor1 by making HTTP call `GET /info/iotdemo/senzor1`



2Q) When calling `GET /info/iotdemo/sensor1` the result is empty JSON array `{}`

2A) There is no data for apikey `iotdemo` and stream `sensor1`





<!--

Zadnji vnos
GET /fetch/$APIKEY/$SID/1

Zadnjih 10 vnosov padajoce
GET /fetch/$APIKEY/$SID/10

Vsi vnosi v roku zadnjih 10 minut,ur,dni,tednov,mesecev padajoce
GET /fetch/$APIKEY/$SID/10m
GET /fetch/$APIKEY/$SID/10h
GET /fetch/$APIKEY/$SID/10d
GET /fetch/$APIKEY/$SID/10w
GET /fetch/$APIKEY/$SID/10M

Prvih 10 vnosov narascajoce
GET /fetch/$APIKEY/$SID/-10

Vsi vnosi med epoch 1482836101 in 1482836701 narascajoce
GET /fetch/$APIKEY/$SID/1482836101/1482836701



Brisi vse vnose
DELETE /apikey_v1/aa
Brisi prvih 10 vnosov
DELETE /apikey_v1/aa/10
Brisi zadnjih 10 vnosov
DELETE /apikey_v1/aa/-10
Brisi vse vnose med epoch 200 in 300
DELETE /apikey_v1/aa/200/300

Vrne vse streame, ki jih ima nek api
GET /streams/apikey

Shrani vrednosti
GET  /update/apikey/stream?f1=&f2=&f3=...
POST /update/apikey/stream?f1=&f2=&f3=...

Generira nov api key in nov stream v katerega lahko shranjujes 3 vrednosti
POST /create/apikey/stream/3

curl -s -X POST "http://127.0.0.1:8008/create/iotdemo/senzor1?temp&vlaga&svetloba&napetost"




Brise podatke 
POST /delete/apikey/stream

Nastavi retention - TODO, not implemented
POST /retention/apikey/stream/days

CREATE TABLE `test` (
	`id` int(10) unsigned NOT NULL AUTO_INCREMENT,
	`timestamp` datetime DEFAULT CURRENT_TIMESTAMP,
	`f1` varchar(10) DEFAULT NULL,
	`f2` varchar(10) DEFAULT NULL,
	`f3` varchar(10) DEFAULT NULL,
	PRIMARY KEY (`id`,`timestamp`),
	UNIQUE KEY `id_UNIQUE` (`id`),
	KEY `timestamp` (`timestamp`)
) ENGINE=InnoDB;


/*
CREATE TABLE `apikey_sid1` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `timestamp` datetime DEFAULT CURRENT_TIMESTAMP,
  `f1` varchar(10) NULL,
  `f2` varchar(10) NULL,
  `f3` varchar(10) NULL,
  `f4` varchar(10) NULL,
  `f5` varchar(10) NULL,
  `f6` varchar(10) NULL,
  `f7` varchar(10) NULL,
  `f8` varchar(10) NULL,
  PRIMARY KEY (`id`,`timestamp`),
  UNIQUE KEY `id_UNIQUE` (`id`),
  INDEX `timestamp` (`timestamp`)
) ENGINE=InnoDB;
*/



CREATE DEFINER = CURRENT_USER TRIGGER `qddb1`.`new_table_AFTER_INSERT` AFTER INSERT ON `new_table` FOR EACH ROW
BEGIN
	SET @newid = NEW.id;
    IF (@newid % 10 == 0) THEN
		DELETE FROM `new_table` WHERE `new_table`.timestamp < DATE_SUB(NOW(), INTERVAL 10 SECONDS);
	END IF;
END

DELIMITER $$
CREATE DEFINER = CURRENT_USER TRIGGER `38EABF4E69_100492_AFTER_INSERT` AFTER INSERT ON `38EABF4E69_100492` FOR EACH ROW
BEGIN
	SET @newid = NEW.id;
	IF (@newid % 10 == 0) THEN
		DELETE FROM `38EABF4E69_100492` WHERE timestamp < DATE_SUB(NOW(), INTERVAL 10 SECONDS);
	END IF;
END$$
DELIMITER ;

 -->
