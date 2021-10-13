/* eslint-disable */

// Login function
export const login = async (email, password) => {
  try {
    const res = await fetch('http://localhost:3000/api/v1/users/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (data.status === 'success') {
      alert('Logged in successfully!');
      window.setTimeout(() => location.assign('/'), 1500);
    } else throw data;
  } catch (err) {
    alert(err.message);
  }
};

export const logout = async () => {
  try {
    const res = await fetch('http://localhost:3000/api/v1/users/logout');
    const data = res.json();

    if (data.status === 'success') location.reload(true); // forces a reload on the server and not from the browser cache
  } catch (err) {
    alert('error', 'Error logging out! Try again.');
  }
};
