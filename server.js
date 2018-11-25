const express = require('express');
const app = express();
const path = require('path');
let bodyParser     =        require("body-parser");
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const bq = require('@google-cloud/bigquery');

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname + '/public/index.html'));
});

/*
     Takes a request that contains an array of latitude, longitude coordinates and returns an
     array of crimes nearby each coordinate
     req format: {"coords": [{"latitude": 5.12312, "longitude": 5.432532}, {"latitude": 3.2135132, "longitude": 2.132145}]}
     res format: {"crimes": [1, 3]}
 */
app.post('/api/nearbyCrimes', (req, res) => {

    const projectId = "hackwestern2018";
    const bigquery = new bq.BigQuery({
        projectId: projectId,
        keyFilename: "C:\\Users\\nirmal\\Downloads\\hackwestern2018-c0ae9cd3b91b.json"
    });

    const output = [];
    console.log(req.body);


    req.coords.forEach(coord => {
        if (!coord.latitude || isNaN(coord.latitude)) {
            res.status(400);
            res.send("Bad latitude coordinate");
            return;
        }

        if (!coord.longitude || isNaN(coord.longitude)) {
            res.status(400);
            res.send("Bad longitude coordinate");
            return;
        }

        // Create a 1km box around our latitude/longitude (0.5km radius)
        // 0.008983 = 1km latitude
        // 0.015060 = 1km longitude
        latMin = coord.latitude - 0.0044915;
        latMax = coord.latitude + 0.0044915;
        lonMin = coord.longitude - 0.00753;
        lonMax = coord.longitude + 0.00753;

        const sqlQuery = `SELECT COUNT(*) AS count FROM \`hackwestern2018.chicago_crime.crime\` WHERE latitude>=${latMin} AND latitude<=${latMax} AND longitude>=${lonMin} AND longitude<=${lonMax} AND date BETWEEN \"2017-11-25\" AND \"2018-11-25\"`;

        bigquery.createQueryStream(sqlQuery)
            .on('error', console.error)
            .on('data', function (row) {
                output.push(row.count);
                console.log(row.count);
            })
            .on('end', function () {
                res.json({crimes: output})
            });
    });

});

const port = 5000;
app.listen(port, () => `Server running on port ${port}`);