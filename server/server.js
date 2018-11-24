const express = require('express');

const app = express();

app.get('/api/test', (req, res) => {
    const customers = [
        {id: 1, key: 'Test'},
        {id: 2, key: 'this'},
        {id: 3, key: 'call'},
    ];

    res.json(customers);
});

const port = 5000;
app.listen(port, () => `Server running on port ${port}`);