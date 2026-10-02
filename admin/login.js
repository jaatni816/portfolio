(function(){
  var url = window.SUPABASE_URL || '';
  var key = window.SUPABASE_ANON_KEY || '';

  function state(){
    var box = document.getElementById('configHint');
    if(box) box.style.display = 'none';
    if(!url || !key){
      var err = document.getElementById('errorBox');
      if(err) inflateError(err, 'Supabase keys set nahi huin. supabase.config.js mein SUPABASE_URL aur SUPABASE_ANON_KEY bharo.');
      var btn = document.getElementById('submitBtn');
      if(btn) btn.disabled = true;
      return false;
    }
    return true;
  }

  function inflateError(el, msg){
    el.textContent = msg;
    el.classList.add('show');
  }

  function clearError(){
    var el = document.getElementById('errorBox');
    if(el){ el.textContent = ''; el.classList.remove('show'); }
  }

  function withTimeout(promise, ms, label){
    return new Promise(function(resolve, reject){
      var settled = false;
      var t = setTimeout(function(){
        if(settled) return;
        settled = true;
        reject(new Error(label + ' time out ho gaya. Internet slow ya blocked hai — thodi der baad Retry karo.'));
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

  document.addEventListener('DOMContentLoaded', function(){
    var form = document.getElementById('loginForm');
    var errBox = document.getElementById('errorBox');
    var btn = document.getElementById('submitBtn');
    var email = document.getElementById('email');
    var password = document.getElementById('password');

    if(!state()) return;

    form.addEventListener('submit', function(e){
      e.preventDefault();
      clearError();

      var em = email.value.trim();
      var pw = password.value;
      if(!em || !pw){
        inflateError(errBox, 'Email aur password dono bharo.');
        return;
      }

      btn.disabled = true;
      var old = btn.innerHTML;
      btn.innerHTML = '<span class="spinner"></span> Login...';

      // library load (CDN fallback + timeout)
      window.onSupabaseReady(function(lib){
        var supabase;
        try {
          supabase = lib.createClient(url, key, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
          });
        } catch(err){
          btn.disabled = false;
          btn.innerHTML = old;
          inflateError(errBox, 'Supabase URL check karo — aisa hona chahiye: https://abcdefgh.supabase.co');
          return;
        }

        withTimeout(
          supabase.auth.signInWithPassword({ email: em, password: pw }),
          20000,
          'Login'
        ).then(function(r){
          btn.disabled = false;
          btn.innerHTML = old;
          if(r.error){
            if(/invalid login|invalid/i.test(r.error.message || '')){
              inflateError(errBox, 'Email ya password galat hai. Phir se try karo.');
            } else {
              inflateError(errBox, r.error.message || 'Login fail hua.');
            }
            return;
          }
          window.location.href = '/admin';
        }).catch(function(err){
          btn.disabled = false;
          btn.innerHTML = old;
          inflateError(errBox, (err && err.message ? err.message : 'Login fail hua.'));
        });
      }, function(err){
        btn.disabled = false;
        btn.innerHTML = old;
        inflateError(errBox, (err && err.message ? err.message : 'supabase-js library load nahi hua.') + ' Internet check karke dobara try karo.');
      });
    });

    // already logged in? seed panel turant kholo
    window.onSupabaseReady(function(lib){
      var supabase;
      try {
        supabase = lib.createClient(url, key, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
        });
      } catch(err){ return; }

      withTimeout(supabase.auth.getSession(), 8000, 'Session check').then(function(r){
        if(r.data && r.data.session) window.location.href = '/admin';
      }).catch(function(){
        btn.disabled = false;
      });
    }, function(){});
  });
})();