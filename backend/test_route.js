import express from 'express';
const app = express();
const router = express.Router();
router.get('/land-preferences', (req, res) => res.send('matched exact!'));
router.get('/:deckId', (req, res, next) => {
    if (req.params.deckId === 'land-preferences') return next();
    res.send('matched param! ' + req.params.deckId);
});
const save = (req,res) => res.send('put matched');
router.put('/land-preferences', save);
app.use('/api/deck-updater', router);
app.get('*', (req, res) => res.status(404).send('Not Found'));
app.listen(9002, () => console.log('started'));
