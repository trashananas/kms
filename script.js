// simple storage using localStorage for prototype

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('item-form');
    const container = document.getElementById('items-container');
    const authContainer = document.getElementById('auth-container');
    const addSection = document.getElementById('add-item');
    const listingsSection = document.getElementById('listings');
    const instructions = document.getElementById('instructions');
    const toggleBtn = document.getElementById('toggle-instructions');
    const loginFormDiv = document.getElementById('login-form');
    const registerFormDiv = document.getElementById('register-form');
    const navBar = document.querySelector('header nav');

    /* storage helpers migrated to API */
    async function fetchItems() {
        const res = await fetch('/api/items');
        return res.json();
    }
    async function postItem(item) {
        const res = await fetch('/api/items', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(item)});
        return res.json();
    }
    async function putItem(id,data) {
        const res = await fetch(`/api/items/${id}`, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
        return res.json();
    }
    async function deleteItemRequest(id) {
        const res = await fetch(`/api/items/${id}`, {method:'DELETE'});
        return res.json();
    }
    async function bookItemRequest(id, phone) {
        const res = await fetch(`/api/book/${id}`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone})});
        return res.json();
    }
    async function cancelItemRequest(id) {
        const res = await fetch(`/api/cancel/${id}`, {method:'POST'});
        return res.json();
    }
    function setCurrentUser(user, remember=true) {
        const str = JSON.stringify(user);
        if (remember) {
            localStorage.setItem('currentUser', str);
            sessionStorage.removeItem('currentUser');
        } else {
            sessionStorage.setItem('currentUser', str);
            localStorage.removeItem('currentUser');
        }
    }
    function getCurrentUser() {
        let raw = localStorage.getItem('currentUser');
        if (!raw) raw = sessionStorage.getItem('currentUser');
        return raw ? JSON.parse(raw) : null;
    }
    function normalizePhone(p) {
        if (!p) return '';
        // remove non-digits, replace leading 8 with 7
        let digits = p.replace(/\D/g, '');
        if (digits.length === 11 && digits.startsWith('8')) {
            digits = '7' + digits.slice(1);
        }
        if (digits.length === 10) {
            digits = '7' + digits;
        }
        return digits;
    }

    /* rendering items */
    let showOnlyMy = false;
    let bookedByFilter = null; // either null or current phone
    async function renderItems(filterAges = []) {
        let items = await fetchItems();
        // filter by age
        if (filterAges.length) {
            items = items.filter(it => {
                if (!it.ageMarkers || it.ageMarkers.length === 0) return false;
                return filterAges.some(age => it.ageMarkers.includes(age));
            });
        }
        // hide booked items not belonging to user or seller
        const me = getCurrentUser().phone;
        items = items.filter(it => {
            if (it.bookedBy && it.bookedBy !== me && it.userPhone !== me) return false;
            return true;
        });
        // my only filter
        if (showOnlyMy) {
            items = items.filter(it => it.userPhone === me);
        }
        // distance filter
        const distEnabled = document.getElementById('distance-filter-enabled');
        if (distEnabled && distEnabled.checked) {
            const maxKm = parseFloat(document.getElementById('distance-km').value);
            const maxMeters = (isNaN(maxKm) ? 2 : maxKm) * 1000;
            const home = await getHomeCoords();
            if (home) {
                items = items.filter(it => {
                    if (!it.coords) return true; // no coords stored → don't hide
                    return haversineMeters(home[0], home[1], it.coords[0], it.coords[1]) <= maxMeters;
                });
            }
        }
        container.innerHTML = '';
        if (items.length === 0) {
            container.textContent = 'Пока нет объявлений.';
            return;
        }
        items.forEach((it, idx) => {
            const div = document.createElement('div');
            div.className = 'item';
            // board view: only photo + title
            if (!showOnlyMy) {
                let firstImg = '';
                if (it.attachments && it.attachments.length) {
                    const imgatt = it.attachments.find(a=>a.type.startsWith('image/'));
                    if (imgatt) firstImg = `<img src="${imgatt.data}" style="max-width:100px;max-height:80px;">`;
                }
                div.innerHTML = `${firstImg}<h3>${it.title}</h3>`;
            } else {
                let details = `<h3>${it.title}</h3><small>${it.category} • ${it.location||''}</small>
                <p>${it.description||''}</p>
                <p>Возраст: ${it.ageMarkers?it.ageMarkers.join(', '):''}</p>`;
                if (it.price) details += `<p>Цена: ${it.price}</p>`;
                if (it.bank) details += `<p>Банк: ${it.bank}</p>`;
                div.innerHTML = details;
            }
            // booking control: if booked by me and I'm not seller show cancel
            if (it.bookedBy && it.bookedBy===me && it.userPhone!==me) {
                const btnCancel = document.createElement('button');
                btnCancel.textContent = 'Отмена брони';
                btnCancel.addEventListener('click', (e)=>{e.stopPropagation(); cancelBooking(it.id);});
                div.appendChild(btnCancel);
            }
            // add controls depending on ownership
            if (it.userPhone === me) {
                const btnEdit = document.createElement('button');
                btnEdit.textContent = 'Ред.';
                btnEdit.addEventListener('click', (e) => { e.stopPropagation(); editItem(it.id); });
                div.appendChild(btnEdit);
                const btnDel = document.createElement('button');
                btnDel.textContent = 'Удалить';
                btnDel.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm('Удалить объявление?')) {
                        deleteItem(it.id);
                    }
                });
                div.appendChild(btnDel);
            } else {
                if (!it.bookedBy) {
                    const btnBook = document.createElement('button');
                    btnBook.textContent = 'Бронь';
                    btnBook.addEventListener('click', (e) => { e.stopPropagation(); bookItem(it.id); });
                    div.appendChild(btnBook);
                }
            }
            // click on other's ad opens modal
            if (it.userPhone !== me) {
                div.addEventListener('click', () => openModal(it));
            }
            container.appendChild(div);
            // attachments and maps only in detailed view (when showOnlyMy)
            if (showOnlyMy) {
                if (it.attachments && it.attachments.length) {
                    const attDiv = document.createElement('div');
                    attDiv.className = 'attachments';
                    it.attachments.forEach(a => {
                        if (a.type.startsWith('image/')) {
                            const img = document.createElement('img');
                            img.src = a.data;
                            img.style.maxWidth = '100px';
                            img.style.marginRight = '0.5rem';
                            attDiv.appendChild(img);
                        } else if (a.type.startsWith('video/')) {
                            const vid = document.createElement('video');
                            vid.controls = true;
                            vid.src = a.data;
                            vid.style.maxWidth = '100px';
                            vid.style.marginRight = '0.5rem';
                            attDiv.appendChild(vid);
                        }
                    });
                    div.appendChild(attDiv);
                }
                if (it.coords) {
                    const pcoord = document.createElement('p');
                    pcoord.textContent = `Координаты: ${it.coords[0].toFixed(5)}, ${it.coords[1].toFixed(5)}`;
                    div.appendChild(pcoord);
                }
            }
        });
    }

    // helper: edit item by id (populate form)
    async function editItem(id) {
        const items = await fetchItems();
        const it = items.find(i => i.id === id);
        if (!it) return;
        showAdd();
        const f = document.getElementById('item-form');
        f.title.value = it.title;
        f.description.value = it.description;
        f.category.value = it.category;
        populateSubcategories(it.category, it.subcategory);
        f.subcategory && (f.subcategory.value = it.subcategory);
        f.location.value = it.location;
        f.price && (f.price.value = it.price || '');
        f.bank && (f.bank.value = it.bank || '');
        // set age select
        const ageSel = document.getElementById('age-select');
        if (ageSel && it.ageMarkers) {
            Array.from(ageSel.options).forEach(opt => {
                opt.selected = it.ageMarkers.includes(opt.value);
            });
        }
        f._coords = it.coords || null;
        it.ageMarkers && it.ageMarkers.forEach(a => {
            const ch = f.querySelector(`input[name="age"][value="${a}"]`);
            if (ch) ch.checked = true;
        });
        // attachments cannot be edited easily
        f._editId = id;
    }
    async function deleteItem(id) {
        await deleteItemRequest(id);
        await showMain();
    }
    async function bookItem(id) {
        const user = getCurrentUser();
        await bookItemRequest(id, user.phone);
        await showMain();
    }
    async function cancelBooking(id) {
        await cancelItemRequest(id);
        await showMain();
    }
    function openModal(it) {
        const modal = document.getElementById('ad-modal');
        const content = document.getElementById('modal-content');
        content.innerHTML = '';
        const title = document.createElement('h3');
        title.textContent = it.title;
        content.appendChild(title);
        if (it.attachments && it.attachments.length) {
            it.attachments.forEach(a=>{
                if (a.type.startsWith('image/')) {
                    const img=document.createElement('img');img.src=a.data;img.style.maxWidth='100%';content.appendChild(img);
                } else if(a.type.startsWith('video/')){
                    const vid=document.createElement('video');vid.controls=true;vid.src=a.data;vid.style.maxWidth='100%';content.appendChild(vid);
                }
            });
        }
        const desc = document.createElement('p');desc.textContent=it.description||'';content.appendChild(desc);
        if (it.price) {
            const p = document.createElement('p'); p.textContent = 'Цена: ' + it.price; content.appendChild(p);
        }
        if (it.bank) {
            const p2 = document.createElement('p'); p2.textContent = 'Банк: ' + it.bank; content.appendChild(p2);
        }
        const close = document.getElementById('modal-close');
        close.onclick = () => {modal.style.display='none';};
        modal.style.display='block';
    }

    /* utility: confirmation modal */
    function showConfirm(message, onYes) {
        const modal = document.getElementById('confirm-modal');
        const msg = document.getElementById('confirm-message');
        msg.textContent = message;
        modal.style.display = 'block';
        document.getElementById('confirm-yes').onclick = () => { modal.style.display='none'; onYes(); };
        document.getElementById('confirm-no').onclick = () => { modal.style.display='none'; };
    }

    /* category/subcategory data and helpers */
    const categories = {
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
    function populateSubcategories(cat, selected) {
        const container = document.getElementById('subcat-container');
        container.innerHTML = '';
        const subs = categories[cat] || [];
        if (subs.length) {
            const label = document.createElement('label');
            label.textContent = 'Подкатегория:';
            const sel = document.createElement('select');
            sel.name = 'subcategory';
            subs.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s;
                opt.textContent = s;
                if (s === selected) opt.selected = true;
                sel.appendChild(opt);
            });
            container.appendChild(label);
            container.appendChild(sel);
        }
    }
    document.getElementById('category-select').addEventListener('change', (e) => {
        populateSubcategories(e.target.value,'');
    });

    /* navigation and UI helpers */
    function hideAllSections() {
        addSection.style.display = 'none';
        listingsSection.style.display = 'none';
        document.getElementById('profile').style.display = 'none';
    }
    async function showMain() {
        if (!getCurrentUser()) return; // don't show when logged out
        navBar.style.display = '';
        hideAllSections();
        listingsSection.style.display = '';
        await renderItems(getSelectedAges());
    }
    function showAdd() {
        navBar.style.display = '';
        hideAllSections();
        addSection.style.display = '';
        const formEl = document.getElementById('item-form');
        if (formEl) {
            formEl._coords = null;
            formEl._editId = null;
            form.reset();
            document.getElementById('subcat-container').innerHTML = '';
        }
    }
    function showProfile() {
        navBar.style.display = '';
        hideAllSections();
        document.getElementById('profile').style.display = '';
        populateProfileView();
    }

    function showLogin() {
        loginFormDiv.style.display = '';
        registerFormDiv.style.display = 'none';
    }
    function showRegister() {
        loginFormDiv.style.display = 'none';
        registerFormDiv.style.display = '';
        const formEl = registerFormDiv.querySelector('form');
        if (formEl) {
            formEl.reset();
            // coords now stored in geoCache via address value
        }
        const addrInp = document.getElementById('reg-address');
        if (addrInp) addrInp.value = '';;
    }

    /* toggle instructions */
    toggleBtn.addEventListener('click', () => {
        instructions.style.display = instructions.style.display === 'none' ? '' : 'none';
    });
    /* navigation buttons */
    document.getElementById('nav-listings').addEventListener('click', showMain);
    document.getElementById('nav-add').addEventListener('click', showAdd);
    document.getElementById('nav-profile').addEventListener('click', showProfile);

    /* form submissions */
    
    // add/edit item form
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = new FormData(form);
        const ageMarkers = [];
        const checks = document.querySelectorAll('#age-checkboxes input[name="age"]:checked');
        if (checks) {
            Array.from(checks).forEach(c=>ageMarkers.push(c.value));
        }
        if (ageMarkers.length === 0) ageMarkers.push('на любой возраст');
        const coords = geoCache[data.get('location')] || null;
        const files = form.querySelector('[name="attachments"]').files;
        const filePromises = [];
        for (let i = 0; i < files.length && i < 5; i++) {
            const file = files[i];
            filePromises.push(new Promise(resolve => {
                const reader = new FileReader();
                reader.onload = () => resolve({type: file.type, data: reader.result});
                reader.readAsDataURL(file);
            }));
        }
        const att = await Promise.all(filePromises);
        const item = {
            title: data.get('title'),
            description: data.get('description'),
            category: data.get('category'),
            subcategory: data.get('subcategory') || '',
            location: data.get('location'),
            price: data.get('price') || '',
            bank: data.get('bank') || '',
            ageMarkers,
            userPhone: getCurrentUser().phone,
            attachments: att,
            coords
        };
        if (form._editId != null) {
            await putItem(form._editId, item);
        } else {
            await postItem(item);
        }
        await showMain();
        form.reset();
        form._coords = null;
        form._editId = null;
    });

    // login form -> backend
    loginFormDiv.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const phone = fd.get('phone');
        const password = fd.get('password');
        const remember = fd.get('remember') === 'on';
        try {
            const res = await fetch('/api/login', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone,password})});
            const data = await res.json();
            if (res.ok) {
                setCurrentUser(data.user, remember);
                authContainer.style.display = 'none';
            } else {
                alert(data.error || 'Ошибка входа');
                return;
            }
        } catch(err){
            alert('Ошибка сети');
            return;
        }
        await showMain();
    });
    loginFormDiv.querySelector('#show-register').addEventListener('click', (e) => {
        e.preventDefault();
        showRegister();
    });

    // register form -> backend
    registerFormDiv.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const name = fd.get('name');
        const phone = fd.get('phone');
        const password = fd.get('password');
        const password2 = fd.get('password2');
        if (password !== password2) {
            alert('Пароли не совпадают');
            return;
        }
        const address = fd.get('address');
        const availability = {};
        ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].forEach(day => {
            const time = fd.get(`time-${day}`);
            if (time) availability[day] = time;
        });
        const addressDetails = {
            building: fd.get('building'),
            floor: fd.get('floor'),
            unit: fd.get('unit'),
            intercom: fd.get('intercom'),
            gate: fd.get('gate')
        };
        try {
            const res = await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,phone,password,address,availability,addressDetails})});
            const data = await res.json();
            if (res.ok) {
                setCurrentUser(data.user);
                authContainer.style.display = 'none';
            } else {
                alert(data.error || 'Ошибка регистрации');
                return;
            }
        } catch(err) {
            alert('Ошибка сети');
            return;
        }
        await showMain();
    });
    registerFormDiv.querySelector('#show-login').addEventListener('click', (e) => {
        e.preventDefault();
        showLogin();
    });

    /* profile helpers */
    const profileView = document.getElementById('profile-view');
    const profileEdit = document.getElementById('profile-edit');
    function populateProfileView() {
        const user = getCurrentUser();
        if (!user) return;
        document.getElementById('profile-name').textContent = user.name || '';
        document.getElementById('profile-phone').textContent = user.phone || '';
        document.getElementById('profile-address').textContent = user.address || '';
        // address details
        const det = [];
        if (user.addressDetails) {
            ['building','floor','unit','intercom','gate'].forEach(k=>{
                if (user.addressDetails[k]) det.push(user.addressDetails[k]);
            });
        }
        const addrElem = document.getElementById('profile-address');
        if (det.length) addrElem.textContent += ' ('+det.join(', ')+')';
        const ul = document.getElementById('profile-availability');
        ul.innerHTML = '';
        if (user.availability) {
            Object.entries(user.availability).forEach(([day,time]) => {
                const li = document.createElement('li');
                li.textContent = `${day}: ${time}`;
                ul.appendChild(li);
            });
        }
    }
    document.getElementById('edit-profile-btn').addEventListener('click', () => {
        profileView.style.display = 'none';
        profileEdit.style.display = '';
        const user = getCurrentUser();
        const form = document.getElementById('profile-form');
        form.name.value = user.name;
        form.address.value = user.address || '';
        if (user.addressDetails) {
            form.building.value = user.addressDetails.building || '';
            form.floor.value = user.addressDetails.floor || '';
            form.unit.value = user.addressDetails.unit || '';
            form.intercom.value = user.addressDetails.intercom || '';
            form.gate.value = user.addressDetails.gate || '';
        }
        ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].forEach(day => {
            form[`time-${day}`].value = user.availability && user.availability[day] ? user.availability[day] : '';
        });
    });
    document.getElementById('cancel-profile-edit').addEventListener('click', () => {
        profileEdit.style.display = 'none';
        profileView.style.display = '';
    });
    document.getElementById('profile-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const current = getCurrentUser();
        const updated = {
            name: fd.get('name'),
            address: fd.get('address'),
            addressDetails: {
                building: fd.get('building'),
                floor: fd.get('floor'),
                unit: fd.get('unit'),
                intercom: fd.get('intercom'),
                gate: fd.get('gate')
            },
            availability: {}
        };
        const newPass = fd.get('password');
        if (newPass) updated.password = newPass;
        ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].forEach(day => {
            const time = fd.get(`time-${day}`);
            if (time) updated.availability[day] = time;
        });
        try {
            const res = await fetch(`/api/users/${current.id}`, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(updated)});
            const data = await res.json();
            if (res.ok) {
                setCurrentUser(data.user);
                homeCoords = null; // address may have changed
                profileEdit.style.display = 'none';
                profileView.style.display = '';
                populateProfileView();
            } else {
                alert(data.error || 'Ошибка при сохранении профиля');
            }
        } catch(err) {
            alert('Ошибка сети');
        }
    });
    document.getElementById('logout-btn').addEventListener('click', () => {
        homeCoords = null;
        localStorage.removeItem('currentUser');
        sessionStorage.removeItem('currentUser');
        authContainer.style.display = '';
        navBar.style.display = 'none';
        hideAllSections();
        showLogin();
    });
    document.getElementById('delete-profile-btn').addEventListener('click', () => {
        showConfirm('Удалить аккаунт? Это действие необратимо.', async () => {
            const user = getCurrentUser();
            try {
                await fetch(`/api/users/${user.id}`, {method:'DELETE'});
            } catch(e) {}
            localStorage.removeItem('currentUser');
            sessionStorage.removeItem('currentUser');
            authContainer.style.display = '';
            navBar.style.display = 'none';
            hideAllSections();
            showLogin();
        });
    });

    /* age filter handling */
    function getSelectedAges() {
        const checks = document.querySelectorAll('#age-filter input[name="age-filter"]:checked');
        const ages = Array.from(checks).map(c=>c.value);
        return ages;
    }
    document.querySelectorAll('#age-filter input[name="age-filter"]').forEach(ch=>{
        ch.addEventListener('change', () => showMain());
    });
    // my ads toggle
    document.getElementById('show-my-ads').addEventListener('click', () => {
        showOnlyMy = !showOnlyMy;
        document.getElementById('show-my-ads').textContent = showOnlyMy ? 'Все объявления' : 'Мои объявления';
        showMain();
    });

    /* геосаджест: запросим подсказки на бэке, сохраним координаты в кеш */
    const geoCache = {};
    async function fetchGeo(q) {
        if (!q) return [];
        try {
            const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
            if (!res.ok) return [];
            return await res.json();
        } catch (e) {
            console.error('geocode request failed', e);
            return [];
        }
    }
    function attachGeosuggest(inputEl) {
        const listId = inputEl.getAttribute('list');
        if (!listId) return;
        const listEl = document.getElementById(listId);
        inputEl.addEventListener('input', async () => {
            const q = inputEl.value.trim();
            if (q.length < 3) return;
            const suggestions = await fetchGeo(q);
            listEl.innerHTML = '';
            suggestions.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.text;
                opt.dataset.coords = s.coords.join(',');
                listEl.appendChild(opt);
            });
        });
        inputEl.addEventListener('change', () => {
            const val = inputEl.value;
            const opt = [...listEl.options].find(o => o.value === val);
            if (opt) {
                geoCache[val] = opt.dataset.coords.split(',').map(Number);
            } else {
                delete geoCache[val];
            }
        });
    }
    // hook geosuggest to item location input only (registration address is plain text)
    const loc = document.getElementById('location-input');
    if (loc) attachGeosuggest(loc);
    // password toggle listeners
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.previousElementSibling;
            if (input && input.type === 'password') {
                input.type = 'text';
            } else if (input) {
                input.type = 'password';
            }
        });
    });

    /* фильтр по расстоянию */
    function haversineMeters(lat1, lon1, lat2, lon2) {
        const R = 6371000; // Earth radius in metres
        const toRad = x => x * Math.PI / 180;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }
    let homeCoords = null;
    async function getHomeCoords() {
        if (homeCoords) return homeCoords;
        const user = getCurrentUser();
        if (!user || !user.address) return null;
        const statusEl = document.getElementById('distance-status');
        if (statusEl) statusEl.textContent = 'Определяем адрес…';
        const results = await fetchGeo(user.address);
        if (results && results.length > 0) {
            homeCoords = results[0].coords;
            if (statusEl) statusEl.textContent = '';
        } else {
            if (statusEl) statusEl.textContent = 'Адрес из профиля не найден';
        }
        return homeCoords;
    }
    document.getElementById('distance-filter-enabled').addEventListener('change', () => showMain());
    document.getElementById('distance-km').addEventListener('change', () => showMain());

    /* startup */
    const rememberMsg = document.getElementById('remember-message');
    if (getCurrentUser()) {
        rememberMsg.style.display = '';
        // delay revealing main to simulate remembering process
        setTimeout(() => {
            rememberMsg.style.display = 'none';
            authContainer.style.display = 'none';
            navBar.style.display = '';
            hideAllSections();
            showMain();
        }, 6000);
    } else {
        authContainer.style.display = '';
        navBar.style.display = 'none';
        hideAllSections();
        showLogin();
    }
});