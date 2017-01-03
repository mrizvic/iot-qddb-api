# IoT QDDB - Od senzorja do grafa

## Language
Im writing this in Slovenian language because its initial release and will be anounced in Slovenian technical forum https://s5tech.net/ So this version is release candidate. Im looking for volunteer to write this README in English :)

## Visualisation demo
[![Youtube](https://img.youtube.com/vi/OvDfQiCRgYg/0.jpg)](https://www.youtube.com/watch?v=OvDfQiCRgYg)

## Ime
Internet of things quick and dirty database. Ime izvira iz projekta https://github.com/mrizvic/js-qddb . K temu sem dodal shranjevanje podatkov v bazo MySQL ter izpostavil WEB API klice s katerimi v bazo lahko shranjujemo vec vrednosti naenkrat za posamezen senzor ali napravo. Dodana je tudi HTML/CSS/JS koda s katero iz MySQL baze pridobimo vrednosti za doloceno obdobje ter jih prikazemo na grafu. 

## Namen
V okviru IoT postavitev senzorjev ponavadi merimo neke fizikalne kolicine (temperatura, vlaga, napetost, svetloba, glasnost, ...) katere zelimo shraniti v bazo za kasnejso obdelavo. V ta namen nam je na voljo kar nekaj spletnih servisov. Le-ti so brezplacni ali placljivi. V obeh primerih pa imajo skupni imenovalec - svoje podatke oziroma telemetrijo posiljamo na internet. To pa ni vedno dobrodoslo. Zaradi tega je nastal projekt IOT QDDB - quick and dirty database za IoT. Program ponuja WEB API vmesnik preko katerega lahko kreiramo t.i. stream za nek senzor v katerega potem periodicno shranjujemo vrednosti in nenazadnje vrednosti prikazujemo na grafu za razlicna casovna obdobja. 

## Zahteve
Navodila so pisana za namestitev iot-qddb-api na Raspberry Pi.
Sicer bi moralo delovati na kateremkoli linux sistemu, ki so sposobni poganjati mysql, nodejs ter program, ki skrbi za delovanje iot-qddb-api programa v ozadju. Sam za ta namen uporabljam supervisord.

Za namestitev je zazeljeno tudi poznavanje TCPIP protokolnega sklada ter poznavanje okolja Linux. Torej kaj je IP, port, kaksen IP je 127.0.0.1, kaj je HTTP, namescanje in zaganjanje programov v Linuxu.

## Namestitev

### Programski paketi
```
apt-get install curl mysql-server nodejs npm supervisor
```

### Podatkovna baza MySQL
Med instalacijo MySQL nas setup program vprasa kaksno root geslo zelimo nastaviti. Za potrebe pisanaja dokumentacije sem root geslo nastavil na `mysqlROOTgeslo`

Kreiramo novo mysql bazo za nase potrebe:
```
pi@raspberrypi:~ $ mysql -u root -p
Enter password: mysqlROOTgeslo <- se ne izpisuje
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

### Namestitev iot-qddb-api programa
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
<< pritisni CTRL+D >>
EOF
```

### Zagon iot-qddb-api programa
#### Rocno
```
pi@raspberrypi:~/iot-qddb-api $ APP_MODE=dev APP_HOST=127.0.0.1 APP_PORT=8008 APP_PUBDIR=static nodejs iot-qddb-api.js
```

#### Samodejno ob ponovnem zagonu
```
pi@raspberrypi:~/iot-qddb-api $ sudo cp supervisor-iot-qddb-api.conf /etc/supervisor/conf.d/iot-qddb-api.conf
pi@raspberrypi:~/iot-qddb-api $ sudo supervisorctl 'reread'
pi@raspberrypi:~/iot-qddb-api $ sudo supervisorctl 'add iot-qddb-api'
pi@raspberrypi:~/iot-qddb-api $ sudo supervisorctl 'start iot-qddb-api'
pi@raspberrypi:~/iot-qddb-api $ sudo supervisorctl 'status'
```

## Shranjevanje podatkov v bazo

### Avtentikacijski kljuc
Trenutna implementacija je taksna, da si avtentikacijski kljuc izmislimo sami. Za boljsi obcutek si predstavljajmo, da je to uporabnisko ime pod katerim bodo shranjene vrednosti iz senzorjev. Zmislimo si torej string, ki naj ne bo predolg. Za potrebe pisanja dokumentacije sem si zmislil api key `iotdemo`.

### Ustvarjanje novega streama

Ko pridobimo avtentikacijski kljuc (apikey) je potrebno ustvariti nov podatkovni tok (stream) v katerega bomo shranjevali vrednosti. Pri tem moramo podati tudi imena polj, ki jih zelimo shranjevati. Za primer vzemimo, da bomo shranjevali podatke o temperaturi in vlagi iz senzorja DHT22. Kreiramo stream z imenom dht22_1 ter podamo argumenta `temp` in `rh` s katerima oznacimo polje za temperaturo ter vlago. Kreiramo lahko do 8 polj. Za primer vzemimo, da ima nas apikey vrednost `iotdemo`

```
curl -s -X POST "http://127.0.0.1:8008/create/iotdemo/dht22_1?temp&rh"
```

### Informacije o streamu

Informacijo o streamu lahko kadarkoli dobimo s klicem
```
curl -s -X GET "http://127.0.0.1:8008/info/iotdemo/senzor2"
```

V rezultatu dobimo imena podatkovnih polj, ki smo jih podali ob kreiranju streama:
```
[{"result":"temp,rh"}]
```

### Periodicno vpisovanje meritev

Sedaj, ko imamo stream lahko pricnemo s periodicnim vpisovanjem vrednosti:

```
curl -s -X POST "http://127.0.0.1:8008/update/iotdemo/dht22_1?temp=22&rh=33"
curl -s -X POST "http://127.0.0.1:8008/update/iotdemo/dht22_1?temp=22.5&rh=34"
curl -s -X POST "http://127.0.0.1:8008/update/iotdemo/dht22_1?temp=23&rh=34.5"
curl -s -X POST "http://127.0.0.1:8008/update/iotdemo/dht22_1?temp=24&rh=35"
```

### Brisanje streama

Stream lahko tudi nepreklicno brisemo oziroma unicimo pri cemer se zbrisejo tudi vsi zapisi
```
curl -X POST http://127.0.0.1:8008/delete/iotdemo/dht22_1
```

## Branje podatkov

### Branje z izbiro stevila vnosov

Zadnji vnos
```
curl -s -X GET "http://127.0.0.1:8008/fetch/iotdemo/dht22_1/1"
```

Zadnjih sedem vnosov, padajoce glede na cas vpisa
```
curl -s -X GET "http://127.0.0.1:8008/fetch/iotdemo/dht22_1/7"
```

### Branje z izbiro obdobja

Vnosi v roku zadnjih 10 minut,ur,dni,tednov,mesecev padajoce glede na cas vpisa
```
curl -s -X GET "http://127.0.0.1:8008/fetch/iotdemo/dht22_1/10m"
curl -s -X GET "http://127.0.0.1:8008/fetch/iotdemo/dht22_1/10h"
curl -s -X GET "http://127.0.0.1:8008/fetch/iotdemo/dht22_1/10d"
curl -s -X GET "http://127.0.0.1:8008/fetch/iotdemo/dht22_1/10w"
curl -s -X GET "http://127.0.0.1:8008/fetch/iotdemo/dht22_1/10M"
```

Vnosi vpisani med epoch obdobjem 1482836101 in 1482836701 padajoce glede na cas vpisa
```
curl -s -X GET "http://127.0.0.1:8008/fetch/iotdemo/dht22_1/1482836101/1482836701
```

## Risanje grafov

URL klic za risanje grafov je naslednji:
```
http://127.0.0.1:8008/static/?apikey=iotdemo&sid=dht22_1&fid=12&limit=1d
```

URL sprejme naslednje parametre:

*apikey = uporabnikov api kljuc

*sid = ime streama v katerem se nahajajo meritve katere zelimo spraviti na graf

fid = za katera polja zelimo imeti graf. Npr fid=123 narise graf za prva tri polja. Ce zamenjamo vrstni red se zamenja tudi vrstni red grafov, npr: fid=231. (default: fid=1)

*limit = obdobje za katerega zelimo graf. Ce podamo stevilo n (brez suffix znaka) potem dobimo zadnjih n zapisov iz streama glede na timestamp. Ce uporabimo katerega od spodaj nastetih suffixov potem dobimo vrednosti v dolocenem obdobju, npr limit=30h pomeni obdobje 30 ur, limit=4d pomeni 4 dni. Za podrobnosti glej `Branje z izbiro obdobja`. OPOMBA: ne glede na obdobje velja omejitev, da nikoli ne dobimo vec kot 25000 zapisov naenkrat.

theme = s tem parametrom poimensko poklicem prednastavljeno barvno shemo. Mozne vrednosti so: `casualgreen`, `casualred`, `casualblue`, `jaffagold`, `jaffalight`, `jaffadark`, `blackboard`, `termgreen`, `termyellow`, `termred`, `dmzgreen`, `dmzyellow`, `dmzblue`, `dmzred`, `dmzgrey`, `sunblue`, `sunred`. OPOMBA: Spodnji trije parametri povozijo nastavitve, ki so znotraj parametra `theme`. (default: `casualgreen`)

color = barva s katero naj bodo narisane vrednosti na grafu (npr: color=ff0000 ce zelimo rdeco)

bgcolor = barva ozadja na grafu (npr: bgcolor=ffffff ce zelimo belo)

fgcolor = barva napisov na oseh X in Y, naslov grafa ter v legendi (npr: fgcolor=000000 ce zelimo crno)

height = visina grafa v px (default: `300`)

width = sirina grafa v px (default: `98%`)


Parametri oznaceni z zvezdico so obvezni. Za ostale so privzete vrednosti napisane v oklepajih.

## Primeri

Nekaj primerov URL za risanje grafov:
```
http://127.0.0.1:8008/static/?apikey=iotdemo&sid=dht22_soba&fid=12&limit=5d
http://127.0.0.1:8008/static/?apikey=iotdemo&sid=dht22_terasa&fid=1&limit=2d&theme=jaffalight
http://127.0.0.1:8008/static/?apikey=iotdemo&sid=raspberrypi&fid=123&height=350&limit=8h&theme=blackboard
http://127.0.0.1:8008/static/?apikey=iotdemo&sid=streznik&fid=123&height=350&limit=8h&theme=blackboard&color=00ffff
```

## Navigacija po grafu

Ko je graf izrisan se lahko posamezne vrednosti odcitajo s postavitvijo kurzorja na graf. Legenda sledi premikanju kurzorja. Na grafu imamo moznost zoom-in efekta in sicer na dva nacina. Prvi je, da s klikom vlecemo po grafu. S tem oznacimo del katerega zelimo povecati. Drugi nacin je, da premikamo drsnik, ki se nahaja spodaj pod vsakim grafom. Na zacetku je okno drsnika postavljeno cez cel graf. Ce robove okna povlecemo proti notranjosti se na grafu prikazejo le tiste vrednosti, ki so v nastavljeno casovnem oknu. Tako nastavljen drsnik pod grafom lahko vlecemo levo ali desno. S tem se pomikamo po grafu naprej in nazaj. Ucinek zoom-out dosezemo z dvoklikom na graf ali s pomikom stranic drsnika skrajno levo in skrajno desno.


## FAQ

1Q) pri klicu /update/iotdemo/senzor?temper=11.1 dobim sporocilo o napaki `ERROR: BAD_FIELD`

1A) preveri imena polj za senzor1 s klicem: GET /info/iotdemo/senzor1



2Q) pri klicu GET /info/iotdemo/senzor1 dobim kot rezultat `{}`

2A) apikey iotdemo nima podatkov o tabeli senzor1

