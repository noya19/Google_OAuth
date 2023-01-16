const form = document.getElementById('form');
form.addEventListener('submit', (e) => {
    e.preventDefault();
})
const btn = document.getElementById('sub');
btn.addEventListener('click', (e) => {
    const inpt = document.getElementById('password').value;
    console.log(inpt);
})