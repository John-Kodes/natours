/* eslint-disable */
// import '@babel/polyfill';
import { login, logout } from './login';

// DOM Elements
const loginForm = document.querySelector('.form');
const logOutBtn = document.querySelector('.nav__el--logout');

// Submit handler
if (loginForm)
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    login(email, password);
  });

if (logOutBtn) logOutBtn.addEventListener('click', logout);
