const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');

// load .env so we can read API key
require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname)); // serve all files in project as static

// simple JSON storage
const DB_FILE = path.join(__dirname, 'db.json');
let db = { users: [], items: [] };

function loadDB() {
    if (fs.existsSync(DB_FILE)) {
        try {
            db = JSON.parse(fs.readFileSync(DB_FILE));
        } catch (e) {
            console.error('Failed to load db', e);
        }
    }
}
function saveDB() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}
loadDB();
// ensure arrays always exist in case db.json is corrupted, partial, or manually edited
db.users = db.users || [];
db.items = db.items || [];

// helpers
function normalizePhone(p) {
    if (!p) return '';
    let digits = p.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('8')) digits = '7' + digits.slice(1);
    if (digits.length === 10) digits = '7' + digits;
    return digits;
}

// routes
app.post('/api/register', (req, res) => {
    const { name, phone, password, address, availability, addressDetails } = req.body;
    const norm = normalizePhone(phone);
    if (db.users.find(u=>normalizePhone(u.phone) === norm)) {
        return res.status(400).json({ error: 'User exists' });
    }
    const user = { id: Date.now(), name, phone: norm, password, address, availability, addressDetails };
    db.users.push(user);
    try {
        saveDB();
    } catch(e) {
        db.users.pop();
        console.error('saveDB failed', e);
        return res.status(500).json({ error: 'Ошибка сохранения данных' });
    }
    res.json({ user: { id: user.id, name: user.name, phone: user.phone } });
});

app.post('/api/login', (req, res) => {
    const { phone, password } = req.body;
    const norm = normalizePhone(phone);
    const user = db.users.find(u=>normalizePhone(u.phone)===norm && u.password===password);
    if (!user) return res.status(400).json({ error:'Invalid credentials' });
    res.json({ user: { id: user.id, name: user.name, phone: user.phone } });
});

// items
app.get('/api/items', (req, res) => {
    res.json(db.items);
});

app.post('/api/items', (req, res) => {
    const item = req.body;
    item.id = Date.now();
    db.items.unshift(item);
    saveDB();
    res.json(item);
});

app.put('/api/items/:id', (req, res) => {
    const id = Number(req.params.id);
    const idx = db.items.findIndex(i=>i.id===id);
    if (idx===-1) return res.status(404).end();
    db.items[idx] = { ...db.items[idx], ...req.body };
    saveDB();
    res.json(db.items[idx]);
});

app.delete('/api/items/:id', (req, res) => {
    const id = Number(req.params.id);
    db.items = db.items.filter(i=>i.id!==id);
    saveDB();
    res.json({ ok:true });
});

app.post('/api/book/:id', (req, res) => {
    const id = Number(req.params.id);
    const { phone } = req.body;
    const item = db.items.find(i=>i.id===id);
    if (!item) return res.status(404).end();
    item.bookedBy = normalizePhone(phone);
    saveDB();
    res.json(item);
});

app.post('/api/cancel/:id', (req, res) => {
    const id = Number(req.params.id);
    const item = db.items.find(i=>i.id===id);
    if (!item) return res.status(404).end();
    delete item.bookedBy;
    saveDB();
    res.json(item);
});

// geocode helper route – бэкенд прокси для хранения API‑ключа
app.get('/api/geocode', async (req, res) => {
    const q = req.query.q;
    if (!q) return res.status(400).json({error:'missing query'});
    const key = process.env.YANDEX_MAPS_API_KEY;
    try {
        const url = `https://geocode-maps.yandex.ru/1.x/?apikey=${encodeURIComponent(key)}&format=json&geocode=${encodeURIComponent(q)}&results=5`;
        const resp = await fetch(url);
        const data = await resp.json();
        const features = data.response?.GeoObjectCollection?.featureMember || [];
        const out = features.map(f => {
            const meta = f.GeoObject.metaDataProperty.GeocoderMetaData;
            const text = meta.text;
            const pos = f.GeoObject.Point.pos.split(' ');
            const coords = [Number(pos[1]), Number(pos[0])];
            return {text, coords};
        });
        res.json(out);
    } catch (e) {
        console.error('geocode error', e);
        res.status(500).json({error:'geocode failed'});
    }
});

// user update
app.put('/api/users/:id', (req,res)=>{
    const id = Number(req.params.id);
    const idx = db.users.findIndex(u=>u.id===id);
    if (idx===-1) return res.status(404).end();
    db.users[idx] = {...db.users[idx], ...req.body};
    saveDB();
    res.json({user: db.users[idx]});
});

app.delete('/api/users/:id', (req,res)=>{
    const id = Number(req.params.id);
    db.users = db.users.filter(u=>u.id!==id);
    saveDB();
    res.json({ok:true});
});

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
