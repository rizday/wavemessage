const firebaseConfig = {
  apiKey: "AIzaSyAOFsllrNx2X8lokq7nhgQkOL6Cwe2Fd2Q",
  authDomain: "wave-message-1c0f6.firebaseapp.com",
  databaseURL: "https://wave-message-1c0f6-default-rtdb.firebaseio.com",
  projectId: "wave-message-1c0f6",
  storageBucket: "wave-message-1c0f6.firebasestorage.app",
  messagingSenderId: "707920231758",
  appId: "1:707920231758:web:05f04dd3dc3f4b636d721f"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const storage = firebase.storage();

let currentUser = null;
let currentChatId = null;
let currentPartner = null;

// Табы авторизации
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.form').forEach(f => f.classList.remove('active'));
        document.getElementById(tab.dataset.tab + '-form').classList.add('active');
    });
});

// Превью аватара при регистрации
document.getElementById('reg-avatar').addEventListener('change', e => {
    if (e.target.files[0]) {
        document.getElementById('avatar-preview').src = URL.createObjectURL(e.target.files[0]);
        document.getElementById('avatar-preview').classList.remove('hidden');
    }
});

// Регистрация
document.getElementById('register-btn').addEventListener('click', async () => {
    const name = document.getElementById('reg-name').value.trim();
    const surname = document.getElementById('reg-surname').value.trim();
    const username = document.getElementById('reg-username').value.trim().toLowerCase();
    const password = document.getElementById('reg-password').value;
    const bio = document.getElementById('reg-bio').value.trim();

    if (!name || !username || !password) return alert('Заполни обязательные поля!');
    if (!username.startsWith('@')) return alert('@username должен начинаться с @');

    const cleanUsername = username.slice(1);

    const snap = await db.ref('users').orderByChild('username').equalTo(cleanUsername).once('value');
    if (snap.exists()) return alert('Этот @username уже занят');

    let avatarUrl = null;
    const file = document.getElementById('reg-avatar').files[0];
    if (file) {
        const ref = storage.ref('avatars/' + cleanUsername);
        await ref.put(file);
        avatarUrl = await ref.getDownloadURL();
    }

    const userData = {
        name,
        surname: surname || '',
        username: cleanUsername,
        bio: bio || '',
        avatar: avatarUrl,
        password,
        createdAt: Date.now()
    };

    await db.ref('users/' + cleanUsername).set(userData);
    alert('Аккаунт создан! Теперь войди.');
});

// Вход
document.getElementById('login-btn').addEventListener('click', async () => {
    let username = document.getElementById('login-username').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;

    if (!username || !password) return alert('Заполни поля');

    const cleanUsername = username.startsWith('@') ? username.slice(1) : username;

    const snap = await db.ref('users/' + cleanUsername).once('value');
    if (!snap.exists() || snap.val().password !== password) return alert('Неверный @username или пароль');

    currentUser = snap.val();
    currentUser.id = cleanUsername;

    document.getElementById('my-name').textContent = currentUser.name + (currentUser.surname ? ' ' + currentUser.surname : '');
    document.getElementById('my-username').textContent = '@' + currentUser.username;
    if (currentUser.avatar) document.getElementById('my-avatar').src = currentUser.avatar;

    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('main-screen').classList.add('active');
});

// Добавление контакта по @username
document.getElementById('add-contact-btn').addEventListener('click', async () => {
    let input = document.getElementById('search-input').value.trim().toLowerCase();
    if (!input.startsWith('@')) return alert('Введи @username');

    const targetUsername = input.slice(1);
    if (targetUsername === currentUser.username) return alert('Это ты сам!');

    const snap = await db.ref('users/' + targetUsername).once('value');
    if (!snap.exists()) return alert('Пользователь не найден');

    openChat(targetUsername);
});

// Открытие чата
async function openChat(partnerUsername) {
    const partnerSnap = await db.ref('users/' + partnerUsername).once('value');
    const partner = partnerSnap.val();

    document.getElementById('chat-partner-name').textContent = partner.name + (partner.surname ? ' ' + partner.surname : '');
    document.getElementById('partner-bio').textContent = partner.bio || 'Нет информации о себе';
    document.getElementById('partner-avatar').src = partner.avatar || 'https://via.placeholder.com/50';

    const phones = [currentUser.username, partnerUsername].sort();
    currentChatId = phones.join('_');
    currentPartner = partnerUsername;

    document.getElementById('chat-area').classList.remove('hidden');
    loadMessages();
}

// Загрузка сообщений
function loadMessages() {
    const messagesDiv = document.getElementById('messages');
    messagesDiv.innerHTML = '';

    db.ref('chats/' + currentChatId).on('child_added', snapshot => {
        const msg = snapshot.val();
        const div = document.createElement('div');
        div.classList.add('message', msg.sender === currentUser.username ? 'my' : 'other');
        if (msg.text) div.innerHTML += `<p>${msg.text}</p>`;
        if (msg.mediaUrl) {
            if (msg.mediaType.startsWith('image')) {
                div.innerHTML += `<img src="${msg.mediaUrl}">`;
            } else {
                div.innerHTML += `<video controls><source src="${msg.mediaUrl}"></video>`;
            }
        }
        messagesDiv.appendChild(div);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    });
}

// Отправка сообщения
document.getElementById('send-message-btn').addEventListener('click', sendMessage);
document.getElementById('message-input').addEventListener('keypress', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

async function sendMessage() {
    const text = document.getElementById('message-input').value.trim();
    const file = document.getElementById('media-input').files[0];

    if (!text && !file) return;

    let mediaUrl = null;
    let mediaType = null;

    if (file) {
        const ref = storage.ref('media/' + Date.now() + '_' + file.name);
        await ref.put(file);
        mediaUrl = await ref.getDownloadURL();
        mediaType = file.type;
    }

    const msg = {
        sender: currentUser.username,
        text,
        mediaUrl,
        mediaType,
        timestamp: Date.now()
    };

    db.ref('chats/' + currentChatId).push(msg);

    document.getElementById('message-input').value = '';
    document.getElementById('media-input').value = '';
}

// Настройки снегопада
document.getElementById('settings-btn').addEventListener('click', () => {
    document.getElementById('settings-modal').classList.remove('hidden');
    document.getElementById('snow-toggle').checked = document.getElementById('snowflakes').style.display !== 'none';
});

document.getElementById('close-settings').addEventListener('click', () => {
    document.getElementById('settings-modal').classList.add('hidden');
});

document.getElementById('snow-toggle').addEventListener('change', e => {
    document.getElementById('snowflakes').style.display = e.target.checked ? 'block' : 'none';
});

// Выход
document.getElementById('logout-btn').addEventListener('click', () => {
    location.reload();
});

// Генерация снежинок (скрыты по умолчанию)
for (let i = 0; i < 120; i++) {
    let s = document.createElement('div');
    s.textContent = '❄';
    s.style.position = 'fixed';
    s.style.left = Math.random() * 100 + 'vw';
    s.style.fontSize = Math.random() * 20 + 10 + 'px';
    s.style.opacity = Math.random() * 0.8 + 0.2;
    s.style.animationDuration = Math.random() * 10 + 10 + 's';
    s.style.animationDelay = Math.random() * 10 + 's';
    document.getElementById('snowflakes').appendChild(s);
}

const snowStyle = document.createElement('style');
snowStyle.innerHTML = '@keyframes fall { to { transform: translateY(100vh); } } .snowflakes > div { animation: fall linear infinite; }';
document.head.appendChild(snowStyle);