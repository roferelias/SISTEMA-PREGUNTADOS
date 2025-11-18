// scriptLogin.js — Login + Registro con Flask/MySQL
(() => {
  "use strict";

  // ---- DOM ----
  const formLogin = document.getElementById("loginForm");
  const formReg = document.getElementById("registerForm");
  const errorLogin = document.getElementById("error");
  const regError = document.getElementById("regError");
  const regOk = document.getElementById("regOk");

  const usernameInp = document.getElementById("username");
  const passwordInp = document.getElementById("password");
  const btnLogin = document.getElementById("btnLogin");

  const regNameInp = document.getElementById("regName");
  const regPassInp = document.getElementById("regPass");

  const linkToRegister = document.getElementById("linkToRegister");
  const linkToLogin = document.getElementById("linkToLogin");

  // ---- Helpers ----
  const show = (el) => el && (el.style.display = "block");
  const hide = (el) => el && (el.style.display = "none");
  const setText = (el, txt) => el && (el.textContent = txt || "");

  function showRegister() {
    hide(formLogin);
    show(formReg);
    hide(errorLogin);
    hide(regError);
    hide(regOk);
    regNameInp?.focus();
  }

  function showLogin() {
    show(formLogin);
    hide(formReg);
    hide(errorLogin);
    hide(regError);
    hide(regOk);
    usernameInp?.focus();
  }

  linkToRegister?.addEventListener("click", showRegister);
  linkToLogin?.addEventListener("click", showLogin);

  // ---- Login ----
  formLogin?.addEventListener("submit", async (e) => {
    e.preventDefault();
    hide(errorLogin);
    btnLogin.disabled = true;

    const data = new URLSearchParams();
    data.append("username", usernameInp.value.trim());
    data.append("password", passwordInp.value);

    try {
      const resp = await fetch("/login", {
        method: "POST",
        body: data
      });
      if (resp.redirected) {
        window.location.href = resp.url; // redirige al panel docente
      } else {
        const text = await resp.text();
        setText(errorLogin, "Usuario o contraseña incorrectos.");
        show(errorLogin);
      }
    } catch (err) {
      setText(errorLogin, "Error de conexión.");
      show(errorLogin);
    } finally {
      btnLogin.disabled = false;
    }
  });

  // ---- Registro ----
  formReg?.addEventListener("submit", async (e) => {
    e.preventDefault();
    hide(regError);
    hide(regOk);

    const username = regNameInp.value.trim();
    const password = regPassInp.value;

    if (username.length < 3) {
      setText(regError, "El nombre debe tener al menos 3 caracteres.");
      show(regError);
      return;
    }
    if (password.length < 4) {
      setText(regError, "La contraseña debe tener al menos 4 caracteres.");
      show(regError);
      return;
    }

    const data = new URLSearchParams();
    data.append("regName", username);
    data.append("regPass", password);

    try {
      const resp = await fetch("/register", {
        method: "POST",
        body: data
      });
      if (resp.redirected) {
        window.location.href = resp.url; // autologin tras registro
      } else {
        const text = await resp.text();
        setText(regError, text || "Error al registrar usuario.");
        show(regError);
      }
    } catch (err) {
      setText(regError, "Error de conexión.");
      show(regError);
    }
  });
})();
