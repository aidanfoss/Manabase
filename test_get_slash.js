import express from 'express';
const app = express();
const router = express.Router();
router.get('/land-preferences', (req, res) => res.send('matched exact!'));
router.get('/:deckId', (req, res, next) => {
    if (req.params.deckId === 'land-preferences') return res.status(404).send('Deck not found');
    res.send('matched param! ' + req.params.deckId);
});
app.use('/api/deck-updater', router);
app.listen(9007, () => console.log('started'));
