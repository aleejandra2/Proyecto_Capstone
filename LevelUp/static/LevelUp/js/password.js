(function () {
  function qs(sel, root) { return (root || document).querySelector(sel); }

  // Soporta ambas pantallas: cambiar contraseña y registro
  const pw1 =
    document.getElementById('id_new_password1') ||
    document.getElementById('id_password1') ||
    qs('input[name="new_password1"], input[name="password1"]');

  if (!pw1) return;

  const form = pw1.closest('form') || document;
  const pw2 =
    document.getElementById('id_new_password2') ||
    document.getElementById('id_password2') ||
    qs('input[name="new_password2"], input[name="password2"]');

  // Contenedor de requisitos
  let reqBox = qs('#pw-requirements', form) || document.getElementById('pw-requirements');
  if (!reqBox) return;

  function setRuleState(rule, state /* 'ok' | 'bad' | 'neutral' */) {
    const li = qs('[data-rule="' + rule + '"]', reqBox);
    if (!li) return;
    const badge = qs('.badge', li);
    if (!badge) return;

    // Limpia clases previas
    li.classList.remove('text-success', 'text-danger');
    badge.classList.remove('bg-success', 'bg-danger', 'bg-secondary');

    if (state === 'ok') {
      li.classList.add('text-success');
      badge.classList.add('bg-success');
      badge.textContent = '✓';
    } else if (state === 'bad') {
      li.classList.add('text-danger');
      badge.classList.add('bg-danger');
      badge.textContent = '✗';
    } else {
      // neutral
      badge.classList.add('bg-secondary');
      badge.textContent = '•';
    }
  }

  function similarToUser(str, email, fullName) {
    const contains = (v) => v && v.length >= 4 && str.toLowerCase().includes(v.toLowerCase());
    const user = (email || '').split('@')[0];
    const flatName = (fullName || '').replace(/\s+/g, '');
    return contains(user) || contains(flatName);
  }

  function getUserHints() {
    // En cambiar contraseña puedes inyectar data-user-* en el input
    const emailAttr = pw1.dataset.userEmail || '';
    const nameAttr  = pw1.dataset.userName  || '';

    // En registro, tomamos los campos del formulario
    const emailVal = emailAttr || (qs('#id_email', form)?.value || '');
    const first    = (qs('#id_first_name', form)?.value || '');
    const last     = (qs('#id_last_name', form)?.value || '');
    const nameVal  = nameAttr || `${first} ${last}`.trim();

    return { emailVal, nameVal };
  }

  function check() {
    const v1 = pw1.value || '';
    const v2 = pw2 ? (pw2.value || '') : '';
    const empty = v1.length === 0;

    const { emailVal, nameVal } = getUserHints();

    // Si está vacío, todo neutral (no verde)
    if (empty) {
      setRuleState('length',  'neutral');
      setRuleState('numeric', 'neutral');
      setRuleState('similar', 'neutral');
    } else {
      // Longitud
      setRuleState('length', v1.length >= 8 ? 'ok' : 'bad');
      // No solo números
      setRuleState('numeric', (/^\d+$/).test(v1) ? 'bad' : 'ok');
      // No similar a email/nombre
      setRuleState('similar', similarToUser(v1, emailVal, nameVal) ? 'bad' : 'ok');
    }

    // Coincidencia (si el <li> existe). Neutral si ambos vacíos.
    const hasMatchRule = !!qs('[data-rule="match"]', reqBox);
    if (hasMatchRule) {
      if (!v1 && !v2) {
        setRuleState('match', 'neutral');
      } else {
        setRuleState('match', (v1.length > 0 && v1 === v2) ? 'ok' : 'bad');
      }
    }

    // “common” queda siempre neutral (lo valida el servidor al enviar)
    if (qs('[data-rule="common"]', reqBox)) {
      setRuleState('common', 'neutral');
    }
  }

  // Listeners
  pw1.addEventListener('input', check);
  if (pw2) pw2.addEventListener('input', check);
  ['#id_email', '#id_first_name', '#id_last_name'].forEach(sel => {
    const el = qs(sel, form);
    if (el) el.addEventListener('input', check);
  });

  // Evaluación inicial
  check();
})();
