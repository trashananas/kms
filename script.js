// Полочка — script.js

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

    // ── Toast notifications ──────────────────────────────────
    function showToast(msg, type, duration) {
        if (type === undefined) type = 'error';
        if (duration === undefined) duration = 4000;
        const tc = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast toast-' + type;
        toast.textContent = msg;
        tc.appendChild(toast);
        requestAnimationFrame(function() { toast.classList.add('toast-visible'); });
        setTimeout(function() {
            toast.classList.remove('toast-visible');
            setTimeout(function() { toast.remove(); }, 400);
        }, duration);
    }
    function showError(msg) { showToast(msg, 'error'); }
    function showSuccess(msg) { showToast(msg, 'success', 3000); }

    function setInlineError(elId, msg) {
        const el = document.getElementById(elId);
        if (!el) return;
        if (msg) {
            el.textContent = msg;
            el.style.display = '';
        } else {
            el.style.display = 'none';
            el.textContent = '';
        }
    }

    // ── API helpers ──────────────────────────────────────────
    async function apiFetch(url, opts) {
        if (!opts) opts = {};
        try {
            const res = await fetch(url, opts);
            let data = {};
            try { data = await res.json(); } catch(e) {}
            if (!res.ok) throw new Error(data.error || ('Ошибка ' + res.status));
            return data;
        } catch (e) {
            if (e instanceof TypeError) throw new Error('Нет соединения с сервером');
            throw e;
        }
    }

    async function fetchItems() { return apiFetch('/api/items'); }
    async function postItem(item) {
        return apiFetch('/api/items', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(item)});
    }
    async function putItem(id, data) {
        return apiFetch('/api/items/' + id, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    }
    async function deleteItemRequest(id) {
        return apiFetch('/api/items/' + id, {method:'DELETE'});
    }
    async function bookItemRequest(id, phone) {
        return apiFetch('/api/book/' + id, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:phone})});
    }
    async function cancelItemRequest(id) {
        return apiFetch('/api/cancel/' + id, {method:'POST'});
    }

    // ── User session ─────────────────────────────────────────
    function setCurrentUser(user, remember) {
        if (remember === undefined) remember = true;
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
        let digits = p.replace(/\D/g, '');
        if (digits.length === 11 && digits.startsWith('8')) digits = '7' + digits.slice(1);
        if (digits.length === 10) digits = '7' + digits;
        return digits;
    }

    // ── Likes / Hidden (per-user localStorage) ───────────────
    function getLikes() {
        const u = getCurrentUser();
        if (!u) return [];
        const raw = localStorage.getItem('likes_' + u.id);
        return raw ? JSON.parse(raw) : [];
    }
    function setLikes(arr) {
        const u = getCurrentUser();
        if (!u) return;
        localStorage.setItem('likes_' + u.id, JSON.stringify(arr));
    }
    function toggleLike(id) {
        const likes = getLikes();
        const idx = likes.indexOf(id);
        if (idx === -1) likes.push(id);
        else likes.splice(idx, 1);
        setLikes(likes);
        return idx === -1;
    }
    function isLiked(id) { return getLikes().includes(id); }

    function getHidden() {
        const u = getCurrentUser();
        if (!u) return [];
        const raw = localStorage.getItem('hidden_' + u.id);
        return raw ? JSON.parse(raw) : [];
    }
    function setHidden(arr) {
        const u = getCurrentUser();
        if (!u) return;
        localStorage.setItem('hidden_' + u.id, JSON.stringify(arr));
    }
    function hideItemLocal(id) {
        const hidden = getHidden();
        if (!hidden.includes(id)) { hidden.push(id); setHidden(hidden); }
    }
    function unhideItem(id) {
        setHidden(getHidden().filter(function(x) { return x !== id; }));
    }
    function isHidden(id) { return getHidden().includes(id); }

    // ── Categories (server-side) ─────────────────────────────
    let categoriesData = {};
    async function loadCategories() {
        try {
            categoriesData = await apiFetch('/api/categories');
        } catch(e) {
            console.error('loadCategories failed', e);
        }
        return categoriesData;
    }

    function populateCategorySelect(selectEl, selected) {
        selectEl.innerHTML = '<option value="">— выберите —</option>';
        Object.keys(categoriesData).forEach(function(cat) {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            if (cat === selected) opt.selected = true;
            selectEl.appendChild(opt);
        });
    }

    function populateSubcategories(cat, selected) {
        const subcatContainer = document.getElementById('subcat-container');
        const addSubcatContainer = document.getElementById('add-subcat-container');
        subcatContainer.innerHTML = '';
        const subs = categoriesData[cat] || [];
        if (cat) {
            addSubcatContainer.style.display = '';
        } else {
            addSubcatContainer.style.display = 'none';
        }
        if (subs.length) {
            const label = document.createElement('label');
            label.textContent = 'Подкатегория:';
            const sel = document.createElement('select');
            sel.name = 'subcategory';
            const emptyOpt = document.createElement('option');
            emptyOpt.value = '';
            emptyOpt.textContent = '— любая —';
            sel.appendChild(emptyOpt);
            subs.forEach(function(s) {
                const opt = document.createElement('option');
                opt.value = s;
                opt.textContent = s;
                if (s === selected) opt.selected = true;
                sel.appendChild(opt);
            });
            subcatContainer.appendChild(label);
            subcatContainer.appendChild(sel);
        }
    }

    document.getElementById('category-select').addEventListener('change', function(e) {
        populateSubcategories(e.target.value, '');
    });

    // Add category modal
    document.getElementById('add-category-btn').addEventListener('click', function() {
        document.getElementById('new-cat-name').value = '';
        setInlineError('cat-modal-error', '');
        document.getElementById('cat-modal').style.display = 'block';
        document.getElementById('new-cat-name').focus();
    });
    document.getElementById('cat-modal-cancel').addEventListener('click', function() {
        document.getElementById('cat-modal').style.display = 'none';
    });
    document.getElementById('cat-modal-save').addEventListener('click', async function() {
        const name = document.getElementById('new-cat-name').value.trim();
        if (!name) { setInlineError('cat-modal-error', 'Введите название категории'); return; }
        try {
            categoriesData = await apiFetch('/api/categories', {
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body: JSON.stringify({name:name, subcategories:[]})
            });
            document.getElementById('cat-modal').style.display = 'none';
            const catSel = document.getElementById('category-select');
            populateCategorySelect(catSel, name);
            populateSubcategories(name, '');
            showSuccess('Категория «' + name + '» создана');
            rebuildCategoryFilter();
        } catch(e) {
            setInlineError('cat-modal-error', e.message);
        }
    });

    // Add subcategory modal
    document.getElementById('add-subcat-btn').addEventListener('click', function() {
        const cat = document.getElementById('category-select').value;
        if (!cat) { showError('Сначала выберите категорию'); return; }
        document.getElementById('subcat-modal-title').textContent = 'Подкатегория для «' + cat + '»';
        document.getElementById('new-subcat-name').value = '';
        setInlineError('subcat-modal-error', '');
        document.getElementById('subcat-modal').style.display = 'block';
        document.getElementById('new-subcat-name').focus();
    });
    document.getElementById('subcat-modal-cancel').addEventListener('click', function() {
        document.getElementById('subcat-modal').style.display = 'none';
    });
    document.getElementById('subcat-modal-save').addEventListener('click', async function() {
        const cat = document.getElementById('category-select').value;
        const name = document.getElementById('new-subcat-name').value.trim();
        if (!name) { setInlineError('subcat-modal-error', 'Введите название подкатегории'); return; }
        try {
            categoriesData = await apiFetch('/api/categories/' + encodeURIComponent(cat) + '/subcategories', {
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body: JSON.stringify({name:name})
            });
            document.getElementById('subcat-modal').style.display = 'none';
            populateSubcategories(cat, name);
            showSuccess('Подкатегория «' + name + '» добавлена');
        } catch(e) {
            setInlineError('subcat-modal-error', e.message);
        }
    });

    // ── Category filter chips ────────────────────────────────
    let activeCategory = '';
    function rebuildCategoryFilter() {
        const chips = document.getElementById('category-chips');
        chips.innerHTML = '';
        const allChip = document.createElement('button');
        allChip.type = 'button';
        allChip.className = 'cat-chip' + (activeCategory === '' ? ' active' : '');
        allChip.textContent = 'Все';
        allChip.addEventListener('click', function() { activeCategory = ''; rebuildCategoryFilter(); showMain(); });
        chips.appendChild(allChip);
        Object.keys(categoriesData).forEach(function(cat) {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'cat-chip' + (activeCategory === cat ? ' active' : '');
            chip.textContent = cat;
            chip.addEventListener('click', function() { activeCategory = cat; rebuildCategoryFilter(); showMain(); });
            chips.appendChild(chip);
        });
    }

    // ── Escape HTML ──────────────────────────────────────────
    function escHtml(str) {
        return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    // ── Render items ─────────────────────────────────────────
    let showOnlyMy = false;
    async function renderItems(filterAges) {
        if (!filterAges) filterAges = [];
        let items;
        try {
            items = await fetchItems();
        } catch(e) {
            container.innerHTML = '<p class="error-msg">&#9888;&#65039; ' + escHtml(e.message) + '</p>';
            return;
        }

        const me = getCurrentUser().phone;
        const hidden = getHidden();

        items = items.filter(function(it) {
            if (it.userPhone === me) return true;
            return !hidden.includes(it.id);
        });

        items = items.filter(function(it) {
            if (it.bookedBy && it.bookedBy !== me && it.userPhone !== me) return false;
            return true;
        });

        if (showOnlyMy) {
            items = items.filter(function(it) { return it.userPhone === me; });
        }

        if (activeCategory) {
            items = items.filter(function(it) { return it.category === activeCategory; });
        }

        if (filterAges.length) {
            items = items.filter(function(it) {
                if (!it.ageMarkers || it.ageMarkers.length === 0) return false;
                return filterAges.some(function(age) { return it.ageMarkers.includes(age); });
            });
        }

        container.innerHTML = '';
        if (items.length === 0) {
            container.innerHTML = '<p class="empty-msg">Пока нет объявлений по выбранным фильтрам.</p>';
            return;
        }

        items.forEach(function(it) {
            const div = document.createElement('div');
            div.className = 'item';
            let firstImg = '';
            if (it.attachments && it.attachments.length) {
                const imgatt = it.attachments.find(function(a) { return a.type.startsWith('image/'); });
                if (imgatt) firstImg = '<img src="' + imgatt.data + '" class="item-thumb" alt="">';
            }
            const liked = isLiked(it.id);
            const catBadge = it.category ? '<span class="cat-badge">' + escHtml(it.category) + (it.subcategory ? ' &rsaquo; ' + escHtml(it.subcategory) : '') + '</span>' : '';
            const likeBtn = it.userPhone !== me ? '<button class="like-btn' + (liked ? ' liked' : '') + '" data-id="' + it.id + '" title="Лайк">&#9829;</button>' : '';
            div.innerHTML = '<div class="item-header">' + firstImg + '<div class="item-info"><h3>' + escHtml(it.title) + '</h3>' + catBadge + '<small>' + escHtml(it.location || '') + '</small></div>' + likeBtn + '</div>';

            if (it.bookedBy && it.bookedBy === me && it.userPhone !== me) {
                const btnCancel = document.createElement('button');
                btnCancel.textContent = 'Отмена брони';
                btnCancel.className = 'btn-secondary';
                btnCancel.addEventListener('click', function(e) { e.stopPropagation(); cancelBooking(it.id); });
                div.appendChild(btnCancel);
            }

            if (it.userPhone === me) {
                const btnEdit = document.createElement('button');
                btnEdit.textContent = 'Ред.';
                btnEdit.className = 'btn-secondary btn-sm';
                btnEdit.addEventListener('click', function(e) { e.stopPropagation(); editItem(it.id); });
                div.appendChild(btnEdit);
                const btnDel = document.createElement('button');
                btnDel.textContent = 'Удалить';
                btnDel.className = 'btn-danger btn-sm';
                btnDel.addEventListener('click', function(e) {
                    e.stopPropagation();
                    showConfirm('Удалить объявление?', function() { deleteItem(it.id); });
                });
                div.appendChild(btnDel);
            } else {
                if (!it.bookedBy) {
                    const btnBook = document.createElement('button');
                    btnBook.textContent = 'Бронь';
                    btnBook.className = 'btn-sm';
                    btnBook.addEventListener('click', function(e) { e.stopPropagation(); bookItem(it.id); });
                    div.appendChild(btnBook);
                }
                div.addEventListener('click', function() { openModal(it); });
            }

            const likeBtnEl = div.querySelector('.like-btn');
            if (likeBtnEl) {
                likeBtnEl.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const nowLiked = toggleLike(it.id);
                    likeBtnEl.classList.toggle('liked', nowLiked);
                    showToast(nowLiked ? '❤️ Добавлено в лайки' : '🤍 Убрано из лайков', 'success', 1500);
                });
            }

            container.appendChild(div);
        });
    }

    // ── Edit item ────────────────────────────────────────────
    async function editItem(id) {
        let items;
        try { items = await fetchItems(); } catch(e) { showError(e.message); return; }
        const it = items.find(function(i) { return i.id === id; });
        if (!it) return;
        showAdd();
        const f = document.getElementById('item-form');
        f.title.value = it.title;
        f.description.value = it.description;
        populateCategorySelect(document.getElementById('category-select'), it.category);
        populateSubcategories(it.category, it.subcategory);
        f.location.value = it.location;
        if (f.price) f.price.value = it.price || '';
        if (f.bank) f.bank.value = it.bank || '';
        if (it.ageMarkers) it.ageMarkers.forEach(function(a) {
            const ch = f.querySelector('input[name="age"][value="' + a + '"]');
            if (ch) ch.checked = true;
        });
        f._coords = it.coords || null;
        f._editId = id;
    }
    async function deleteItem(id) {
        try { await deleteItemRequest(id); } catch(e) { showError(e.message); return; }
        showSuccess('Объявление удалено');
        await showMain();
    }
    async function bookItem(id) {
        const user = getCurrentUser();
        try { await bookItemRequest(id, user.phone); } catch(e) { showError(e.message); return; }
        showSuccess('Забронировано!');
        await showMain();
    }
    async function cancelBooking(id) {
        try { await cancelItemRequest(id); } catch(e) { showError(e.message); return; }
        showSuccess('Бронь отменена');
        await showMain();
    }

    // ── Modal ────────────────────────────────────────────────
    function openModal(it) {
        const modal = document.getElementById('ad-modal');
        const content = document.getElementById('modal-content');
        content.innerHTML = '';
        const title = document.createElement('h3');
        title.textContent = it.title;
        content.appendChild(title);
        if (it.category) {
            const cat = document.createElement('p');
            cat.innerHTML = '<span class="cat-badge">' + escHtml(it.category) + (it.subcategory ? ' &rsaquo; ' + escHtml(it.subcategory) : '') + '</span>';
            content.appendChild(cat);
        }
        if (it.attachments && it.attachments.length) {
            it.attachments.forEach(function(a) {
                if (a.type.startsWith('image/')) {
                    const img = document.createElement('img');
                    img.src = a.data; img.style.maxWidth = '100%';
                    content.appendChild(img);
                } else if (a.type.startsWith('video/')) {
                    const vid = document.createElement('video');
                    vid.controls = true; vid.src = a.data; vid.style.maxWidth = '100%';
                    content.appendChild(vid);
                }
            });
        }
        if (it.description) { const p = document.createElement('p'); p.textContent = it.description; content.appendChild(p); }
        if (it.location) { const p = document.createElement('p'); p.textContent = '📍 ' + it.location; content.appendChild(p); }
        if (it.price) { const p = document.createElement('p'); p.textContent = '💰 ' + it.price; content.appendChild(p); }
        if (it.bank) { const p = document.createElement('p'); p.textContent = '🏦 ' + it.bank; content.appendChild(p); }
        if (it.ageMarkers && it.ageMarkers.length) {
            const p = document.createElement('p'); p.textContent = '👶 ' + it.ageMarkers.join(', '); content.appendChild(p);
        }
        document.getElementById('modal-close').onclick = function() { modal.style.display = 'none'; };
        modal.style.display = 'block';
    }

    // ── Confirmation modal ───────────────────────────────────
    function showConfirm(message, onYes) {
        const modal = document.getElementById('confirm-modal');
        document.getElementById('confirm-message').textContent = message;
        modal.style.display = 'block';
        document.getElementById('confirm-yes').onclick = function() { modal.style.display = 'none'; onYes(); };
        document.getElementById('confirm-no').onclick = function() { modal.style.display = 'none'; };
    }

    // ── Navigation ───────────────────────────────────────────
    function hideAllSections() {
        addSection.style.display = 'none';
        listingsSection.style.display = 'none';
        document.getElementById('profile').style.display = 'none';
    }
    function setActiveNav(id) {
        document.querySelectorAll('header nav button').forEach(function(b) { b.classList.remove('active'); });
        const btn = document.getElementById(id);
        if (btn) btn.classList.add('active');
    }
    async function showMain() {
        if (!getCurrentUser()) return;
        navBar.style.display = '';
        hideAllSections();
        listingsSection.style.display = '';
        setActiveNav('nav-listings');
        detectMobileModeBtns();
        await renderItems(getSelectedAges());
    }
    function showAdd() {
        navBar.style.display = '';
        hideAllSections();
        addSection.style.display = '';
        setActiveNav('nav-add');
        const f = document.getElementById('item-form');
        if (f) {
            f._coords = null;
            f._editId = null;
            f.reset();
            document.getElementById('subcat-container').innerHTML = '';
            document.getElementById('add-subcat-container').style.display = 'none';
            setInlineError('form-error', '');
        }
        populateCategorySelect(document.getElementById('category-select'), '');
    }
    function showProfile() {
        navBar.style.display = '';
        hideAllSections();
        document.getElementById('profile').style.display = '';
        setActiveNav('nav-profile');
        populateProfileView();
        showTab('profile-info');
    }
    function showLoginView() {
        loginFormDiv.style.display = '';
        registerFormDiv.style.display = 'none';
        setInlineError('login-error', '');
    }
    function showRegister() {
        loginFormDiv.style.display = 'none';
        registerFormDiv.style.display = '';
        setInlineError('register-error', '');
        const formEl = registerFormDiv.querySelector('form');
        if (formEl) formEl.reset();
        const addrInp = document.getElementById('reg-address');
        if (addrInp) addrInp.value = '';
    }

    // ── Profile tabs ─────────────────────────────────────────
    function showTab(tabId) {
        document.querySelectorAll('.tab-content').forEach(function(el) { el.style.display = 'none'; });
        document.querySelectorAll('.tab-btn').forEach(function(btn) { btn.classList.remove('active'); });
        const tabEl = document.getElementById(tabId);
        if (tabEl) tabEl.style.display = '';
        const tabBtn = document.querySelector('.tab-btn[data-tab="' + tabId + '"]');
        if (tabBtn) tabBtn.classList.add('active');
        if (tabId === 'profile-my-ads') renderMyAds();
        if (tabId === 'profile-liked') renderLikedAds();
        if (tabId === 'profile-hidden') renderHiddenAds();
        if (tabId === 'profile-booked') renderBookedAds();
    }
    document.querySelectorAll('.tab-btn').forEach(function(btn) {
        btn.addEventListener('click', function() { showTab(btn.dataset.tab); });
    });

    async function renderMiniAdList(containerId, items, extraBtns) {
        const c = document.getElementById(containerId);
        c.innerHTML = '';
        if (!items || items.length === 0) {
            c.innerHTML = '<p class="empty-msg">Список пуст.</p>';
            return;
        }
        items.forEach(function(it) {
            const div = document.createElement('div');
            div.className = 'item item-mini';
            let thumb = '';
            if (it.attachments && it.attachments.length) {
                const img = it.attachments.find(function(a) { return a.type.startsWith('image/'); });
                if (img) thumb = '<img src="' + img.data + '" class="item-thumb" alt="">';
            }
            div.innerHTML = '<div class="item-header">' + thumb + '<div class="item-info"><h3>' + escHtml(it.title) + '</h3><small>' + escHtml(it.category || '') + (it.location ? ' · ' + escHtml(it.location) : '') + '</small></div></div>';
            if (extraBtns) extraBtns(div, it);
            div.addEventListener('click', function() { openModal(it); });
            c.appendChild(div);
        });
    }

    async function renderMyAds() {
        try {
            const items = await fetchItems();
            const me = getCurrentUser().phone;
            const mine = items.filter(function(it) { return it.userPhone === me; });
            await renderMiniAdList('my-ads-container', mine, function(div, it) {
                const btn = document.createElement('button');
                btn.textContent = 'Удалить';
                btn.className = 'btn-danger btn-sm';
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    showConfirm('Удалить объявление?', function() { deleteItem(it.id).then(function() { renderMyAds(); }); });
                });
                div.appendChild(btn);
            });
        } catch(e) { showError(e.message); }
    }

    async function renderLikedAds() {
        try {
            const allItems = await fetchItems();
            const liked = getLikes();
            const likedItems = allItems.filter(function(it) { return liked.includes(it.id); });
            await renderMiniAdList('liked-container', likedItems, function(div, it) {
                const btn = document.createElement('button');
                btn.textContent = 'Убрать';
                btn.className = 'btn-secondary btn-sm';
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    toggleLike(it.id);
                    renderLikedAds();
                });
                div.appendChild(btn);
            });
        } catch(e) { showError(e.message); }
    }

    async function renderHiddenAds() {
        try {
            const allItems = await fetchItems();
            const hidden = getHidden();
            const hiddenItems = allItems.filter(function(it) { return hidden.includes(it.id); });
            await renderMiniAdList('hidden-container', hiddenItems, function(div, it) {
                const btn = document.createElement('button');
                btn.textContent = 'Показать';
                btn.className = 'btn-secondary btn-sm';
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    unhideItem(it.id);
                    renderHiddenAds();
                });
                div.appendChild(btn);
            });
        } catch(e) { showError(e.message); }
    }

    async function renderBookedAds() {
        try {
            const allItems = await fetchItems();
            const me = getCurrentUser().phone;
            const booked = allItems.filter(function(it) { return it.bookedBy === me && it.userPhone !== me; });
            await renderMiniAdList('booked-container', booked, function(div, it) {
                const btn = document.createElement('button');
                btn.textContent = 'Отменить бронь';
                btn.className = 'btn-secondary btn-sm';
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    cancelBooking(it.id).then(function() { renderBookedAds(); });
                });
                div.appendChild(btn);
            });
        } catch(e) { showError(e.message); }
    }

    document.getElementById('clear-hidden-btn').addEventListener('click', function() {
        showConfirm('Сбросить все скрытые объявления?', function() {
            setHidden([]);
            renderHiddenAds();
            showSuccess('Скрытые объявления сброшены');
        });
    });

    // ── Toggle instructions ──────────────────────────────────
    toggleBtn.addEventListener('click', function() {
        instructions.style.display = instructions.style.display === 'none' ? '' : 'none';
    });

    // ── Nav buttons ──────────────────────────────────────────
    document.getElementById('nav-listings').addEventListener('click', showMain);
    document.getElementById('nav-add').addEventListener('click', showAdd);
    document.getElementById('nav-profile').addEventListener('click', showProfile);
    document.getElementById('cancel-add-btn').addEventListener('click', showMain);

    // ── Item form submit ─────────────────────────────────────
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        setInlineError('form-error', '');
        const data = new FormData(form);
        const cat = data.get('category');
        if (!cat) { setInlineError('form-error', 'Выберите категорию'); return; }
        const ageMarkers = [];
        const checks = document.querySelectorAll('#age-checkboxes input[name="age"]:checked');
        Array.from(checks).forEach(function(c) { ageMarkers.push(c.value); });
        if (ageMarkers.length === 0) ageMarkers.push('на любой возраст');
        const coords = geoCache[data.get('location')] || null;
        const files = form.querySelector('[name="attachments"]').files;
        const filePromises = [];
        for (let i = 0; i < files.length && i < 5; i++) {
            const file = files[i];
            filePromises.push(new Promise(function(resolve) {
                const reader = new FileReader();
                reader.onload = function() { resolve({type: file.type, data: reader.result}); };
                reader.readAsDataURL(file);
            }));
        }
        const att = await Promise.all(filePromises);
        const item = {
            title: data.get('title'),
            description: data.get('description'),
            category: cat,
            subcategory: data.get('subcategory') || '',
            location: data.get('location'),
            price: data.get('price') || '',
            bank: data.get('bank') || '',
            ageMarkers: ageMarkers,
            userPhone: getCurrentUser().phone,
            attachments: att,
            coords: coords
        };
        try {
            if (form._editId != null) {
                await putItem(form._editId, item);
                showSuccess('Объявление обновлено!');
            } else {
                await postItem(item);
                showSuccess('Объявление опубликовано!');
            }
        } catch(e) {
            setInlineError('form-error', e.message);
            return;
        }
        await showMain();
        form.reset();
        form._coords = null;
        form._editId = null;
    });

    // ── Login ────────────────────────────────────────────────
    loginFormDiv.querySelector('form').addEventListener('submit', async function(e) {
        e.preventDefault();
        setInlineError('login-error', '');
        const fd = new FormData(e.target);
        try {
            const data = await apiFetch('/api/login', {
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body: JSON.stringify({phone: fd.get('phone'), password: fd.get('password')})
            });
            setCurrentUser(data.user, fd.get('remember') === 'on');
            authContainer.style.display = 'none';
            await loadCategories();
            rebuildCategoryFilter();
            await showMain();
        } catch(e) {
            setInlineError('login-error', e.message);
        }
    });
    loginFormDiv.querySelector('#show-register').addEventListener('click', function(e) { e.preventDefault(); showRegister(); });

    // ── Register ─────────────────────────────────────────────
    registerFormDiv.querySelector('form').addEventListener('submit', async function(e) {
        e.preventDefault();
        setInlineError('register-error', '');
        const fd = new FormData(e.target);
        if (fd.get('password') !== fd.get('password2')) {
            setInlineError('register-error', 'Пароли не совпадают');
            return;
        }
        const availability = {};
        ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].forEach(function(day) {
            const time = fd.get('time-' + day);
            if (time) availability[day] = time;
        });
        const addressDetails = {
            building: fd.get('building'), floor: fd.get('floor'),
            unit: fd.get('unit'), intercom: fd.get('intercom'), gate: fd.get('gate')
        };
        try {
            const data = await apiFetch('/api/register', {
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body: JSON.stringify({
                    name: fd.get('name'), phone: fd.get('phone'),
                    password: fd.get('password'), address: fd.get('address'),
                    availability: availability, addressDetails: addressDetails
                })
            });
            setCurrentUser(data.user);
            authContainer.style.display = 'none';
            await loadCategories();
            rebuildCategoryFilter();
            await showMain();
        } catch(e) {
            setInlineError('register-error', e.message);
        }
    });
    registerFormDiv.querySelector('#show-login').addEventListener('click', function(e) { e.preventDefault(); showLoginView(); });

    // ── Profile helpers ──────────────────────────────────────
    const profileView = document.getElementById('profile-view');
    const profileEdit = document.getElementById('profile-edit');
    function populateProfileView() {
        const user = getCurrentUser();
        if (!user) return;
        document.getElementById('profile-name').textContent = user.name || '';
        document.getElementById('profile-phone').textContent = user.phone || '';
        const addrElem = document.getElementById('profile-address');
        addrElem.textContent = user.address || '';
        if (user.addressDetails) {
            const det = ['building','floor','unit','intercom','gate']
                .filter(function(k) { return user.addressDetails[k]; })
                .map(function(k) { return user.addressDetails[k]; });
            if (det.length) addrElem.textContent += ' (' + det.join(', ') + ')';
        }
        const ul = document.getElementById('profile-availability');
        ul.innerHTML = '';
        if (user.availability) {
            Object.entries(user.availability).forEach(function(entry) {
                const li = document.createElement('li');
                li.textContent = entry[0] + ': ' + entry[1];
                ul.appendChild(li);
            });
        }
    }
    document.getElementById('edit-profile-btn').addEventListener('click', function() {
        profileView.style.display = 'none';
        profileEdit.style.display = '';
        const user = getCurrentUser();
        const pf = document.getElementById('profile-form');
        pf.name.value = user.name || '';
        pf.address.value = user.address || '';
        if (user.addressDetails) {
            pf.building.value = user.addressDetails.building || '';
            pf.floor.value = user.addressDetails.floor || '';
            pf.unit.value = user.addressDetails.unit || '';
            pf.intercom.value = user.addressDetails.intercom || '';
            pf.gate.value = user.addressDetails.gate || '';
        }
        ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].forEach(function(day) {
            pf['time-' + day].value = user.availability && user.availability[day] ? user.availability[day] : '';
        });
        setInlineError('profile-form-error', '');
    });
    document.getElementById('cancel-profile-edit').addEventListener('click', function() {
        profileEdit.style.display = 'none';
        profileView.style.display = '';
    });
    document.getElementById('profile-form').addEventListener('submit', async function(e) {
        e.preventDefault();
        setInlineError('profile-form-error', '');
        const fd = new FormData(e.target);
        const current = getCurrentUser();
        const availability = {};
        ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].forEach(function(day) {
            const time = fd.get('time-' + day);
            if (time) availability[day] = time;
        });
        const updated = {
            name: fd.get('name'),
            address: fd.get('address'),
            addressDetails: {
                building: fd.get('building'), floor: fd.get('floor'),
                unit: fd.get('unit'), intercom: fd.get('intercom'), gate: fd.get('gate')
            },
            availability: availability
        };
        const newPass = fd.get('password');
        if (newPass) updated.password = newPass;
        try {
            const data = await apiFetch('/api/users/' + current.id, {
                method:'PUT',
                headers:{'Content-Type':'application/json'},
                body: JSON.stringify(updated)
            });
            setCurrentUser(data.user);
            profileEdit.style.display = 'none';
            profileView.style.display = '';
            populateProfileView();
            showSuccess('Профиль сохранён');
        } catch(e) {
            setInlineError('profile-form-error', e.message);
        }
    });
    document.getElementById('logout-btn').addEventListener('click', function() {
        localStorage.removeItem('currentUser');
        sessionStorage.removeItem('currentUser');
        authContainer.style.display = '';
        navBar.style.display = 'none';
        hideAllSections();
        showLoginView();
    });
    document.getElementById('delete-profile-btn').addEventListener('click', function() {
        showConfirm('Удалить аккаунт? Это действие необратимо.', async function() {
            const user = getCurrentUser();
            try { await apiFetch('/api/users/' + user.id, {method:'DELETE'}); } catch(e) {}
            localStorage.removeItem('currentUser');
            sessionStorage.removeItem('currentUser');
            authContainer.style.display = '';
            navBar.style.display = 'none';
            hideAllSections();
            showLoginView();
        });
    });

    // ── Age filter ───────────────────────────────────────────
    function getSelectedAges() {
        return Array.from(document.querySelectorAll('#age-filter input[name="age-filter"]:checked')).map(function(c) { return c.value; });
    }
    document.querySelectorAll('#age-filter input[name="age-filter"]').forEach(function(ch) {
        ch.addEventListener('change', function() { showMain(); });
    });
    document.getElementById('show-my-ads').addEventListener('click', function() {
        showOnlyMy = !showOnlyMy;
        document.getElementById('show-my-ads').textContent = showOnlyMy ? 'Все объявления' : 'Мои объявления';
        showMain();
    });

    // ── Geosuggest ───────────────────────────────────────────
    const geoCache = {};
    async function fetchGeo(q) {
        if (!q) return [];
        try {
            const res = await fetch('/api/geocode?q=' + encodeURIComponent(q));
            if (!res.ok) return [];
            return await res.json();
        } catch (e) { return []; }
    }
    function attachGeosuggest(inputEl) {
        const listId = inputEl.getAttribute('list');
        if (!listId) return;
        const listEl = document.getElementById(listId);
        inputEl.addEventListener('input', async function() {
            const q = inputEl.value.trim();
            if (q.length < 3) return;
            const suggestions = await fetchGeo(q);
            listEl.innerHTML = '';
            suggestions.forEach(function(s) {
                const opt = document.createElement('option');
                opt.value = s.text;
                opt.dataset.coords = s.coords.join(',');
                listEl.appendChild(opt);
            });
        });
        inputEl.addEventListener('change', function() {
            const val = inputEl.value;
            const opt = Array.from(listEl.options).find(function(o) { return o.value === val; });
            if (opt) geoCache[val] = opt.dataset.coords.split(',').map(Number);
            else delete geoCache[val];
        });
    }
    const locInput = document.getElementById('location-input');
    if (locInput) attachGeosuggest(locInput);

    // ── Password toggles ─────────────────────────────────────
    document.querySelectorAll('.toggle-password').forEach(function(btn) {
        btn.addEventListener('click', function() {
            const input = btn.previousElementSibling;
            if (input && input.type === 'password') input.type = 'text';
            else if (input) input.type = 'password';
        });
    });

    // ── Mobile detection + mode buttons ─────────────────────
    function isMobile() {
        return window.innerWidth <= 768 || ('ontouchstart' in window);
    }
    function detectMobileModeBtns() {
        const modeBtns = document.getElementById('mobile-mode-btns');
        if (modeBtns) modeBtns.style.display = isMobile() ? '' : 'none';
    }

    // ── TikTok mode ──────────────────────────────────────────
    document.getElementById('tiktok-mode-btn').addEventListener('click', async function() {
        await openTikTokMode();
    });
    document.getElementById('tiktok-close').addEventListener('click', function() {
        document.getElementById('tiktok-overlay').style.display = 'none';
    });

    async function openTikTokMode() {
        let items;
        try { items = await fetchItems(); } catch(e) { showError(e.message); return; }
        const me = getCurrentUser().phone;
        const hidden = getHidden();
        items = items.filter(function(it) { return !hidden.includes(it.id) && it.userPhone !== me; });
        items = items.filter(function(it) {
            if (it.bookedBy && it.bookedBy !== me && it.userPhone !== me) return false;
            return true;
        });
        if (activeCategory) items = items.filter(function(it) { return it.category === activeCategory; });

        const feed = document.getElementById('tiktok-feed');
        feed.innerHTML = '';
        if (items.length === 0) {
            feed.innerHTML = '<div class="tiktok-empty">Нет объявлений</div>';
        }
        items.forEach(function(it) {
            const card = document.createElement('div');
            card.className = 'tiktok-card';
            let img = '';
            if (it.attachments && it.attachments.length) {
                const ia = it.attachments.find(function(a) { return a.type.startsWith('image/'); });
                if (ia) img = '<img src="' + ia.data + '" class="tiktok-img" alt="">';
            }
            const liked = isLiked(it.id);
            card.innerHTML = (img || '<div class="tiktok-no-img">📦</div>') +
                '<div class="tiktok-info"><h3>' + escHtml(it.title) + '</h3><p>' + escHtml(it.description || '') + '</p>' +
                (it.category ? '<span class="cat-badge">' + escHtml(it.category) + '</span>' : '') +
                '<small>📍 ' + escHtml(it.location || '') + '</small></div>' +
                '<div class="tiktok-actions">' +
                '<button class="tiktok-like-btn' + (liked ? ' liked' : '') + '" data-id="' + it.id + '">♥</button>' +
                (!it.bookedBy ? '<button class="tiktok-book-btn btn-sm" data-id="' + it.id + '">Бронь</button>' : '') +
                '</div>';
            card.querySelector('.tiktok-like-btn').addEventListener('click', function(e) {
                e.stopPropagation();
                const nowLiked = toggleLike(it.id);
                e.target.classList.toggle('liked', nowLiked);
                showToast(nowLiked ? '❤️' : '🤍', 'success', 1200);
            });
            const bookBtn = card.querySelector('.tiktok-book-btn');
            if (bookBtn) {
                bookBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    bookItem(it.id).then(function() { openTikTokMode(); });
                });
            }
            card.addEventListener('click', function() { openModal(it); });
            feed.appendChild(card);
        });
        document.getElementById('tiktok-overlay').style.display = 'flex';
    }

    // ── Tinder mode ──────────────────────────────────────────
    document.getElementById('tinder-mode-btn').addEventListener('click', async function() {
        await openTinderMode();
    });
    document.getElementById('tinder-close').addEventListener('click', function() {
        document.getElementById('tinder-overlay').style.display = 'none';
    });

    let tinderItems = [];
    let tinderIndex = 0;

    async function openTinderMode() {
        let items;
        try { items = await fetchItems(); } catch(e) { showError(e.message); return; }
        const me = getCurrentUser().phone;
        const hidden = getHidden();
        items = items.filter(function(it) { return !hidden.includes(it.id) && it.userPhone !== me; });
        items = items.filter(function(it) {
            if (it.bookedBy && it.bookedBy !== me) return false;
            return true;
        });
        if (activeCategory) items = items.filter(function(it) { return it.category === activeCategory; });

        tinderItems = items;
        tinderIndex = 0;
        renderTinderCard();
        document.getElementById('tinder-overlay').style.display = 'flex';
    }

    function renderTinderCard() {
        const stack = document.getElementById('tinder-stack');
        stack.innerHTML = '';
        if (tinderIndex >= tinderItems.length) {
            stack.innerHTML = '<div class="tinder-empty">Карточки закончились 🎉</div>';
            return;
        }
        const it = tinderItems[tinderIndex];
        const card = document.createElement('div');
        card.className = 'tinder-card';
        let img = '';
        if (it.attachments && it.attachments.length) {
            const ia = it.attachments.find(function(a) { return a.type.startsWith('image/'); });
            if (ia) img = '<img src="' + ia.data + '" class="tinder-img" alt="">';
        }
        card.innerHTML = (img || '<div class="tinder-no-img">📦</div>') +
            '<div class="tinder-info"><h3>' + escHtml(it.title) + '</h3><p>' + escHtml(it.description || '') + '</p>' +
            (it.category ? '<span class="cat-badge">' + escHtml(it.category) + '</span>' : '') +
            '<small>📍 ' + escHtml(it.location || '') + '</small></div>' +
            '<div class="tinder-swipe-label"></div>';
        setupTinderSwipe(card, it);
        stack.appendChild(card);
    }

    function setupTinderSwipe(card, it) {
        let startX = 0, currentX = 0, dragging = false;
        const label = card.querySelector('.tinder-swipe-label');

        function onStart(x) { startX = x; dragging = true; }
        function onMove(x) {
            if (!dragging) return;
            currentX = x - startX;
            card.style.transform = 'translateX(' + currentX + 'px) rotate(' + (currentX * 0.05) + 'deg)';
            if (currentX > 30) { label.textContent = '❤️ нравится'; label.className = 'tinder-swipe-label label-like'; }
            else if (currentX < -30) { label.textContent = '✕ скрыть'; label.className = 'tinder-swipe-label label-nope'; }
            else { label.textContent = ''; label.className = 'tinder-swipe-label'; }
        }
        function onEnd() {
            if (!dragging) return;
            dragging = false;
            if (currentX > 80) { tinderSwipe('like', card, it); }
            else if (currentX < -80) { tinderSwipe('nope', card, it); }
            else { card.style.transform = ''; label.textContent = ''; label.className = 'tinder-swipe-label'; }
            currentX = 0;
        }
        card.addEventListener('touchstart', function(e) { onStart(e.touches[0].clientX); }, {passive:true});
        card.addEventListener('touchmove', function(e) { onMove(e.touches[0].clientX); }, {passive:true});
        card.addEventListener('touchend', onEnd);
        card.addEventListener('mousedown', function(e) { onStart(e.clientX); });
        document.addEventListener('mousemove', function(e) { if (dragging) onMove(e.clientX); });
        document.addEventListener('mouseup', onEnd);
    }

    function tinderSwipe(action, card, it) {
        const dir = action === 'like' ? 1 : -1;
        card.style.transition = 'transform 0.4s, opacity 0.4s';
        card.style.transform = 'translateX(' + (dir * 150) + '%) rotate(' + (dir * 20) + 'deg)';
        card.style.opacity = '0';
        if (action === 'like') {
            toggleLike(it.id);
            showToast('❤️ Добавлено в лайки', 'success', 1200);
        } else {
            hideItemLocal(it.id);
        }
        tinderIndex++;
        setTimeout(function() { renderTinderCard(); }, 400);
    }

    document.getElementById('tinder-like').addEventListener('click', function() {
        const card = document.querySelector('.tinder-card');
        if (!card || tinderIndex >= tinderItems.length) return;
        tinderSwipe('like', card, tinderItems[tinderIndex]);
    });
    document.getElementById('tinder-nope').addEventListener('click', function() {
        const card = document.querySelector('.tinder-card');
        if (!card || tinderIndex >= tinderItems.length) return;
        tinderSwipe('nope', card, tinderItems[tinderIndex]);
    });

    // ── Startup ──────────────────────────────────────────────
    const rememberMsg = document.getElementById('remember-message');
    (async function() {
        await loadCategories();
        rebuildCategoryFilter();
        if (getCurrentUser()) {
            rememberMsg.style.display = '';
            setTimeout(function() {
                rememberMsg.style.display = 'none';
                authContainer.style.display = 'none';
                navBar.style.display = '';
                hideAllSections();
                showMain().catch(function(e) { console.error('startup showMain failed', e); });
            }, 3000);
        } else {
            authContainer.style.display = '';
            navBar.style.display = 'none';
            hideAllSections();
            showLoginView();
        }
    })();
});
