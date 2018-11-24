const express = require('express');
const app = express();

const bq = require('@google-cloud/bigquery');

app.get('/api/test', (req, res) => {
    const customers = [
        {id: 1, key: 'Test'},
        {id: 2, key: 'this'},
        {id: 3, key: 'call'},
    ];

    res.json(customers);
});

app.get('/api/testbq', (req, res) => {
    const projectId = 'bigquery-public-data:chicago_crime';
    const bigquery = new BigQuery({
        projectId: projectId,
    });

    const sqlQuery = `SELECT * FROM \'bigquery-public-data.chicago_crime\' WHERE unique_key=\'` + req.key + `\'`;
    const options = {
        query: sqlQuery,
        useLegacySql: false, // Use standard SQL syntax for queries.
    };

    // Runs the query
    bigquery
        .query(options)
        .then(results => {
            const rows = results[0];
            console.log(rows);
            res.json(rows)
        })
        .catch(err => {
            console.error('ERROR:', err);
        });

});

const port = 5000;
app.listen(port, () => `Server running on port ${port}`);