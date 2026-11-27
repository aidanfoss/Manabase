import express from 'express';
const app = express();
const router = express.Router();
router.put('/land-preferences', (req, res) => res.send('PUT MATCHED'));
app.use('/api/deck-updater', router);
app.listen(9006, () => console.log('started'));
