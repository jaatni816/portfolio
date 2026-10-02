(function(){
  var url = window.SUPABASE_URL || '';
  var key = window.SUPABASE_ANON_KEY || '';
  var supabase = null;

  var TABLES = { projects: 'projects', posts: 'posts' };

  var els = {
    noConfig: document.getElementById('noConfig'),
    logoutBtn: document.getElementById('logoutBtn'),
    toast: document.getElementById('toast'),
    pjBadge: document.getElementById('pjBadge'),
    psBadge: document.getElementById('psBadge'),
    skBadge: document.getElementById('skBadge')
  };

  var pj = {
    loadingBox: document.getElementById('loadingBox'),
    emptyBox: document.getElementById('emptyBox'),
    list: document.getElementById('list'),
    countText: document.getElementById('countText'),
    addBtn: document.getElementById('addBtn')
  };

  var ps = {
    loadingBox: document.getElementById('psLoadingBox'),
    emptyBox: document.getElementById('psEmptyBox'),
    list: document.getElementById('psList'),
    countText: document.getElementById('psCountText'),
    addBtn: document.getElementById('addPostBtn')
  };

  var pjModal = {
    root: document.getElementById('pjModal'),
    title: document.getElementById('pjModalTitle'),
    closeBtn: document.getElementById('pjCloseBtn'),
    cancelBtn: document.getElementById('pjCancelBtn'),
    form: document.getElementById('projectForm'),
    formErr: document.getElementById('pjFormErr'),
    fTitle: document.getElementById('fTitle'),
    fDesc: document.getElementById('fDesc'),
    fTech: document.getElementById('fTech'),
    fLive: document.getElementById('fLive'),
    fGit: document.getElementById('fGit'),
    fFeatured: document.getElementById('fFeatured'),
    fImg: document.getElementById('fImg'),
    imgPreview: document.getElementById('imgPreview'),
    uploadState: document.getElementById('uploadState'),
    saveBtn: document.getElementById('saveBtn')
  };

  var psModal = {
    root: document.getElementById('psModal'),
    title: document.getElementById('psModalTitle'),
    closeBtn: document.getElementById('psCloseBtn'),
    cancelBtn: document.getElementById('psCancelBtn'),
    form: document.getElementById('postForm'),
    formErr: document.getElementById('psFormErr'),
    fTitle: document.getElementById('psTitle'),
    fSlug: document.getElementById('psSlug'),
    fCategory: document.getElementById('psCategory'),
    fExcerpt: document.getElementById('psExcerpt'),
    fContent: document.getElementById('psContent'),
    fImg: document.getElementById('psImg'),
    imgPreview: document.getElementById('psImgPreview'),
    uploadState: document.getElementById('psUploadState'),
    fPublished: document.getElementById('psPublished'),
    saveBtn: document.getElementById('psSaveBtn')
  };

  var activeView = 'overview';
  var pjUploadedUrl = null;
  var psUploadedUrl = null;
  var pjEditingId = null;
  var pjEditingSlug = '';
  var psEditingId = null;

  var st = {
    loadingBox: document.getElementById('stLoadingBox'),
    wrap: document.getElementById('stWrap'),
    formErr: document.getElementById('stFormErr'),
    saveBtn: document.getElementById('stSaveBtn'),
    state: document.getElementById('stState'),
    fields: {
      site_name: 'stSiteName',
      tagline: 'stTagline',
      email: 'stEmail',
      location: 'stLocation',
      about: 'stAbout',
      github: 'stGithub',
      linkedin: 'stLinkedin',
      twitter: 'stTwitter',
      instagram: 'stInstagram'
    }
  };

  var sk = {
    loadingBox: document.getElementById('skLoadingBox'),
    emptyBox: document.getElementById('skEmptyBox'),
    list: document.getElementById('skList'),
    countText: document.getElementById('skCountText'),
    addBtn: document.getElementById('addSkillBtn')
  };

  var skModal = {
    root: document.getElementById('skModal'),
    title: document.getElementById('skModalTitle'),
    closeBtn: document.getElementById('skCloseBtn'),
    cancelBtn: document.getElementById('skCancelBtn'),
    form: document.getElementById('skillForm'),
    formErr: document.getElementById('skFormErr'),
    fName: document.getElementById('skName'),
    fCategory: document.getElementById('skCategory'),
    fIcon: document.getElementById('skIcon'),
    iconPreview: document.getElementById('skIconPreview'),
    fOrder: document.getElementById('skOrder'),
    saveBtn: document.getElementById('skSaveBtn')
  };

  var skEditingId = null;

  var cache = { projects: null, posts: null, skills: null, settings: null };

  // ---------- speed / reliability helpers ----------
  var NET_TIMEOUT = 15000;   // kisi bhi query par max wait
  var SLOW_MS = 5000;        // isse zyada laga to "retry" hint
  var CACHE_PREFIX = 'pf_admin_v2:';
  var CACHE_TTL = 10 * 60 * 1000;
  var retryFn = null;

  function withTimeout(promise, ms, label){
    return new Promise(function(resolve, reject){
      var settled = false;
      var t = setTimeout(function(){
        if(settled) return;
        settled = true;
        reject(new Error(label + ' time out ho gaya (' + Math.round(ms / 1000) + 's). Network slow ya blocked hai.'));
      }, ms);
      promise.then(function(v){
        if(settled) return;
        settled = true;
        clearTimeout(t);
        resolve(v);
      }, function(e){
        if(settled) return;
        settled = true;
        clearTimeout(t);
        reject(e);
      });
    });
  }

  // localStorage cache — dobara khologe to data turant dikhega
  function readStored(key){
    try{
      var raw = localStorage.getItem(CACHE_PREFIX + key);
      if(!raw) return null;
      var o = JSON.parse(raw);
      if(!o || !o.rows) return null;
      if(Date.now() - (o.at || 0) > CACHE_TTL) return null;
      return o.rows;
    }catch(e){ return null; }
  }

  function writeStored(key, rows){
    try{
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), rows: rows }));
    }catch(e){}
  }

  function dropStored(key){
    try{ localStorage.removeItem(CACHE_PREFIX + key); }catch(e){}
  }

  function invalidate(key){
    cache[key] = null;
    dropStored(key);
  }

  // loading box + slow hint (retry button)
  function showLoading(box, label){
    if(!box) return;
    box.style.display = 'flex';
    box.innerHTML = '<span class="spinner"></span> <span>' + label + '</span>';
    clearTimeout(box._slowT);
    box._slowT = setTimeout(function(){
      box.innerHTML = '<span class="spinner"></span> <span>' + label + ' (network slow…)</span>' +
        ' <button type="button" class="retrybtn" data-retry="1">Retry</button>';
    }, SLOW_MS);
  }

  function hideLoading(box){
    if(!box) return;
    clearTimeout(box._slowT);
    box.style.display = 'none';
  }

  function retryBox(msg){
    return msg + '<br><button type="button" class="btn btn-primary" data-retry="1" style="margin-top:14px;">Retry</button>';
  }

  function netError(err, table){
    var m = (err && err.message) || 'unknown error';
    if(/time out|Failed to fetch|NetworkError|fetch failed/i.test(m)){
      return '<strong>Connection slow ya blocked hai.</strong><br>' + esc(m) +
        '<br><small>Internet check karo, phir Retry dabao.</small>';
    }
    return dbErrorMessage(err, table);
  }

  function esc(s){
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function slugify(s){
    return String(s || '')
      .toLowerCase()
      .replace(/['"]/g, '')
      .replace(/[^a-z0-9\u0900-\u097F]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  function fmtDate(iso){
    if(!iso) return '—';
    var d = new Date(iso);
    if(isNaN(d)) return '—';
    return d.getDate() + ' ' + ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()] + ' ' + d.getFullYear();
  }

  function toast(msg, type){
    els.toast.textContent = msg;
    els.toast.className = 'toast show ' + (type === 'ok' ? 'ok' : 'err');
    clearTimeout(toast._t);
    toast._t = setTimeout(function(){ els.toast.className = 'toast'; }, 3200);
  }

  var tabsBound = false;
  function tabs(){
    if(tabsBound) return;               // retry par dobara listener mat lagao
    tabsBound = true;
    document.querySelectorAll('.tab').forEach(function(t){
      t.addEventListener('click', function(){
        switchView(t.getAttribute('data-view'));
      });
    });
    document.querySelectorAll('[data-goto]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var v = btn.getAttribute('data-goto');
        switchView(v);
        if(btn.getAttribute('data-new') === 'project'){ openProjectModal('new'); }
        if(btn.getAttribute('data-new') === 'post'){ openPostModal('new'); }
      });
    });
  }

  function switchView(v){
    activeView = v;
    document.querySelectorAll('.tab').forEach(function(t){
      t.classList.toggle('active', t.getAttribute('data-view') === v);
    });
    document.querySelectorAll('.view').forEach(function(sec){
      sec.classList.toggle('active', sec.id === 'view-' + v);
    });
    if(v === 'overview'){ loadOverview(); }
    if(v === 'projects'){ loadProjects(); }
    if(v === 'posts'){ loadPosts(); }
    if(v === 'skills'){ loadSkills(); }
    if(v === 'settings'){ loadSettings(); }
  }

  // ---------- fatal / setup errors ----------
function showFatal(type, table){
    els.noConfig.style.display = 'block';
    document.querySelectorAll('.sidebar .tab').forEach(function(t){ t.disabled = true; });
    if(type === 'config'){
      els.noConfig.innerHTML = '<strong>Supabase config set nahi hui.</strong><br><code>supabase.config.js</code> mein <code>SUPABASE_URL</code> aur <code>SUPABASE_ANON_KEY</code> bharo.' +
        '<br><small>Diagnostic: URL=' + (url ? '(set)' : 'EMPTY') + ', KEY=' + (key ? '(set)' : 'EMPTY') + '</small>';
    } else if(type === 'cdn'){
      els.noConfig.innerHTML = retryBox('<strong>supabase-js library load nahi hua.</strong><br>CDN block ya slow hai. Internet check karo aur Retry dabao.');
    } else if(type === 'client'){
      els.noConfig.innerHTML = retryBox('<strong>Supabase client initialize nahi hua.</strong><br>Apni SUPABASE_URL check karo — aisa dikhna chahiye: <code>https://abcdefgh.supabase.co</code>');
    } else {
      els.noConfig.innerHTML = retryBox('<strong>Backend se connect nahi hua.</strong><br>Network check karke Retry dabao.');
    }
  }

  function dbErrorMessage(err, table){
    var m = (err && err.message) ? err.message : '';
    if(/relation .* does not exist|could not find the table|PGRST205/i.test(m)){
      return table === 'posts'
        ? `<strong>Table "posts" abhi banai nahi hai.</strong><br>Supabase Dashboard &rarr; SQL Editor mein ye SQL chalao:<br><pre style="text-align:left;background:#0f1222;color:#a5f3fc;padding:10px 12px;border-radius:10px;font-size:.72rem;overflow:auto;">create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  content text,
  category text default 'AI tools',
  image_url text,
  published boolean default true,
  published_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.posts enable row level security;

create policy "posts_select" on public.posts for select using (true);
create policy "posts_insert" on public.posts for insert to authenticated with check (true);
create policy "posts_update" on public.posts for update to authenticated using (true);
create policy "posts_delete" on public.posts for delete to authenticated using (true);</pre>Phir <strong>Ctrl+Shift+R</strong> se refresh karo.`
        : table === 'skills'
        ? `<strong>Table "skills" abhi banai nahi hai.</strong><br>Supabase Dashboard &rarr; SQL Editor mein ye SQL chalao:<br><pre style="text-align:left;background:#0f1222;color:#a5f3fc;padding:10px 12px;border-radius:10px;font-size:.72rem;overflow:auto;">create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon_url text,
  category text default 'AI tools',
  sort_order int default 0,
  created_at timestamptz default now()
);

alter table public.skills enable row level security;

create policy "skills_read" on public.skills for select using (true);
create policy "skills_insert" on public.skills for insert to authenticated with check (true);
create policy "skills_update" on public.skills for update to authenticated using (true);
create policy "skills_delete" on public.skills for delete to authenticated using (true);</pre>Phir <strong>Ctrl+Shift+R</strong> se refresh karo.`
        : `<strong>Table "projects" abhi banai nahi hai.</strong><br>Supabase Dashboard &rarr; SQL Editor mein ye SQL chalao:<br><pre style="text-align:left;background:#0f1222;color:#a5f3fc;padding:10px 12px;border-radius:10px;font-size:.72rem;overflow:auto;">create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text,
  tech_stack text[] default '{}',
  features text[] default '{}',
  year text,
  role text,
  image_url text,
  live_url text,
  github_url text,
  featured boolean default false,
  created_at timestamptz default now()
);

alter table public.projects enable row level security;

create policy "projects_select" on public.projects for select using (true);
create policy "projects_insert" on public.projects for insert to authenticated with check (true);
create policy "projects_update" on public.projects for update to authenticated using (true);
create policy "projects_delete" on public.projects for delete to authenticated using (true);</pre>Phir <strong>Ctrl+Shift+R</strong> se refresh karo.`;
    }
    if(/permission|policy|RLS|42501/i.test(m)){
      return '<strong>SELECT policy nahi hai.</strong><br>"' + table + '" table pe public read policy set karo: <code>create policy ... for select using (true);</code>';
    }
    return '<strong>' + table + ' load nahi hua:</strong><code style="display:block;margin-top:6px;">' + esc(m) + '</code>';
  }

  function resetDbError(table){
    if(table === 'projects'){
      pj.emptyBox.className = 'empty';
      pj.emptyBox.style.display = 'none';
    } else {
      ps.emptyBox.className = 'empty';
      ps.emptyBox.style.display = 'none';
    }
  }

  // ---------- upload helper ----------
  function handleUpload(e, bucket, prefix, modal, cb){
    var file = e.target.files && e.target.files[0];
    if(!file) return;
    if(!/image\/(png|jpeg|webp|jpg)/.test(file.type)){
      showFormErr(modal, 'Sirf PNG/JPEG/WebP images allowed hain.');
      e.target.value = '';
      return;
    }
    if(file.size > 2 * 1024 * 1024){
      showFormErr(modal, 'Image 2MB se bada hai. Chhoti image use karo.');
      e.target.value = '';
      return;
    }
    modal.uploadState.textContent = 'Upload ho raha hai…';
    var path = prefix + '-' + Date.now() + '-' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');

    supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false }).then(function(up){
      if(up.error){
        showFormErr(modal, 'Upload fail hua: ' + (up.error.message || 'storage error') + '. Bucket "' + bucket + '" + Storage policy check karo.');
        modal.uploadState.textContent = 'Upload fail. Phir try karo.';
        e.target.value = '';
        return;
      }
      var pub = supabase.storage.from(bucket).getPublicUrl(path);
      cb(pub.data.publicUrl);
      var img = '<img src="' + pub.data.publicUrl + '" alt="Upload preview">';
      modal.imgPreview.innerHTML = img;
      modal.uploadState.textContent = 'Uploaded ✓ — public URL save ho jayegi.';
      hideFormErr(modal);
    }).catch(function(err){
      showFormErr(modal, 'Upload error: ' + (err && err.message ? err.message : 'unknown'));
      modal.uploadState.textContent = 'Upload fail. Phir try karo.';
    });
  }

  function setPreview(modal, src){
    modal.imgPreview.innerHTML = src
      ? '<img src="' + src.split('?')[0] + '" alt="Preview">'
      : '<span class="ph">IMG</span>';
  }

  function showFormErr(modal, msg){
    modal.formErr.textContent = msg;
    modal.formErr.classList.add('show');
  }
  function hideFormErr(modal){
    modal.formErr.classList.remove('show');
  }

  function openModal(root){
    root.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeModal(root){
    root.classList.remove('open');
    document.body.style.overflow = '';
  }

  // ---------- PROJECTS ----------
  function sortProjects(rows){
    // featured projects always first, phir naya pehle
    return (rows || []).slice().sort(function(a, b){
      var fa = a.featured === true ? 1 : 0;
      var fb = b.featured === true ? 1 : 0;
      if(fa !== fb) return fb - fa;
      var ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      var tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });
  }

  function renderProjects(rows){
    if(!rows || !rows.length){
      pj.list.style.display = 'none';
      pj.emptyBox.style.display = 'block';
      pj.emptyBox.innerHTML = '<strong>Abhi koi project nahi hai.</strong><br><button type="button" class="btn btn-primary" id="emptyAddBtn2" style="margin-top:14px;">+ Add first project</button>';
      pj.countText.textContent = '0 projects';
      els.pjBadge.textContent = 0;
      var bt = document.getElementById('emptyAddBtn2');
      if(bt) bt.addEventListener('click', function(){ openProjectModal('new'); });
      return;
    }
    rows = sortProjects(rows);
    var featuredCount = rows.filter(function(p){ return p.featured === true; }).length;
    pj.emptyBox.style.display = 'none';
    pj.list.style.display = 'grid';
    pj.countText.textContent = rows.length + ' project' + (rows.length > 1 ? 's' : '') +
      (featuredCount ? ' · ' + featuredCount + ' featured' : '');
    els.pjBadge.textContent = rows.length;

    var html = rows.map(function(p){
      var thumb = p.image_url
        ? '<img src="' + p.image_url.split('?')[0] + '" alt="' + esc(p.title) + ' screenshot" loading="lazy">'
        : '<span class="ph">' + esc((p.title || '?').slice(0, 1).toUpperCase()) + '</span>';
      var tech = (p.tech_stack || []).map(function(t){ return '<span>' + esc(t) + '</span>'; }).join('');
      var meta = [];
      if(p.year) meta.push(esc(p.year));
      if(p.role) meta.push(esc(p.role));
      if(p.live_url) meta.push('<a href="' + esc(p.live_url) + '" target="_blank" rel="noopener">Live</a>');
      if(p.github_url) meta.push('<a href="' + esc(p.github_url) + '" target="_blank" rel="noopener">Code</a>');
      return '<div class="item">' +
        '<div class="thumb" aria-hidden="true">' + thumb + '</div>' +
        '<div class="item-body">' +
          '<div class="item-top"><span class="item-title">' + esc(p.title) + '</span>' +
            (p.featured === true ? '<span class="cat">Featured</span>' : '') +
            (p.slug ? '<span class="slug">/' + esc(p.slug) + '</span>' : '') + '</div>' +
          '<div class="item-desc">' + esc(p.description) + '</div>' +
          (tech ? '<div class="tech">' + tech + '</div>' : '') +
          (meta.length ? '<div class="item-meta">' + meta.join(' · ') + '</div>' : '') +
        '</div>' +
        '<div class="item-actions">' +
          '<button type="button" class="chip edit" data-pedit="' + (p.id || '') + '">Edit</button>' +
          '<button type="button" class="chip del" data-pdel="' + (p.id || '') + '">Delete</button>' +
        '</div>' +
      '</div>';
    }).join('');
    pj.list.innerHTML = html;
  }

  function loadProjects(force){
    if(!supabase){ showFatal('client'); return; }
    if(cache.projects && !force){
      renderProjects(cache.projects);
      return;
    }

    // purana data turant dikhao (stale-while-revalidate)
    var stored = readStored('projects');
    if(stored && !cache.projects){
      cache.projects = stored;
      renderProjects(stored);
    }

    if(cache.projects) hideLoading(pj.loadingBox);
    else showLoading(pj.loadingBox, 'Projects load ho rahe hain…');
    pj.emptyBox.style.display = 'none';
    pj.list.style.display = cache.projects ? 'grid' : 'none';

    withTimeout(
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      NET_TIMEOUT,
      'Projects'
    ).then(function(r){
      hideLoading(pj.loadingBox);
      if(r.error){
        if(cache.projects){
          // purana data dikhne do, upar se chhota error dikhao
          renderProjects(cache.projects);
          pj.emptyBox.style.display = 'none';
          pj.list.style.display = 'grid';
          toast('Projects refresh nahi hue — purana data dikh raha hai.', 'err');
          return;
        }
        pj.list.style.display = 'none';
        pj.emptyBox.style.display = 'block';
        pj.emptyBox.className = 'empty';
        pj.emptyBox.innerHTML = retryBox(netError(r.error, TABLES.projects));
        return;
      }
      cache.projects = r.data;
      writeStored('projects', r.data);
      renderProjects(r.data);
    }).catch(function(err){
      hideLoading(pj.loadingBox);
      if(cache.projects){ renderProjects(cache.projects); toast('Projects refresh nahi hue.', 'err'); return; }
      pj.list.style.display = 'none';
      pj.emptyBox.style.display = 'block';
      pj.emptyBox.className = 'empty';
      pj.emptyBox.innerHTML = retryBox(netError(err, TABLES.projects));
    });
  }

  function openProjectModal(mode, row){
    hideFormErr(pjModal);
    hideFormErr(psModal);
    pjEditingId = null;
    pjEditingSlug = '';
    pjUploadedUrl = null;
    pjModal.fImg.value = '';
    setPreview(pjModal, null);

    if(mode === 'edit' && row){
      pjEditingId = row.id;
      pjEditingSlug = row.slug || '';
      pjModal.title.textContent = 'Edit project';
      pjModal.fTitle.value = row.title || '';
      pjModal.fDesc.value = row.description || '';
      pjModal.fTech.value = (row.tech_stack || []).join(', ');
      pjModal.fLive.value = row.live_url || '';
      pjModal.fGit.value = row.github_url || '';
      pjModal.fFeatured.checked = row.featured === true;
      pjUploadedUrl = row.image_url || null;
      setPreview(pjModal, pjUploadedUrl);
      pjModal.uploadState.textContent = pjUploadedUrl ? 'Current screenshot dikh raha hai. Nayi image choose kar sakte ho.' : 'Screenshot upload karna zaroori hai.';
    } else {
      pjModal.title.textContent = 'New project';
      pjModal.fTitle.value = '';
      pjModal.fDesc.value = '';
      pjModal.fTech.value = '';
      pjModal.fLive.value = '';
      pjModal.fGit.value = '';
      pjModal.fFeatured.checked = false;
      pjModal.uploadState.textContent = 'PNG/JPEG/WebP. Public bucket mein upload hota hai.';
    }
    openModal(pjModal.root);
    setTimeout(function(){ pjModal.fTitle.focus(); }, 60);
  }

  function saveProject(e){
    e.preventDefault();
    hideFormErr(pjModal);
    var title = pjModal.fTitle.value.trim();
    var desc = pjModal.fDesc.value.trim();

    if(!title){ showFormErr(pjModal, 'Title bharo (required).'); pjModal.fTitle.focus(); return; }
    if(!pjUploadedUrl){ showFormErr(pjModal, 'Screenshot upload karna zaroori hai — bina image project save nahi hoga.'); return; }

    var tech = pjModal.fTech.value.split(',').map(function(t){ return t.trim(); }).filter(Boolean);
    var data = {
      title: title,
      slug: pjEditingSlug || slugify(title),
      description: desc || null,
      tech_stack: tech,
      live_url: pjModal.fLive.value.trim() || null,
      github_url: pjModal.fGit.value.trim() || null,
      featured: pjModal.fFeatured.checked,
      image_url: pjUploadedUrl
    };

    pjModal.saveBtn.disabled = true;
    var old = pjModal.saveBtn.innerHTML;
    pjModal.saveBtn.innerHTML = 'Saving…';

    var op = pjEditingId
      ? supabase.from('projects').update(data).eq('id', pjEditingId)
      : supabase.from('projects').insert([data]);

    op.then(function(r){
      pjModal.saveBtn.disabled = false;
      pjModal.saveBtn.innerHTML = old;
      if(r.error){
        if(/duplicate|23505/i.test(r.error.message || '')){
          showFormErr(pjModal, 'Is title ka slug pehle se maujood hai — title thoda alag likho.');
        } else if(/permission|policy|RLS|42501/i.test(r.error.message || '')){
          showFormErr(pjModal, 'Save karne ki permission nahi: "projects" table pe INSERT/UPDATE policy (authenticated) set karni hai.');
        } else if(/column .* does not exist|42703|PGRST204/i.test(r.error.message || '')){
          showFormErr(pjModal, 'Kuch columns database me nahi hain. Supabase SQL Editor mein projects table me <code>tech_stack, featured, image_url</code> add karo.');
        } else {
          showFormErr(pjModal, 'Save fail hua: ' + (r.error.message || 'unknown error'));
        }
        return;
      }
      closeModal(pjModal.root);
      invalidate('projects');
      loadProjects();
      if(activeView === 'overview') loadOverview();
      toast(pjEditingId ? 'Project update ho gaya ✓' : 'Project add ho gaya ✓', 'ok');
    }).catch(function(err){
      pjModal.saveBtn.disabled = false;
      pjModal.saveBtn.innerHTML = old;
      showFormErr(pjModal, 'Save error: ' + (err && err.message ? err.message : 'unknown'));
    });
  }

  function deleteProject(id){
    if(!window.confirm('Kya aap ye project DELETE karna chahte hain?\n\nYe action undo nahi ho sakta — project homepage aur /projects se hata jayega.')) return;
    supabase.from('projects').delete().eq('id', id).then(function(r){
      if(r.error){
        toast('Delete fail hua: ' + (r.error.message || 'error'), 'err');
        return;
      }
      invalidate('projects');
      loadProjects();
      if(activeView === 'overview') loadOverview();
      toast('Project delete ho gaya.', 'ok');
    }).catch(function(err){
      toast('Delete error: ' + (err && err.message ? err.message : 'unknown'), 'err');
    });
  }

  // ---------- POSTS ----------
  function renderPosts(rows){
    if(!rows || !rows.length){
      ps.list.style.display = 'none';
      ps.emptyBox.style.display = 'block';
      ps.emptyBox.innerHTML = '<strong>Abhi koi blog post nahi hai.</strong><br><button type="button" class="btn btn-primary" id="emptyAddPostBtn" style="margin-top:14px;">+ Write first post</button>';
      ps.countText.textContent = '0 posts';
      els.psBadge.textContent = 0;
      var bt = document.getElementById('emptyAddPostBtn');
      if(bt) bt.addEventListener('click', function(){ openPostModal('new'); });
      return;
    }
    ps.emptyBox.style.display = 'none';
    ps.list.style.display = 'grid';
    ps.countText.textContent = rows.length + ' post' + (rows.length > 1 ? 's' : '');
    els.psBadge.textContent = rows.length;

    var html = rows.map(function(p){
      var thumb = p.image_url
        ? '<img src="' + p.image_url.split('?')[0] + '" alt="' + esc(p.title) + ' cover" loading="lazy">'
        : '<span class="ph">' + esc((p.category || 'P').slice(0, 1).toUpperCase()) + '</span>';
      var state = p.published
        ? '<button type="button" class="chip unpub" data-ptoggle="' + (p.id || '') + '" title="Click to unpublish">Live</button>'
        : '<button type="button" class="chip pub" data-ptoggle="' + (p.id || '') + '" title="Click to publish">Draft</button>';
      return '<div class="item">' +
        '<div class="thumb" aria-hidden="true">' + thumb + '</div>' +
        '<div class="item-body">' +
          '<div class="item-top">' +
            '<span class="item-title">' + esc(p.title) + '</span>' +
            '<span class="cat">' + esc(p.category || 'General') + '</span>' +
            '<span class="slug">' + esc(fmtDate(p.published_at || p.created_at)) + '</span>' +
          '</div>' +
          '<div class="item-desc">' + esc(p.excerpt) + '</div>' +
        '</div>' +
        '<div class="item-actions">' +
          state +
          '<button type="button" class="chip edit" data-psedit="' + (p.id || '') + '">Edit</button>' +
          '<button type="button" class="chip del" data-psdel="' + (p.id || '') + '">Delete</button>' +
        '</div>' +
      '</div>';
    }).join('');
    ps.list.innerHTML = html;
  }

  function loadPosts(force){
    if(!supabase){ showFatal('client'); return; }
    if(cache.posts && !force){
      renderPosts(cache.posts);
      return;
    }

    var stored = readStored('posts');
    if(stored && !cache.posts){
      cache.posts = stored;
      renderPosts(stored);
    }

    if(cache.posts) hideLoading(ps.loadingBox);
    else showLoading(ps.loadingBox, 'Posts load ho rahe hain…');
    ps.emptyBox.style.display = 'none';
    ps.list.style.display = cache.posts ? 'grid' : 'none';

    withTimeout(
      supabase.from('posts').select('*').order('published_at', { ascending: false }),
      NET_TIMEOUT,
      'Posts'
    ).then(function(r){
      hideLoading(ps.loadingBox);
      if(r.error){
        if(cache.posts){
          renderPosts(cache.posts);
          ps.emptyBox.style.display = 'none';
          ps.list.style.display = 'grid';
          toast('Posts refresh nahi hue — purana data dikh raha hai.', 'err');
          return;
        }
        ps.list.style.display = 'none';
        ps.emptyBox.style.display = 'block';
        ps.emptyBox.className = 'empty';
        ps.emptyBox.innerHTML = retryBox(netError(r.error, TABLES.posts));
        return;
      }
      cache.posts = r.data;
      writeStored('posts', r.data);
      renderPosts(r.data);
    }).catch(function(err){
      hideLoading(ps.loadingBox);
      if(cache.posts){ renderPosts(cache.posts); toast('Posts refresh nahi hue.', 'err'); return; }
      ps.list.style.display = 'none';
      ps.emptyBox.style.display = 'block';
      ps.emptyBox.className = 'empty';
      ps.emptyBox.innerHTML = retryBox(netError(err, TABLES.posts));
    });
  }

  function openPostModal(mode, row){
    hideFormErr(psModal);
    hideFormErr(pjModal);
    psEditingId = null;
    psUploadedUrl = null;
    psModal.fImg.value = '';
    setPreview(psModal, null);

    if(mode === 'edit' && row){
      psEditingId = row.id;
      psModal.title.textContent = 'Edit post';
      psModal.fTitle.value = row.title || '';
      psModal.fSlug.value = row.slug || '';
      psModal.fCategory.value = row.category || 'AI tools';
      psModal.fExcerpt.value = row.excerpt || '';
      psModal.fContent.value = row.content || '';
      psModal.fPublished.checked = row.published !== false;
      psUploadedUrl = row.image_url || null;
      setPreview(psModal, psUploadedUrl);
      psModal.uploadState.textContent = psUploadedUrl ? 'Current image dikh rahi hai.' : 'Abhi koi image nahi hai.';
    } else {
      psModal.title.textContent = 'New blog post';
      psModal.fTitle.value = '';
      psModal.fSlug.value = '';
      psModal.fCategory.value = 'AI tools';
      psModal.fExcerpt.value = '';
      psModal.fContent.value = '';
      psModal.fPublished.checked = true;
      psModal.uploadState.textContent = 'PNG/JPEG/WebP. Public bucket mein upload hota hai.';
    }
    openModal(psModal.root);
    setTimeout(function(){ psModal.fTitle.focus(); }, 60);
  }

  function savePost(e){
    e.preventDefault();
    hideFormErr(psModal);
    var title = psModal.fTitle.value.trim();
    var slug = psModal.fSlug.value.trim() || slugify(title);
    var excerpt = psModal.fExcerpt.value.trim();
    var content = psModal.fContent.value.trim();

    if(!title){ showFormErr(psModal, 'Title bharo (required).'); psModal.fTitle.focus(); return; }
    if(!excerpt){ showFormErr(psModal, 'Excerpt bharo (required).'); psModal.fExcerpt.focus(); return; }
    if(!content){ showFormErr(psModal, 'Content bharo (required).'); psModal.fContent.focus(); return; }

    var data = {
      title: title,
      slug: slug,
      category: psModal.fCategory.value,
      excerpt: excerpt,
      content: content,
      image_url: psUploadedUrl || null,
      published: psModal.fPublished.checked
    };

    psModal.saveBtn.disabled = true;
    var old = psModal.saveBtn.innerHTML;
    psModal.saveBtn.innerHTML = 'Saving…';

    var op = psEditingId
      ? supabase.from('posts').update(data).eq('id', psEditingId)
      : supabase.from('posts').insert([data]);

    op.then(function(r){
      psModal.saveBtn.disabled = false;
      psModal.saveBtn.innerHTML = old;
      if(r.error){
        if(/duplicate|23505/i.test(r.error.message || '')){
          showFormErr(psModal, 'Ye slug pehle se maujood hai — alag slug use karo.');
        } else if(/permission|policy|RLS|42501/i.test(r.error.message || '')){
          showFormErr(psModal, 'Save karne ki permission nahi: "posts" table pe INSERT/UPDATE policy (authenticated) set karni hai.');
        } else {
          showFormErr(psModal, 'Save fail hua: ' + (r.error.message || 'unknown error'));
        }
        return;
      }
      closeModal(psModal.root);
      invalidate('posts');
      loadPosts();
      if(activeView === 'overview') loadOverview();
      toast(psEditingId ? 'Post update ho gayi ✓' : 'Post publish ke liye save ho gayi ✓', 'ok');
    });
  }

  function togglePost(id, currentlyPublished){
    if(!window.confirm(currentlyPublished ? 'Post ko DRAFT banayein? Public site se jhat se gayab ho jayegi.' : 'Post ko LIVE karein? Public site pe dikhne lagegi.')) return;
    supabase.from('posts').update({ published: !currentlyPublished }).eq('id', id).then(function(r){
      if(r.error){
        toast('Update fail: ' + (r.error.message || 'error'), 'err');
        return;
      }
      invalidate('posts');
      loadPosts();
      toast(currentlyPublished ? 'Post draft ho gayi.' : 'Post live ho gayi ✓', 'ok');
    });
  }

  function deletePost(id){
    if(!window.confirm('Kya aap ye post DELETE karna chahte hain? Ye action undo nahi ho sakta.')) return;
    supabase.from('posts').delete().eq('id', id).then(function(r){
      if(r.error){
        toast('Delete fail hua: ' + (r.error.message || 'error'), 'err');
        return;
      }
      invalidate('posts');
      loadPosts();
      if(activeView === 'overview') loadOverview();
      toast('Post delete ho gayi.', 'ok');
    });
  }

  // ---------- OVERVIEW ----------
  function renderOverview(rp2, rb2, rs2){
    var statGrid = document.getElementById('statsGrid');
    var ovProj = document.getElementById('ovProjects');
    var ovPost = document.getElementById('ovPosts');
    var projRows = (rp2 && rp2.data) || [];
    var postRows = (rb2 && rb2.data) || [];
    var skillRows = (rs2 && rs2.data) || [];
    var pubCount = postRows.filter(function(p){ return p.published !== false; }).length;
    var draftCount = postRows.length - pubCount;

    statGrid.innerHTML =
      '<div class="stat"><div class="num"><a href="#" data-tab="projects" style="color:inherit;">' + (rp2 && rp2.error ? '—' : projRows.length) + '</a></div><div class="lbl">Projects</div></div>' +
      '<div class="stat cyan"><div class="num"><a href="#" data-tab="skills" style="color:inherit;">' + (rs2 && rs2.error ? '—' : skillRows.length) + '</a></div><div class="lbl">Skills</div></div>' +
      '<div class="stat cyan"><div class="num"><a href="#" data-tab="posts" style="color:inherit;">' + (rb2 && rb2.error ? '—' : postRows.length) + '</a></div><div class="lbl">Blog posts</div></div>' +
      '<div class="stat cyan"><div class="num">' + pubCount + '</div><div class="lbl">Live posts</div></div>' +
      '<div class="stat"><div class="num">' + draftCount + '</div><div class="lbl">Drafts</div></div>';

    document.querySelectorAll('#statsGrid a[data-tab]').forEach(function(a){
      a.addEventListener('click', function(e){
        e.preventDefault();
        switchView(a.getAttribute('data-tab'));
      });
    });

    ovProj.innerHTML = (rp2 && rp2.error)
      ? retryBox('<strong>Projects load nahi hue.</strong><br>' + netError(rp2.error, TABLES.projects))
      : projRows.length
        ? projRows.slice(0, 4).map(function(p2){
            return '<div class="mini"><span class="t">' + esc(p2.title) + '</span><span class="d">' + esc(fmtDate(p2.created_at)) + '</span><button type="button" class="edit-small" data-ovpe="' + p2.id + '">Edit</button></div>';
          }).join('')
        : emptyNote('Abhi koi project nahi. Overview se hi add karo.');
    bindOvProjectEdits(ovProj);

    ovPost.innerHTML = (rb2 && rb2.error)
      ? retryBox('<strong>Posts load nahi hue.</strong><br>' + netError(rb2.error, TABLES.posts))
      : postRows.length
        ? postRows.slice(0, 4).map(function(p3){
            var tag = p3.published === false ? '<span style="color:var(--warn);font-weight:700;">Draft</span>' : '<span style="color:var(--ok);font-weight:700;">Live</span>';
            return '<div class="mini"><span class="t">' + esc(p3.title) + '</span><span class="d">' + tag + ' · ' + esc(fmtDate(p3.published_at || p3.created_at)) + '</span><button type="button" class="edit-small" data-ovbe="' + p3.id + '">Edit</button></div>';
          }).join('')
        : emptyNote('Abhi koi blog post nahi.');
    bindOvPostEdits(ovPost);
  }

  function loadOverview(force){
    if(!supabase){ showFatal('client'); return; }
    var statGrid = document.getElementById('statsGrid');
    var ovProj = document.getElementById('ovProjects');
    var ovPost = document.getElementById('ovPosts');

    if(!force){
      var haveP = cache.projects !== null, haveB = cache.posts !== null, haveS = cache.skills !== null;
      if(haveP && haveB && haveS){
        renderOverview({ data: cache.projects }, { data: cache.posts }, { data: cache.skills });
        return;
      }

      // localStorage se turant data (page reload pe bhi fast)
      var sp = readStored('projects'), sb = readStored('posts'), ss = readStored('skills');
      if(sp && !cache.projects) cache.projects = sp;
      if(sb && !cache.posts) cache.posts = sb;
      if(ss && !cache.skills) cache.skills = ss;
      if(cache.projects !== null && cache.posts !== null && cache.skills !== null){
        renderOverview({ data: cache.projects }, { data: cache.posts }, { data: cache.skills });
        // background me fresh data lao
        loadProjects(true);
        loadPosts(true);
        loadSkills(true);
        return;
      }
    }

    var haveP2 = cache.projects !== null, haveB2 = cache.posts !== null, haveS2 = cache.skills !== null;
    if(force && (!haveP2 || !haveB2 || !haveS2)){
      cache.projects = null; cache.posts = null; cache.skills = null;
      haveP2 = haveB2 = haveS2 = false;
    }

    statGrid.innerHTML = '<div class="stat"><div class="num">…</div><div class="lbl">Stats load ho rahe hain</div></div>';
    ovProj.innerHTML = '<div class="loading-box"><span class="spinner"></span> <span>Loading…</span></div>';
    ovPost.innerHTML = '<div class="loading-box"><span class="spinner"></span> <span>Loading…</span></div>';

    function safe(p, label){
      return withTimeout(p, NET_TIMEOUT, label)
        .then(function(a){ return a; })
        .catch(function(e){ return { error: { message: (e && e.message) || 'error' }, data: [] }; });
    }

    var rp = haveP2
      ? Promise.resolve({ data: cache.projects })
      : safe(supabase.from('projects').select('*').order('created_at', { ascending: false }), 'Projects');
    var rb = haveB2
      ? Promise.resolve({ data: cache.posts })
      : safe(supabase.from('posts').select('*').order('published_at', { ascending: false }), 'Posts');
    var rs = haveS2
      ? Promise.resolve({ data: cache.skills })
      : safe(supabase.from('skills').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true }), 'Skills');

    Promise.all([rp, rb, rs]).then(function(results){
      var rp2 = results[0], rb2 = results[1], rs2 = results[2];
      if(!haveP2 && !rp2.error){ cache.projects = rp2.data; writeStored('projects', rp2.data); }
      if(!haveB2 && !rb2.error){ cache.posts = rb2.data; writeStored('posts', rb2.data); }
      if(!haveS2 && !rs2.error){ cache.skills = rs2.data; writeStored('skills', rs2.data); }
      renderOverview(rp2, rb2, rs2);
    });
  }

  function emptyNote(t){
    return '<div style="color:var(--text-dim); font-size:.88rem; padding:10px 0;">' + t + '</div>';
  }

  function bindOvProjectEdits(container){
    container.querySelectorAll('[data-ovpe]').forEach(function(b){
      b.addEventListener('click', function(){
        supabase.from('projects').select('*').eq('id', b.getAttribute('data-ovpe')).maybeSingle().then(function(r){
          if(r.error || !r.data){ toast('Project mila nahi.', 'err'); return; }
          switchView('projects');
          openProjectModal('edit', r.data);
        });
      });
    });
  }

  function bindOvPostEdits(container){
    container.querySelectorAll('[data-ovbe]').forEach(function(b){
      b.addEventListener('click', function(){
        supabase.from('posts').select('*').eq('id', b.getAttribute('data-ovbe')).maybeSingle().then(function(r){
          if(r.error || !r.data){ toast('Post mili nahi.', 'err'); return; }
          switchView('posts');
          openPostModal('edit', r.data);
        });
      });
    });
  }

  // ---------- SKILLS ----------
  function renderSkills(rows){
    if(!rows || !rows.length){
      sk.list.style.display = 'none';
      sk.emptyBox.style.display = 'block';
      sk.emptyBox.innerHTML = '<strong>Abhi koi skill nahi hai.</strong><br><button type="button" class="btn btn-primary" id="emptyAddSkillBtn" style="margin-top:14px;">+ Add first skill</button>';
      sk.countText.textContent = '0 skills';
      els.skBadge.textContent = 0;
      var bt = document.getElementById('emptyAddSkillBtn');
      if(bt) bt.addEventListener('click', function(){ openSkillModal('new'); });
      return;
    }
    sk.emptyBox.style.display = 'none';
    sk.list.style.display = 'grid';
    sk.countText.textContent = rows.length + ' skill' + (rows.length > 1 ? 's' : '');
    els.skBadge.textContent = rows.length;

    var html = rows.map(function(p){
      var icon = p.icon_url
        ? '<img src="' + p.icon_url + '" alt="' + esc(p.name) + ' icon" loading="lazy">'
        : '<span class="ph">' + esc((p.name || '?').slice(0, 1).toUpperCase()) + '</span>';
      var idx = rows.indexOf(p);
      var up = '<button type="button" class="chip" data-skup="' + (p.id || '') + '"' + (idx === 0 ? ' disabled style="opacity:.4"' : '') + ' title="Move up">&#8593;</button>';
      var down = '<button type="button" class="chip" data-skdown="' + (p.id || '') + '"' + (idx === rows.length - 1 ? ' disabled style="opacity:.4"' : '') + ' title="Move down">&#8595;</button>';
      return '<div class="item">' +
        '<div class="thumb" aria-hidden="true">' + icon + '</div>' +
        '<div class="item-body">' +
          '<div class="item-top">' +
            '<span class="item-title">' + esc(p.name) + '</span>' +
            '<span class="cat">' + esc(p.category || 'Other') + '</span>' +
            '<span class="slug">#' + (p.sort_order || 0) + '</span>' +
          '</div>' +
          '<div class="item-desc" style="font-size:.8rem;">Order: ' + idx + ' (list mein position)</div>' +
        '</div>' +
        '<div class="item-actions">' +
          up + down +
          '<button type="button" class="chip edit" data-skedit="' + (p.id || '') + '">Edit</button>' +
          '<button type="button" class="chip del" data-skdel="' + (p.id || '') + '">Delete</button>' +
        '</div>' +
      '</div>';
    }).join('');
    sk.list.innerHTML = html;
  }

  function loadSkills(force){
    if(!supabase){ showFatal('client'); return; }
    if(cache.skills && !force){
      renderSkills(cache.skills);
      return;
    }

    var stored = readStored('skills');
    if(stored && !cache.skills){
      cache.skills = stored;
      renderSkills(stored);
    }

    if(cache.skills) hideLoading(sk.loadingBox);
    else showLoading(sk.loadingBox, 'Skills load ho rahe hain…');
    sk.emptyBox.style.display = 'none';
    sk.list.style.display = cache.skills ? 'grid' : 'none';

    withTimeout(
      supabase.from('skills').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
      NET_TIMEOUT,
      'Skills'
    ).then(function(r){
      hideLoading(sk.loadingBox);
      if(r.error){
        if(cache.skills){
          renderSkills(cache.skills);
          sk.emptyBox.style.display = 'none';
          sk.list.style.display = 'grid';
          toast('Skills refresh nahi hue — purana data dikh raha hai.', 'err');
          return;
        }
        sk.list.style.display = 'none';
        sk.emptyBox.style.display = 'block';
        sk.emptyBox.className = 'empty';
        sk.emptyBox.innerHTML = retryBox(netError(r.error, 'skills'));
        return;
      }
      cache.skills = r.data;
      writeStored('skills', r.data);
      renderSkills(r.data);
    }).catch(function(err){
      hideLoading(sk.loadingBox);
      if(cache.skills){ renderSkills(cache.skills); toast('Skills refresh nahi hue.', 'err'); return; }
      sk.list.style.display = 'none';
      sk.emptyBox.style.display = 'block';
      sk.emptyBox.className = 'empty';
      sk.emptyBox.innerHTML = retryBox(netError(err, 'skills'));
    });
  }

  function openSkillModal(mode, row){
    hideFormErr(skModal);
    skEditingId = null;

    if(mode === 'edit' && row){
      skEditingId = row.id;
      skModal.title.textContent = 'Edit skill';
      skModal.fName.value = row.name || '';
      skModal.fCategory.value = row.category || 'AI tools';
      skModal.fIcon.value = row.icon_url || '';
      skModal.fOrder.value = row.sort_order != null ? row.sort_order : 0;
      setIconPreview(row.icon_url || null);
    } else {
      skModal.title.textContent = 'New skill';
      skModal.fName.value = '';
      skModal.fCategory.value = 'AI tools';
      skModal.fIcon.value = '';
      skModal.fOrder.value = '';
      setIconPreview(null);
    }
    hideFormErr(pjModal);
    hideFormErr(psModal);
    openModal(skModal.root);
    setTimeout(function(){ skModal.fName.focus(); }, 60);
  }

  function setIconPreview(src){
    skModal.iconPreview.innerHTML = src
      ? '<img src="' + src.split('?')[0] + '" alt="Icon preview">'
      : '<span class="ph">ICON</span>';
  }

  function saveSkill(e){
    e.preventDefault();
    hideFormErr(skModal);
    var name = skModal.fName.value.trim();
    if(!name){ showFormErr(skModal, 'Skill ka name bharo (required).'); skModal.fName.focus(); return; }

    var data = {
      name: name,
      category: skModal.fCategory.value,
      icon_url: skModal.fIcon.value.trim() || null,
      sort_order: parseInt(skModal.fOrder.value, 10) || 0
    };

    skModal.saveBtn.disabled = true;
    var old = skModal.saveBtn.innerHTML;
    skModal.saveBtn.innerHTML = 'Saving…';

    var op = skEditingId
      ? supabase.from('skills').update(data).eq('id', skEditingId)
      : supabase.from('skills').insert([data]);

    op.then(function(r){
      skModal.saveBtn.disabled = false;
      skModal.saveBtn.innerHTML = old;
      if(r.error){
        if(/permission|policy|RLS|42501/i.test(r.error.message || '')){
          showFormErr(skModal, 'Save permission nahi: "skills" table pe INSERT/UPDATE policy (authenticated) set karni hai.');
        } else {
          showFormErr(skModal, 'Save fail hua: ' + (r.error.message || 'unknown error'));
        }
        return;
      }
      closeModal(skModal.root);
      invalidate('skills');
      loadSkills();
      toast(skEditingId ? 'Skill update ho gaya ✓' : 'Skill add ho gaya ✓', 'ok');
    });
  }

  function deleteSkill(id){
    if(!window.confirm('Kya aap ye skill DELETE karna chahte hain?')) return;
    supabase.from('skills').delete().eq('id', id).then(function(r){
      if(r.error){
        toast('Delete fail hua: ' + (r.error.message || 'error'), 'err');
        return;
      }
      invalidate('skills');
      loadSkills();
      toast('Skill delete ho gaya.', 'ok');
    });
  }

  function moveSkill(id, dir){
    supabase.from('skills').select('id,sort_order,created_at').order('sort_order', { ascending: true }).order('created_at', { ascending: true }).then(function(r){
      if(r.error || !r.data || !r.data.length) return;
      var rows = r.data;
      var idx = -1;
      for(var i = 0; i < rows.length; i++){ if(rows[i].id === id){ idx = i; break; } }
      if(idx < 0) return;
      var j = idx + dir;
      if(j < 0 || j >= rows.length) return;
      var a = rows[idx], b = rows[j];
      Promise.all([
        supabase.from('skills').update({ sort_order: b.sort_order }).eq('id', a.id),
        supabase.from('skills').update({ sort_order: a.sort_order }).eq('id', b.id)
      ]).then(function(){
        invalidate('skills');
        loadSkills();
        toast('Order update ho gaya ✓', 'ok');
      }).catch(function(){
        invalidate('skills');
        loadSkills();
      });
    });
  }

  // ---------- SETTINGS ----------
  function loadSettings(){
    if(!supabase){ showFatal('client'); return; }
    if(cache.settings){
      st.formErr.className = 'form-err';
      var row = cache.settings;
      for(var ki in st.fields){
        var eli = document.getElementById(st.fields[ki]);
        if(eli) eli.value = (row && row[ki]) ? row[ki] : '';
      }
      st.loadingBox.style.display = 'none';
      st.wrap.style.display = 'block';
      return;
    }
    var stored = readStored('settings');
    if(stored && stored.row){
      cache.settings = stored.row;
      for(var k2 in st.fields){
        var el2 = document.getElementById(st.fields[k2]);
        if(el2) el2.value = (stored.row[k2]) ? stored.row[k2] : '';
      }
      st.loadingBox.style.display = 'none';
      st.wrap.style.display = 'block';
    }

    showLoading(st.loadingBox, 'Settings load ho rahe hain…');
    st.wrap.style.display = stored && stored.row ? 'block' : 'none';

    withTimeout(supabase.from('site_settings').select('*').limit(1), NET_TIMEOUT, 'Settings').then(function(r){
      hideLoading(st.loadingBox);
      st.wrap.style.display = 'block';
      if(r.error){
        st.formErr.className = 'form-err show';
        st.formErr.textContent = 'Settings load nahi hue: ' + (r.error.message || 'error');
        return;
      }
      st.formErr.className = 'form-err';
      cache.settings = (r.data && r.data[0]) || {};
      writeStored('settings', { row: cache.settings });
      var row = cache.settings;
      for(var k in st.fields){
        var el = document.getElementById(st.fields[k]);
        if(el) el.value = (row && row[k]) ? row[k] : '';
      }
    }).catch(function(err){
      hideLoading(st.loadingBox);
      st.wrap.style.display = 'block';
      st.formErr.className = 'form-err show';
      st.formErr.textContent = 'Settings load nahi hue: ' + (err && err.message ? err.message : 'error');
    });
  }

  function saveSettings(){
    var data = { id: 1 };
    for(var k in st.fields){
      var el = document.getElementById(st.fields[k]);
      data[k] = el ? (el.value.trim() || null) : null;
    }
    st.saveBtn.disabled = true;
    var old = st.saveBtn.innerHTML;
    st.saveBtn.innerHTML = 'Saving…';
    supabase.from('site_settings').upsert(data, { onConflict: 'id' }).then(function(r){
      st.saveBtn.disabled = false;
      st.saveBtn.innerHTML = old;
      if(r.error){
        st.formErr.className = 'form-err show';
        st.formErr.textContent = 'Save fail: ' + (r.error.message || 'error');
        return;
      }
      st.formErr.className = 'form-err';
      cache.settings = data; writeStored('settings', { row: data });
      st.state.textContent = 'Settings save ho gayi ✓';
      toast('Settings saved ✓', 'ok');
    });
  }

  // ---------- boot ----------
  document.addEventListener('DOMContentLoaded', function(){

    // modal close buttons
    pjModal.closeBtn.addEventListener('click', function(){ closeModal(pjModal.root); });
    pjModal.cancelBtn.addEventListener('click', function(){ closeModal(pjModal.root); });
    psModal.closeBtn.addEventListener('click', function(){ closeModal(psModal.root); });
    psModal.cancelBtn.addEventListener('click', function(){ closeModal(psModal.root); });

    pjModal.root.addEventListener('click', function(e){ if(e.target === pjModal.root) closeModal(pjModal.root); });
    psModal.root.addEventListener('click', function(e){ if(e.target === psModal.root) closeModal(psModal.root); });
    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape'){
        closeModal(pjModal.root);
        closeModal(psModal.root);
        closeModal(skModal.root);
      }
    });

    // slug auto-gen (posts)
    var psSlugTouched = false;
    psModal.fTitle.addEventListener('input', function(){
      if(!psSlugTouched) psModal.fSlug.value = slugify(psModal.fTitle.value);
    });
    psModal.fSlug.addEventListener('input', function(){ psSlugTouched = true; });
    psModal.fSlug.addEventListener('focus', function(){ psSlugTouched = true; });

    pj.addBtn.addEventListener('click', function(){ openProjectModal('new'); });
    ps.addBtn.addEventListener('click', function(){ openPostModal('new'); });

    // project screenshot upload
    pjModal.fImg.addEventListener('change', function(e){
      handleUpload(e, 'project-images', 'project', pjModal, function(u){ pjUploadedUrl = u; });
    });

    psModal.fImg.addEventListener('change', function(e){
      handleUpload(e, 'blog-images', 'post', psModal, function(u){ psUploadedUrl = u; });
    });

    pjModal.form.addEventListener('submit', saveProject);
    psModal.form.addEventListener('submit', savePost);

    pj.list.addEventListener('click', function(e){
      var ed = e.target.closest('[data-pedit]');
      var del = e.target.closest('[data-pdel]');
      if(ed){
        supabase.from('projects').select('*').eq('id', ed.getAttribute('data-pedit')).maybeSingle().then(function(r){
          if(r.error || !r.data){ toast('Project mila nahi.', 'err'); return; }
          openProjectModal('edit', r.data);
        });
        return;
      }
      if(del){ deleteProject(del.getAttribute('data-pdel')); }
    });

    ps.list.addEventListener('click', function(e){
      var ed = e.target.closest('[data-psedit]');
      var del = e.target.closest('[data-psdel]');
      var tg = e.target.closest('[data-ptoggle]');
      if(ed){
        supabase.from('posts').select('*').eq('id', ed.getAttribute('data-psedit')).maybeSingle().then(function(r){
          if(r.error || !r.data){ toast('Post mili nahi.', 'err'); return; }
          openPostModal('edit', r.data);
        });
        return;
      }
      if(tg){
        var row = e.target.closest('.item');
        var pub = !(row && row.querySelector('[data-ptoggle].pub'));
        togglePost(tg.getAttribute('data-ptoggle'), pub);
        return;
      }
      if(del){ deletePost(del.getAttribute('data-psdel')); }
    });

    function doLogout(){
      supabase.auth.signOut().then(function(){
        window.location.href = '/admin/login';
      });
    }
    els.logoutBtn.addEventListener('click', doLogout);
    document.getElementById('sidebarLogout').addEventListener('click', doLogout);

    st.saveBtn.addEventListener('click', saveSettings);

    // skills
    skModal.closeBtn.addEventListener('click', function(){ closeModal(skModal.root); });
    skModal.cancelBtn.addEventListener('click', function(){ closeModal(skModal.root); });
    skModal.root.addEventListener('click', function(e){ if(e.target === skModal.root) closeModal(skModal.root); });
    sk.addBtn.addEventListener('click', function(){ openSkillModal('new'); });
    skModal.fIcon.addEventListener('input', function(){ setIconPreview(skModal.fIcon.value.trim() || null); });
    skModal.form.addEventListener('submit', saveSkill);
    sk.list.addEventListener('click', function(e){
      var ed = e.target.closest('[data-skedit]');
      var del = e.target.closest('[data-skdel]');
      var up = e.target.closest('[data-skup]');
      var dn = e.target.closest('[data-skdown]');
      if(ed){
        supabase.from('skills').select('*').eq('id', ed.getAttribute('data-skedit')).maybeSingle().then(function(r){
          if(r.error || !r.data){ toast('Skill mila nahi.', 'err'); return; }
          openSkillModal('edit', r.data);
        });
        return;
      }
      if(up){ moveSkill(up.getAttribute('data-skup'), -1); return; }
      if(dn){ moveSkill(dn.getAttribute('data-skdown'), 1); return; }
      if(del){ deleteSkill(del.getAttribute('data-skdel')); }
    });

    // ---------- init ----------
    // Retry button (loading box + empty box + fatal box — sab par kaam karta hai)
    document.addEventListener('click', function(e){
      var b = e.target.closest('[data-retry]');
      if(!b || !retryFn) return;
      b.disabled = true;
      var old = b.textContent;
      b.textContent = 'Retrying…';
      setTimeout(function(){
        retryFn();
        // agar retry fail hua to button wapas normal ho jaye
        setTimeout(function(){
          if(b.isConnected){ b.disabled = false; b.textContent = old; }
        }, 1200);
      }, 30);
    });

    var authWatchStarted = false;
    var sessionOk = false;

    // Retry ka kaam: agar client + session ready hai to sirf current view dobara load karo,
    // warna poora boot (CDN + session) phir se chalao.
    function doRetry(){
      if(!supabase || !sessionOk){ startAdmin(); return; }
      // force = true: cache ho ya na ho, network se dobara pucho
      if(activeView === 'projects') loadProjects(true);
      else if(activeView === 'posts') loadPosts(true);
      else if(activeView === 'skills') loadSkills(true);
      else if(activeView === 'settings'){ invalidate('settings'); loadSettings(); }
      else loadOverview();
    }

    function startAdmin(){
      els.noConfig.style.display = 'none';
      document.querySelectorAll('.sidebar .tab').forEach(function(t){ t.disabled = false; });
      retryFn = doRetry;

      if(!url || !key){ showFatal('config'); return; }

      window.onSupabaseReady(function(lib){
        try {
          supabase = lib.createClient(url, key, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
          });
        } catch(err){
          supabase = null;
        }
        if(!supabase){ showFatal('client'); return; }
        if(!authWatchStarted){
          authWatchStarted = true;
          supabase.auth.onAuthStateChange(function(event){
            if(event === 'SIGNED_OUT' || event === 'TOKEN_REFRESH_FAILED'){
              window.location.href = '/admin/login';
            }
          });
        }
        bootSession();
      }, function(){
        showFatal('cdn');
      });
    }

    function bootSession(){
      var grid = document.getElementById('statsGrid');
      if(grid && !grid.innerHTML.trim()){
        grid.innerHTML = '<div class="stat"><div class="num">…</div><div class="lbl">Dashboard load ho raha hai…</div></div>';
      }
      withTimeout(supabase.auth.getSession(), 12000, 'Login check').then(function(r){
        if(!r.data.session || (r.data.session.expires_at && r.data.session.expires_at * 1000 < Date.now())){
          window.location.href = '/admin/login';
          return;
        }
        var user = r.data.session.user;
        sessionOk = true;
        if(user){
          var label = user.user_metadata && user.user_metadata.full_name ? user.user_metadata.full_name : '';
          var name = label || (user.email ? user.email.split('@')[0] : 'Admin');
          var av = document.getElementById('uAvatar');
          var nm = document.getElementById('uName');
          var ml = document.getElementById('uMail');
          if(av) av.textContent = (name || 'A').charAt(0).toUpperCase();
          if(nm) nm.textContent = name;
          if(ml) ml.textContent = user.email || '';
        }
        tabs();
        loadOverview();
      }).catch(function(err){
        // network issue hi hai — login page pe bhejne ke bajaye Retry do
        if(/time out|Failed to fetch|NetworkError|fetch failed/i.test((err && err.message) || '')){
          showFatal('net');
          return;
        }
        window.location.href = '/admin/login';
      });
    }

    startAdmin();

    startAdmin();
  });
})();
