
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./firestore'); // Используем firestore

require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// Инициализация категорий, если их еще нет
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

const categoriesRef = db.collection('categories').doc('all');
categoriesRef.get().then((doc) => {
    if (!doc.exists) {
        categoriesRef.set(DEFAULT_CATEGORIES);
    }
});


// helpers
function normalizePhone(p) {
    if (!p) return '';
    let digits = p.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('8')) digits = '7' + digits.slice(1);
    if (digits.length === 10) digits = '7' + digits;
    return digits;
}

// routes
app.post('/api/register', async (req, res) => {
    const { name, phone, password, address, availability, addressDetails } = req.body;
    const normPhone = normalizePhone(phone);
    try {
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('phone', '==', normPhone).get();
        if (!snapshot.empty) {
            return res.status(400).json({ error: 'Пользователь с таким телефоном уже существует' });
        }
        const userRef = await usersRef.add({ name, phone: normPhone, password, address, availability, addressDetails });
        res.json({ user: { id: userRef.id, name, phone: normPhone } });
    } catch (error) {
        console.error("Error registering user: ", error);
        res.status(500).json({ error: 'Ошибка сохранения данных' });
    }
});

app.post('/api/login', async (req, res) => {
    const { phone, password } = req.body;
    const normPhone = normalizePhone(phone);
    try {
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('phone', '==', normPhone).where('password', '==', password).get();
        if (snapshot.empty) {
            return res.status(400).json({ error: 'Неверный телефон или пароль' });
        }
        const userDoc = snapshot.docs[0];
        const user = { id: userDoc.id, ...userDoc.data() };
        res.json({ user: { id: user.id, name: user.name, phone: user.phone } });
    } catch (error) {
        console.error("Error logging in: ", error);
        res.status(500).json({ error: 'Ошибка входа' });
    }
});

// categories
app.get('/api/categories', async (req, res) => {
    try {
        const doc = await categoriesRef.get();
        if (!doc.exists) {
            return res.status(404).json({ error: 'Категории не найдены' });
        }
        res.json(doc.data());
    } catch (error) {
        res.status(500).json({ error: 'Ошибка получения категорий' });
    }
});

app.post('/api/categories', async (req, res) => {
    const { name, subcategories } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Название категории не может быть пустым' });
    }
    const trimmedName = name.trim();
    try {
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(categoriesRef);
            if (!doc.exists) {
                throw "Document does not exist!";
            }
            const data = doc.data();
            if (data[trimmedName]) {
                 return res.status(400).json({ error: 'Такая категория уже существует' });
            }
            const newCategories = { ...data, [trimmedName]: subcategories || [] };
            transaction.set(categoriesRef, newCategories);
            res.json(newCategories);
        });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сохранения' });
    }
});

// items
app.get('/api/items', async (req, res) => {
    try {
        const itemsRef = db.collection('items');
        const snapshot = await itemsRef.orderBy('createdAt', 'desc').get();
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(items);
    } catch (error) {
        res.status(500).json({ error: 'Ошибка получения' });
    }
});

app.post('/api/items', async (req, res) => {
    try {
        const newItem = { ...req.body, createdAt: new Date() };
        const docRef = await db.collection('items').add(newItem);
        res.json({ id: docRef.id, ...newItem });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сохранения' });
    }
});

app.put('/api/items/:id', async (req, res) => {
    try {
        const itemId = req.params.id;
        await db.collection('items').doc(itemId).update(req.body);
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка сохранения' });
    }
});

app.delete('/api/items/:id', async (req, res) => {
    try {
        await db.collection('items').doc(req.params.id).delete();
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка удаления' });
    }
});

app.post('/api/book/:id', async (req, res) => {
    try {
        const itemId = req.params.id;
        const { phone } = req.body;
        const normPhone = normalizePhone(phone);
        await db.collection('items').doc(itemId).update({ bookedBy: normPhone });
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка бронирования' });
    }
});

app.post('/api/cancel/:id', async (req, res) => {
    try {
        const itemId = req.params.id;
        const { FieldValue } = require('firebase-admin/firestore');
        await db.collection('items').doc(itemId).update({ bookedBy: FieldValue.delete() });
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка отмены' });
    }
});


// geocode helper route
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
app.put('/api/users/:id', async (req,res) => {
    try {
        const userId = req.params.id;
        await db.collection('users').doc(userId).update(req.body);
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка обновления' });
    }
});

app.delete('/api/users/:id', async (req,res) => {
    try {
        await db.collection('users').doc(req.params.id).delete();
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: 'Ошибка удаления' });
    }
});


// export app for @vercel/node; start server only in local/non-serverless environments
if (!process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`);
    });
}

module.exports = app;
