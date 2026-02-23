
const admin = require('firebase-admin');

// Используем предоставленное имя файла ключа
const SERVICE_ACCOUNT_FILE = './kmsx-32849-firebase-adminsdk-fbsvc-aee84ebb07.json';

try {
    const serviceAccount = require(SERVICE_ACCOUNT_FILE);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
} catch (e) {
    console.error(`Ошибка чтения файла ключа: ${SERVICE_ACCOUNT_FILE}. Убедитесь, что файл существует в корне проекта.`);
    // Мы не будем падать, но и база данных работать не будет.
}

const db = admin.firestore();

module.exports = db;
