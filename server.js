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
// On Vercel the project directory is read-only; /tmp is the only writable location
const DB_FILE = process.env.VERCEL
    ? '/tmp/db.json'
    : path.join(__dirname, 'db.json');

const DEFAULT_CATEGORIES = {
    'Учебники': ['Математика','Физика','Химия','Литература'],
    'Одежда': ['Детская','Взрослая','Спортивная'],
    'Мебель': ['Кровати','Стулья','Столы'],
    'Коляски': ['Детские','Велосипеды'],
    'Техника': ['Телефоны','Компьютеры','Бытовая'],
    'Игрушки': ['Плюшевые','Развивающие'],
    'Еда': ['Консервы','Снэки','Молоко'],
    'Лекарства': ['От простуды','Детские','Витамины'],
    'Билеты': ['Концерты','Театр','Кино']
};

let db = { users: [], items: [], categories: null };

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
if (!db.categories) db.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));

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
        return res.status(400).json({ error: 'Пользователь с таким телефоном уже существует' });
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
    if (!user) return res.status(400).json({ error:'Неверный телефон или пароль' });
    res.json({ user: { id: user.id, name: user.name, phone: user.phone } });
});

// categories
app.get('/api/categories', (req, res) => {
    res.json(db.categories);
});

app.post('/api/categories', (req, res) => {
    const { name, subcategories } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Название категории не может быть пустым' });
    }
    const trimmed = name.trim();
    if (db.categories[trimmed]) {
        return res.status(400).json({ error: 'Такая категория уже существует' });
    }
    db.categories[trimmed] = Array.isArray(subcategories) ? subcategories.map(s=>String(s).trim()).filter(Boolean) : [];
    try { saveDB(); } catch(e) { console.error('saveDB failed', e); return res.status(500).json({error:'Ошибка сохранения'}); }
    res.json(db.categories);
});

app.post('/api/categories/:name/subcategories', (req, res) => {
    const cat = decodeURIComponent(req.params.name);
    const { name } = req.body;
    if (!db.categories[cat]) return res.status(404).json({ error: 'Категория не найдена' });
    if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Название подкатегории не может быть пустым' });
    }
    const trimmed = name.trim();
    if (db.categories[cat].includes(trimmed)) {
        return res.status(400).json({ error: 'Такая подкатегория уже существует' });
    }
    db.categories[cat].push(trimmed);
    try { saveDB(); } catch(e) { console.error('saveDB failed', e); return res.status(500).json({error:'Ошибка сохранения'}); }
    res.json(db.categories);
});

// items
app.get('/api/items', (req, res) => {
    res.json(db.items);
});

app.post('/api/items', (req, res) => {
    const item = req.body;
    item.id = Date.now();
    db.items.unshift(item);
    try { saveDB(); } catch(e) { console.error('saveDB failed', e); }
    res.json(item);
});

app.put('/api/items/:id', (req, res) => {
    const id = Number(req.params.id);
    const idx = db.items.findIndex(i=>i.id===id);
    if (idx===-1) return res.status(404).end();
    db.items[idx] = { ...db.items[idx], ...req.body };
    try { saveDB(); } catch(e) { console.error('saveDB failed', e); }
    res.json(db.items[idx]);
});

app.delete('/api/items/:id', (req, res) => {
    const id = Number(req.params.id);
    db.items = db.items.filter(i=>i.id!==id);
    try { saveDB(); } catch(e) { console.error('saveDB failed', e); }
    res.json({ ok:true });
});

app.post('/api/book/:id', (req, res) => {
    const id = Number(req.params.id);
    const { phone } = req.body;
    const item = db.items.find(i=>i.id===id);
    if (!item) return res.status(404).end();
    item.bookedBy = normalizePhone(phone);
    try { saveDB(); } catch(e) { console.error('saveDB failed', e); }
    res.json(item);
});

app.post('/api/cancel/:id', (req, res) => {
    const id = Number(req.params.id);
    const item = db.items.find(i=>i.id===id);
    if (!item) return res.status(404).end();
    delete item.bookedBy;
    try { saveDB(); } catch(e) { console.error('saveDB failed', e); }
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
    try { saveDB(); } catch(e) { console.error('saveDB failed', e); }
    res.json({user: db.users[idx]});
});

app.delete('/api/users/:id', (req,res)=>{
    const id = Number(req.params.id);
    db.users = db.users.filter(u=>u.id!==id);
    try { saveDB(); } catch(e) { console.error('saveDB failed', e); }
    res.json({ok:true});
});

// export app for @vercel/node; start server only in local/non-serverless environments
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
    });
}

module.exports = app;
